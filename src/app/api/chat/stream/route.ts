import { NextRequest } from 'next/server';
import type { ChatMessage, CharacterCard, LLMConfig, Persona } from '@/types';
import ZAI from 'z-ai-web-dev-sdk';
import { processCharacterTemplate } from '@/lib/prompt-template';

interface StreamRequest {
  message: string;
  sessionId: string;
  characterId: string;
  character?: CharacterCard;
  messages?: ChatMessage[];
  llmConfig?: LLMConfig;
  userName?: string;
  persona?: Persona;
}

// Build the system prompt from character data (SillyTavern style)
function buildSystemPrompt(character: CharacterCard, userName: string = 'User', persona?: Persona): string {
  const parts: string[] = [];

  // Main system instruction
  parts.push(`You are now in roleplay mode. You will act as ${character.name}.`);
  
  // Add user's persona description if available
  if (persona && persona.description) {
    parts.push(`\n[User's Persona - ${userName}]`);
    parts.push(persona.description);
  }
  
  // Add character description
  if (character.description) {
    parts.push(`\n[Character Description]`);
    parts.push(character.description);
  }

  // Add personality
  if (character.personality) {
    parts.push(`\n[Personality]`);
    parts.push(character.personality);
  }

  // Add scenario
  if (character.scenario) {
    parts.push(`\n[Scenario]`);
    parts.push(character.scenario);
  }

  // Add example messages (important for few-shot learning)
  if (character.mesExample) {
    parts.push(`\n[Example Dialogue]`);
    parts.push(character.mesExample);
  }

  // Add character's note (user-defined instructions for this character)
  if (character.characterNote) {
    parts.push(`\n[Character's Note]`);
    parts.push(character.characterNote);
  }

  // Add custom system prompt from character card
  if (character.systemPrompt) {
    parts.push(`\n${character.systemPrompt}`);
  }

  // Add roleplay instructions
  parts.push(`\n[Instructions]
- Stay in character as ${character.name} at all times
- Write detailed, engaging responses that reflect ${character.name}'s personality and emotions
- Use proper formatting: actions in asterisks, dialogue in quotes, thoughts in parentheses
- Never break character or acknowledge being an AI
- Respond as ${character.name} would, maintaining consistency with the established personality
- The user's name is ${userName}${persona?.description ? `, and their persona has been described above` : ''}`);

  return parts.join('\n');
}

// Build messages array for chat models
function buildChatMessages(
  systemPrompt: string,
  messages: ChatMessage[],
  character: CharacterCard,
  userName: string = 'User',
  postHistoryInstructions?: string
): Array<{ role: 'assistant' | 'user'; content: string }> {
  const chatMessages: Array<{ role: 'assistant' | 'user'; content: string }> = [];
  
  // System message (using 'assistant' role as per Z.ai SDK requirements)
  let fullSystemPrompt = systemPrompt;
  if (postHistoryInstructions) {
    fullSystemPrompt += `\n\n${postHistoryInstructions}`;
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

// Stream from OpenAI-compatible API
async function* streamOpenAICompatible(
  messages: Array<{ role: string; content: string }>,
  config: LLMConfig,
  provider: string = 'openai'
): AsyncGenerator<string> {
  const endpoint = config.endpoint.replace(/\/$/, '');
  
  const requestBody: Record<string, unknown> = {
    model: config.model || 'gpt-3.5-turbo',
    messages: messages,
    max_tokens: config.parameters.maxTokens,
    temperature: config.parameters.temperature,
    top_p: config.parameters.topP,
    stream: true
  };

  if (provider === 'openai') {
    requestBody.frequency_penalty = config.parameters.frequencyPenalty;
    requestBody.presence_penalty = config.parameters.presencePenalty;
    if (config.parameters.stopStrings?.length) {
      requestBody.stop = config.parameters.stopStrings;
    }
  }

  const response = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` })
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(120000)
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = errorText;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error?.message || errorJson.message || errorText;
    } catch {
      // Keep original error text
    }
    throw new Error(`${provider} Error (${response.status}): ${errorMessage}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue;
        
        const data = trimmedLine.slice(6);
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content || '';
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
}

// Stream from Ollama API
async function* streamOllama(
  prompt: string,
  config: LLMConfig
): AsyncGenerator<string> {
  const endpoint = config.endpoint.replace(/\/$/, '');
  
  const response = await fetch(`${endpoint}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model || 'llama2',
      prompt: prompt,
      stream: true,
      options: {
        temperature: config.parameters.temperature,
        top_p: config.parameters.topP,
        top_k: config.parameters.topK,
        num_predict: config.parameters.maxTokens,
        stop: config.parameters.stopStrings?.length ? config.parameters.stopStrings : undefined
      }
    }),
    signal: AbortSignal.timeout(120000)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ollama Error (${response.status}): ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value, { stream: true });
      const lines = text.split('\n').filter(Boolean);

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.response) {
            yield parsed.response;
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// Build prompt for completion-style APIs
function buildCompletionPrompt(
  systemPrompt: string,
  messages: ChatMessage[],
  character: CharacterCard,
  userName: string = 'User',
  postHistoryInstructions?: string
): string {
  const parts: string[] = [];
  
  parts.push(systemPrompt);
  parts.push('\n---\n');
  
  const visibleMessages = messages.filter(m => !m.isDeleted);
  
  for (const msg of visibleMessages) {
    if (msg.role === 'user') {
      parts.push(`${userName}: ${msg.content}`);
    } else if (msg.role === 'assistant') {
      parts.push(`${character.name}: ${msg.content}`);
    }
  }
  
  if (postHistoryInstructions) {
    parts.push(`\n${postHistoryInstructions}`);
  }
  
  parts.push(`\n${character.name}:`);
  
  return parts.join('\n');
}

// Stream from Text Generation WebUI / KoboldCPP API
async function* streamTextGenerationWebUI(
  prompt: string,
  config: LLMConfig
): AsyncGenerator<string> {
  const endpoint = config.endpoint.replace(/\/$/, '');
  
  const response = await fetch(`${endpoint}/api/v1/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` })
    },
    body: JSON.stringify({
      prompt: prompt,
      max_new_tokens: config.parameters.maxTokens,
      temperature: config.parameters.temperature,
      top_p: config.parameters.topP,
      top_k: config.parameters.topK,
      repetition_penalty: config.parameters.repetitionPenalty,
      stop: config.parameters.stopStrings?.length ? config.parameters.stopStrings : undefined,
      stream: true
    }),
    signal: AbortSignal.timeout(60000)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Text Generation WebUI Error (${response.status}): ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        try {
          const parsed = JSON.parse(trimmedLine);
          const content = parsed.results?.[0]?.text || parsed.text || '';
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
}

// Stream from Anthropic API
async function* streamAnthropic(
  messages: Array<{ role: string; content: string }>,
  config: LLMConfig
): AsyncGenerator<string> {
  const endpoint = config.endpoint.replace(/\/$/, '');
  
  const systemMessage = messages.find(m => m.role === 'system');
  const chatMessages = messages.filter(m => m.role !== 'system');
  
  const response = await fetch(`${endpoint}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey || '',
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: config.model || 'claude-3-sonnet-20240229',
      max_tokens: config.parameters.maxTokens,
      system: systemMessage?.content,
      messages: chatMessages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      })),
      temperature: config.parameters.temperature,
      top_p: config.parameters.topP,
      stream: true
    }),
    signal: AbortSignal.timeout(120000)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic Error (${response.status}): ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue;
        
        const data = trimmedLine.slice(6);

        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            yield parsed.delta.text;
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: StreamRequest = await request.json();
    const { 
      message, 
      character, 
      messages = [], 
      llmConfig,
      userName = 'User',
      persona
    } = body;

    if (!message) {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
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

    // Create default character if none provided
    const effectiveCharacter: CharacterCard = character || {
      id: 'default',
      name: 'Assistant',
      description: '',
      personality: '',
      scenario: '',
      firstMes: 'Hello! How can I help you today?',
      mesExample: '',
      creatorNotes: '',
      characterNote: '',
      systemPrompt: '',
      postHistoryInstructions: '',
      alternateGreetings: [],
      tags: [],
      avatar: '',
      sprites: [],
      voice: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Get effective user name from persona or use provided userName
    const effectiveUserName = persona?.name || userName;
    
    // Process character template variables ({{user}}, {{char}}, etc.)
    const processedCharacter = processCharacterTemplate(effectiveCharacter, effectiveUserName, persona);
    
    // Build system prompt with persona (using processed character)
    const systemPrompt = buildSystemPrompt(processedCharacter, effectiveUserName, persona);
    
    // Prepare messages with new user message
    const allMessages = [...messages, {
      id: '',
      characterId: '',
      role: 'user' as const,
      content: message,
      timestamp: '',
      isDeleted: false,
      swipeId: '',
      swipeIndex: 0
    }];

    // Create a TransformStream for SSE
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let generator: AsyncGenerator<string>;

          // Route to appropriate provider
          switch (llmConfig.provider) {
            case 'z-ai': {
              // Z.ai uses its own SDK
              const chatMessages = buildChatMessages(
                systemPrompt,
                allMessages,
                processedCharacter,
                effectiveUserName,
                processedCharacter.postHistoryInstructions
              );
              generator = streamZAI(chatMessages);
              break;
            }
            
            case 'openai':
            case 'vllm':
            case 'custom': {
              // These need a valid endpoint
              if (!llmConfig.endpoint) {
                throw new Error(`${llmConfig.provider} requires an endpoint URL`);
              }
              const chatMessages = buildChatMessages(
                systemPrompt,
                allMessages,
                processedCharacter,
                effectiveUserName,
                processedCharacter.postHistoryInstructions
              );
              // Convert to OpenAI format (system role instead of assistant for system)
              const openaiMessages = chatMessages.map(m => ({
                role: m.role === 'assistant' && chatMessages.indexOf(m) === 0 ? 'system' : m.role,
                content: m.content
              }));
              generator = streamOpenAICompatible(openaiMessages, llmConfig, llmConfig.provider);
              break;
            }
            
            case 'anthropic': {
              if (!llmConfig.apiKey) {
                throw new Error('Anthropic requires an API key');
              }
              const chatMessages = buildChatMessages(
                systemPrompt,
                allMessages,
                processedCharacter,
                effectiveUserName,
                processedCharacter.postHistoryInstructions
              );
              const anthropicMessages = chatMessages.map(m => ({
                role: m.role === 'assistant' && chatMessages.indexOf(m) === 0 ? 'system' : m.role,
                content: m.content
              }));
              generator = streamAnthropic(anthropicMessages, llmConfig);
              break;
            }
            
            case 'ollama': {
              const prompt = buildCompletionPrompt(
                systemPrompt,
                allMessages,
                processedCharacter,
                effectiveUserName,
                processedCharacter.postHistoryInstructions
              );
              generator = streamOllama(prompt, llmConfig);
              break;
            }
            
            case 'text-generation-webui':
            case 'koboldcpp':
            default: {
              const prompt = buildCompletionPrompt(
                systemPrompt,
                allMessages,
                processedCharacter,
                effectiveUserName,
                processedCharacter.postHistoryInstructions
              );
              generator = streamTextGenerationWebUI(prompt, llmConfig);
              break;
            }
          }

          // Stream the response
          for await (const chunk of generator) {
            controller.enqueue(createSSEJSON({ type: 'token', content: chunk }));
          }

          // Send done signal
          controller.enqueue(createSSEJSON({ type: 'done' }));
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
    console.error('Stream error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Failed to stream response' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
