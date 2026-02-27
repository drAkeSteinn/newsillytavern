import { NextRequest } from 'next/server';
import type { ChatMessage, CharacterCard, LLMConfig, Persona, CharacterGroup } from '@/types';
import ZAI from 'z-ai-web-dev-sdk';
import { detectMentions } from '@/lib/mention-detector';

interface GroupStreamRequest {
  message: string;
  sessionId: string;
  groupId: string;
  group: CharacterGroup;
  characters: CharacterCard[];  // All characters in the group
  messages?: ChatMessage[];
  llmConfig?: LLMConfig;
  userName?: string;
  persona?: Persona;
  lastResponderId?: string;  // For round_robin strategy
}

// Build the system prompt for a character in a group chat
function buildGroupSystemPrompt(
  character: CharacterCard,
  allCharacters: CharacterCard[],
  group: CharacterGroup,
  userName: string = 'User',
  persona?: Persona
): string {
  const parts: string[] = [];

  // Group context
  parts.push(`You are in a group roleplay. You will act as ${character.name}.`);
  
  // List all characters present
  const otherCharacters = allCharacters.filter(c => c.id !== character.id);
  if (otherCharacters.length > 0) {
    parts.push(`\n[Other Characters Present]`);
    otherCharacters.forEach(c => {
      parts.push(`- ${c.name}: ${c.description?.slice(0, 200) || 'No description'}${(c.description?.length || 0) > 200 ? '...' : ''}`);
    });
  }

  // Add user's persona description if available
  if (persona && persona.description) {
    parts.push(`\n[User's Persona - ${userName}]`);
    parts.push(persona.description);
  }

  // Add this character's details
  if (character.description) {
    parts.push(`\n[${character.name}'s Description]`);
    parts.push(character.description);
  }

  if (character.personality) {
    parts.push(`\n[${character.name}'s Personality]`);
    parts.push(character.personality);
  }

  // Add scenario from group or character
  const scenario = group.description || character.scenario;
  if (scenario) {
    parts.push(`\n[Scenario]`);
    parts.push(scenario);
  }

  // Add example messages
  if (character.mesExample) {
    parts.push(`\n[Example Dialogue for ${character.name}]`);
    parts.push(character.mesExample);
  }

  // Add character's note
  if (character.characterNote) {
    parts.push(`\n[${character.name}'s Note]`);
    parts.push(character.characterNote);
  }

  // Add group system prompt if defined
  if (group.systemPrompt) {
    parts.push(`\n[Group Instructions]`);
    parts.push(group.systemPrompt);
  }

  // Add roleplay instructions
  parts.push(`\n[Instructions]
- Stay in character as ${character.name} at all times
- Write detailed, engaging responses that reflect ${character.name}'s personality and emotions
- Use proper formatting: actions in asterisks, dialogue in quotes, thoughts in parentheses
- Never break character or acknowledge being an AI
- Be aware that other characters (${otherCharacters.map(c => c.name).join(', ')}) are also present and may respond
- You can interact with, refer to, or address other characters naturally
- The user's name is ${userName}
- Keep your response focused - other characters will have their chance to respond`);

  return parts.join('\n');
}

// Build messages array for chat models
function buildGroupChatMessages(
  systemPrompt: string,
  messages: ChatMessage[],
  character: CharacterCard,
  allCharacters: CharacterCard[],
  userName: string = 'User',
  previousResponses?: Array<{ characterName: string; content: string }>
): Array<{ role: 'assistant' | 'user'; content: string }> {
  const chatMessages: Array<{ role: 'assistant' | 'user'; content: string }> = [];

  // System message
  let fullSystemPrompt = systemPrompt;
  
  // Add previous responses from this turn if any
  if (previousResponses && previousResponses.length > 0) {
    fullSystemPrompt += `\n\n[Previous responses in this conversation turn]`;
    for (const resp of previousResponses) {
      fullSystemPrompt += `\n${resp.characterName}: ${resp.content}`;
    }
    fullSystemPrompt += `\n\nNote: The above responses have already been given. Now it's ${character.name}'s turn to respond. Stay in character and provide a unique response that fits naturally after the previous responses.`;
  }
  
  chatMessages.push({ role: 'assistant', content: fullSystemPrompt });

  // Chat history
  const visibleMessages = messages.filter(m => !m.isDeleted);

  for (const msg of visibleMessages) {
    if (msg.role === 'user') {
      chatMessages.push({ role: 'user', content: msg.content });
    } else if (msg.role === 'assistant') {
      chatMessages.push({ role: 'assistant', content: msg.content });
    }
  }

  return chatMessages;
}

// Create a TextEncoder for streaming
const encoder = new TextEncoder();

// Helper to create SSE message
function createSSEResponse(data: string): Uint8Array {
  return encoder.encode(`data: ${data}\n\n`);
}

// Helper to create JSON SSE message
function createSSEJSON(data: object): Uint8Array {
  return createSSEResponse(JSON.stringify(data));
}

// Stream from Z.ai SDK
async function* streamZAI(
  messages: Array<{ role: 'assistant' | 'user'; content: string }>
): AsyncGenerator<string> {
  try {
    const zai = await ZAI.create();

    const response = await zai.chat.completions.create({
      messages: messages,
      thinking: { type: 'disabled' },
      stream: true
    });

    // The SDK returns a ReadableStream, not an async iterable
    const reader = (response as ReadableStream).getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Split by double newline (SSE message separator)
        const messages = buffer.split('\n\n');
        buffer = messages.pop() || '';

        for (const message of messages) {
          // Each message is in format "data: {...}"
          if (!message.startsWith('data: ')) continue;

          const jsonStr = message.slice(6);
          if (jsonStr === '[DONE]') continue;

          try {
            const data = JSON.parse(jsonStr);
            const choices = data.choices as Array<Record<string, unknown>> | undefined;
            const delta = choices?.[0]?.delta as Record<string, unknown> | undefined;
            const content = delta?.content as string | undefined;

            if (content) {
              yield content;
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  } catch (error) {
    console.error('Z.ai streaming error:', error);
    throw new Error(`Z.ai Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Determine responders based on strategy
function getResponders(
  message: string,
  characters: CharacterCard[],
  group: CharacterGroup,
  lastResponderId?: string
): CharacterCard[] {
  const strategy = group.activationStrategy;
  
  // Get active members
  const activeMemberIds = (group.members || [])
    .filter(m => m.isActive && m.isPresent !== false)
    .map(m => m.characterId);
  
  // If no members defined, use characterIds
  const eligibleIds = activeMemberIds.length > 0
    ? activeMemberIds
    : (group.characterIds || []);

  // Filter to only characters that exist and are eligible
  const eligibleCharacters = characters.filter(c => eligibleIds.includes(c.id));

  if (eligibleCharacters.length === 0) {
    return [];
  }

  // Get ordered member IDs
  const orderedIds = (group.members || [])
    .sort((a, b) => a.joinOrder - b.joinOrder)
    .map(m => m.characterId);

  switch (strategy) {
    case 'all': {
      // All active members respond (no limit for 'all' strategy)
      return eligibleCharacters;
    }

    case 'reactive': {
      // Only mentioned characters respond
      const mentions = detectMentions(message, characters, group);
      const mentionedIds = mentions.map(m => m.characterId);
      const mentionedCharacters = eligibleCharacters.filter(c => mentionedIds.includes(c.id));
      
      // If no one is mentioned, default to the first character
      if (mentionedCharacters.length === 0 && eligibleCharacters.length > 0) {
        return [eligibleCharacters[0]];
      }
      
      return mentionedCharacters;
    }

    case 'round_robin': {
      // Take turns in order
      const sortedIds = orderedIds.length > 0 ? orderedIds : eligibleIds;
      
      let nextIndex = 0;
      if (lastResponderId) {
        const lastIndex = sortedIds.indexOf(lastResponderId);
        if (lastIndex !== -1) {
          nextIndex = (lastIndex + 1) % sortedIds.length;
        }
      }
      
      const roundRobinChar = characters.find(c => c.id === sortedIds[nextIndex]);
      return roundRobinChar ? [roundRobinChar] : [];
    }

    case 'random': {
      // Random selection
      const shuffled = [...eligibleCharacters].sort(() => Math.random() - 0.5);
      const maxResponses = group.maxResponsesPerTurn || 1;
      return shuffled.slice(0, Math.min(maxResponses, shuffled.length));
    }

    case 'smart': {
      // AI-like decision: mentioned characters + contextually relevant
      const mentions = detectMentions(message, characters, group);
      const mentionedIds = mentions.map(m => m.characterId);
      const mentionedChars = eligibleCharacters.filter(c => mentionedIds.includes(c.id));
      
      const maxResponses = group.maxResponsesPerTurn || 2;
      
      // Add contextually relevant characters
      const remainingChars = eligibleCharacters.filter(c => !mentionedIds.includes(c.id));
      const additionalCount = Math.max(0, Math.min(maxResponses - mentionedChars.length, 1));
      
      // Check if character name or tags appear in message
      const relevantChars = remainingChars.filter(c => {
        const keywords = [...c.tags, c.name.toLowerCase()];
        return keywords.some(kw => message.toLowerCase().includes(kw.toLowerCase()));
      }).slice(0, additionalCount);

      const result = [...mentionedChars, ...relevantChars].slice(0, maxResponses);
      
      // If no one selected, default to first
      if (result.length === 0 && eligibleCharacters.length > 0) {
        return [eligibleCharacters[0]];
      }
      
      return result;
    }

    default: {
      // Default to first active character
      return eligibleCharacters.slice(0, 1);
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: GroupStreamRequest = await request.json();
    const {
      message,
      group,
      characters,
      messages = [],
      llmConfig,
      userName = 'User',
      persona,
      lastResponderId
    } = body;

    if (!message) {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!group) {
      return new Response(JSON.stringify({ error: 'Group is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!llmConfig) {
      return new Response(JSON.stringify({ error: 'No LLM configuration provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Determine which characters should respond
    const responders = getResponders(message, characters, group, lastResponderId);

    if (responders.length === 0) {
      return new Response(JSON.stringify({ error: 'No active characters to respond' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get effective user name
    const effectiveUserName = persona?.name || userName;

    // Create a TransformStream for SSE
    const stream = new ReadableStream({
      async start(controller) {
        const responsesThisTurn: Array<{ characterId: string; characterName: string; content: string }> = [];

        try {
          // Generate responses sequentially
          for (let i = 0; i < responders.length; i++) {
            const responder = responders[i];

            // Send character_start event
            controller.enqueue(createSSEJSON({
              type: 'character_start',
              characterId: responder.id,
              characterName: responder.name,
              responseIndex: i + 1,
              totalResponses: responders.length
            }));

            // Build system prompt for this character
            const systemPrompt = buildGroupSystemPrompt(
              responder,
              characters,
              group,
              effectiveUserName,
              persona
            );

            // Build chat messages with previous responses from this turn
            const previousResponses = responsesThisTurn.map(r => ({
              characterName: r.characterName,
              content: r.content
            }));

            const chatMessages = buildGroupChatMessages(
              systemPrompt,
              [...messages, {
                id: '',
                characterId: '',
                role: 'user' as const,
                content: message,
                timestamp: '',
                isDeleted: false,
                swipeId: '',
                swipeIndex: 0
              }],
              responder,
              characters,
              effectiveUserName,
              previousResponses
            );

            // Generate response
            let fullContent = '';

            try {
              // Currently only support Z.ai for group streaming
              if (llmConfig.provider !== 'z-ai') {
                throw new Error('Group streaming currently only supports Z.ai provider');
              }

              const generator = streamZAI(chatMessages);

              for await (const chunk of generator) {
                fullContent += chunk;
                // Stream token to client
                controller.enqueue(createSSEJSON({
                  type: 'token',
                  characterId: responder.id,
                  characterName: responder.name,
                  content: chunk
                }));
              }

              // Clean up the response (remove character name prefix if present)
              let cleanedContent = fullContent.trim();
              const namePrefix = `${responder.name}:`;
              const namePrefixAlt = `${responder.name} :`;
              if (cleanedContent.startsWith(namePrefix)) {
                cleanedContent = cleanedContent.slice(namePrefix.length).trim();
              } else if (cleanedContent.startsWith(namePrefixAlt)) {
                cleanedContent = cleanedContent.slice(namePrefixAlt.length).trim();
              }

              // Store response for next character's context
              responsesThisTurn.push({
                characterId: responder.id,
                characterName: responder.name,
                content: cleanedContent
              });

              // Send character_done event
              controller.enqueue(createSSEJSON({
                type: 'character_done',
                characterId: responder.id,
                characterName: responder.name,
                fullContent: cleanedContent
              }));

            } catch (charError) {
              // Send character_error event but continue with other characters
              controller.enqueue(createSSEJSON({
                type: 'character_error',
                characterId: responder.id,
                characterName: responder.name,
                error: charError instanceof Error ? charError.message : 'Unknown error'
              }));
            }
          }

          // Send final done event with all responses
          controller.enqueue(createSSEJSON({
            type: 'done',
            responses: responsesThisTurn
          }));
          controller.close();

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          controller.enqueue(createSSEJSON({ type: 'error', error: errorMessage }));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Group stream error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Failed to stream group response'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
