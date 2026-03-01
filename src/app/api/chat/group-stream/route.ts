// ============================================
// Group Stream Route - Refactored with shared modules
// ============================================

import { NextRequest } from 'next/server';
import type { ChatMessage, CharacterCard, CharacterGroup, PromptSection, Lorebook } from '@/types';
import {
  createSSEJSON,
  createErrorResponse,
  createSSEStreamResponse,
  cleanResponseContent,
  buildGroupSystemPrompt,
  buildGroupChatMessages,
  getEffectiveUserName,
  createUserMessage,
  streamZAI,
  streamOpenAICompatible,
  streamAnthropic,
  streamOllama,
  streamTextGenerationWebUI,
  buildLorebookSectionForPrompt
} from '@/lib/llm';
import {
  validateRequest,
  sanitizeInput
} from '@/lib/validations';
import {
  selectContextMessages,
  type ContextConfig
} from '@/lib/context-manager';
import { detectMentions } from '@/lib/mention-detector';

// ============================================
// Responder Selection Logic
// ============================================

/**
 * Determine responders based on strategy
 */
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

// ============================================
// Main Route Handler
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request (automatically detects group request)
    const validation = validateRequest(null, body);
    if (!validation.success) {
      return createErrorResponse(validation.error, 400);
    }
    
    const {
      message,
      group,
      characters,
      messages = [],
      llmConfig,
      userName = 'User',
      persona,
      lastResponderId
    } = validation.data;

    // Extract lorebooks from body (not validated by validation.ts)
    const lorebooks: Lorebook[] = body.lorebooks || [];

    if (!llmConfig) {
      return createErrorResponse('No LLM configuration provided', 400);
    }

    // Sanitize user message
    const sanitizedMessage = sanitizeInput(message);

    // Determine which characters should respond
    const responders = getResponders(sanitizedMessage, characters, group, lastResponderId);

    if (responders.length === 0) {
      return createErrorResponse('No active characters to respond', 400);
    }

    // Get effective user name
    const effectiveUserName = getEffectiveUserName(persona, userName);

    // Build context configuration from request or use defaults
    const contextConfig: Partial<ContextConfig> = body.contextConfig || {};

    // Apply sliding window to messages
    const contextWindow = selectContextMessages(messages, llmConfig, contextConfig);

    // Process lorebooks and get matched entries
    const { section: lorebookSection } = buildLorebookSectionForPrompt(
      messages,
      lorebooks,
      {
        scanDepth: contextConfig.scanDepth,
        tokenBudget: 2048
      }
    );

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
            const { prompt: systemPrompt, sections: promptSections } = buildGroupSystemPrompt(
              responder,
              characters,
              group,
              effectiveUserName,
              persona,
              lorebookSection
            );

            // Build chat messages with previous responses from this turn
            const previousResponses = responsesThisTurn.map(r => ({
              characterName: r.characterName,
              content: r.content
            }));

            const { chatMessages, chatHistorySection } = buildGroupChatMessages(
              systemPrompt,
              [...contextWindow.messages, createUserMessage(sanitizedMessage)],
              responder,
              characters,
              effectiveUserName,
              previousResponses
            );

            // Combine prompt sections with chat history for the viewer
            const allPromptSections: PromptSection[] = chatHistorySection
              ? [...promptSections, chatHistorySection]
              : promptSections;

            // Generate response
            let fullContent = '';

            try {
              // Get the appropriate streaming generator based on provider
              let generator: AsyncGenerator<string>;

              switch (llmConfig.provider) {
                case 'z-ai': {
                  generator = streamZAI(chatMessages);
                  break;
                }

                case 'openai':
                case 'vllm':
                case 'custom': {
                  if (!llmConfig.endpoint) {
                    throw new Error(`${llmConfig.provider} requires an endpoint URL`);
                  }
                  // Convert assistant role to system for first message
                  const openaiMessages = chatMessages.map((m, idx) => ({
                    role: m.role === 'assistant' && idx === 0 ? 'system' : m.role,
                    content: m.content
                  }));
                  generator = streamOpenAICompatible(openaiMessages, llmConfig, llmConfig.provider);
                  break;
                }

                case 'anthropic': {
                  if (!llmConfig.apiKey) {
                    throw new Error('Anthropic requires an API key');
                  }
                  // Convert assistant role to system for first message
                  const anthropicMessages = chatMessages.map((m, idx) => ({
                    role: m.role === 'assistant' && idx === 0 ? 'system' : m.role,
                    content: m.content
                  }));
                  generator = streamAnthropic(anthropicMessages, llmConfig);
                  break;
                }

                case 'ollama': {
                  // Build completion prompt for Ollama
                  const prompt = buildGroupCompletionPrompt(
                    systemPrompt,
                    [...contextWindow.messages, createUserMessage(sanitizedMessage)],
                    responder,
                    effectiveUserName,
                    previousResponses
                  );
                  generator = streamOllama(prompt, llmConfig);
                  break;
                }

                case 'text-generation-webui':
                case 'koboldcpp':
                default: {
                  // Build completion prompt for Text Generation WebUI
                  const prompt = buildGroupCompletionPrompt(
                    systemPrompt,
                    [...contextWindow.messages, createUserMessage(sanitizedMessage)],
                    responder,
                    effectiveUserName,
                    previousResponses
                  );
                  generator = streamTextGenerationWebUI(prompt, llmConfig);
                  break;
                }
              }

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
              const cleanedContent = cleanResponseContent(fullContent, responder.name);

              // Store response for next character's context
              responsesThisTurn.push({
                characterId: responder.id,
                characterName: responder.name,
                content: cleanedContent
              });

              // Send character_done event with prompt sections (including chat history)
              controller.enqueue(createSSEJSON({
                type: 'character_done',
                characterId: responder.id,
                characterName: responder.name,
                fullContent: cleanedContent,
                promptSections: allPromptSections
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

    return createSSEStreamResponse(stream);
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to stream group response',
      500
    );
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Build completion prompt for group chat (for Ollama, Text Generation WebUI, etc.)
 */
function buildGroupCompletionPrompt(
  systemPrompt: string,
  messages: ChatMessage[],
  character: CharacterCard,
  userName: string,
  previousResponses?: Array<{ characterName: string; content: string }>
): string {
  const parts: string[] = [];

  parts.push(systemPrompt);
  parts.push('\n---\n');

  // Add previous responses from this turn
  if (previousResponses && previousResponses.length > 0) {
    parts.push('[Previous responses in this turn]');
    for (const resp of previousResponses) {
      parts.push(`${resp.characterName}: ${resp.content}`);
    }
    parts.push('');
  }

  const visibleMessages = messages.filter(m => !m.isDeleted);

  for (const msg of visibleMessages) {
    if (msg.role === 'user') {
      parts.push(`${userName}: ${msg.content}`);
    } else if (msg.role === 'assistant') {
      parts.push(`${character.name}: ${msg.content}`);
    }
  }

  parts.push(`\n${character.name}:`);

  return parts.join('\n');
}
