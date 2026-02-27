import { NextRequest, NextResponse } from 'next/server';
import type { ChatMessage, CharacterCard, LLMConfig, Persona } from '@/types';
import ZAI from 'z-ai-web-dev-sdk';
import { processCharacterTemplate, processMessageTemplate } from '@/lib/prompt-template';

interface GenerateRequest {
  message: string;
  sessionId: string;
  characterId: string;
  character?: CharacterCard;
  messages?: ChatMessage[];
  llmConfig?: LLMConfig;
  userName?: string;
  persona?: Persona;
}

interface GenerateResponse {
  message: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model?: string;
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

// Call Z.ai using the SDK
async function callZAI(
  messages: Array<{ role: 'assistant' | 'user'; content: string }>
): Promise<GenerateResponse> {
  try {
    const zai = await ZAI.create();

    const completion = await zai.chat.completions.create({
      messages: messages,
      thinking: { type: 'disabled' }
    });

    const response = completion.choices[0]?.message?.content || '';

    return {
      message: response,
      usage: {
        promptTokens: completion.usage?.prompt_tokens || 0,
        completionTokens: completion.usage?.completion_tokens || 0,
        totalTokens: completion.usage?.total_tokens || 0
      },
      model: completion.model || 'z-ai'
    };
  } catch (error) {
    throw new Error(`Z.ai Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Call OpenAI-compatible API
async function callOpenAICompatible(
  messages: Array<{ role: string; content: string }>,
  config: LLMConfig,
  provider: string = 'openai'
): Promise<GenerateResponse> {
  const endpoint = config.endpoint.replace(/\/$/, '');
  
  const requestBody: Record<string, unknown> = {
    model: config.model || 'gpt-3.5-turbo',
    messages: messages,
    max_tokens: config.parameters.maxTokens,
    temperature: config.parameters.temperature,
    top_p: config.parameters.topP,
    stream: false
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

  const data = await response.json();
  
  return {
    message: data.choices?.[0]?.message?.content || '',
    usage: {
      promptTokens: data.usage?.prompt_tokens || 0,
      completionTokens: data.usage?.completion_tokens || 0,
      totalTokens: data.usage?.total_tokens || 0
    },
    model: data.model || config.model
  };
}

// Call Ollama API
async function callOllama(
  prompt: string,
  config: LLMConfig
): Promise<GenerateResponse> {
  const endpoint = config.endpoint.replace(/\/$/, '');
  
  const response = await fetch(`${endpoint}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model || 'llama2',
      prompt: prompt,
      stream: false,
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

  const data = await response.json();
  
  return {
    message: data.response || '',
    usage: {
      promptTokens: data.prompt_eval_count || 0,
      completionTokens: data.eval_count || 0,
      totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0)
    },
    model: data.model || config.model
  };
}

// Call Text Generation WebUI / KoboldCPP API
async function callTextGenerationWebUI(
  prompt: string,
  config: LLMConfig
): Promise<GenerateResponse> {
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
      stream: false
    }),
    signal: AbortSignal.timeout(60000)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Text Generation WebUI Error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  
  return {
    message: data.results?.[0]?.text || data.text || '',
    usage: {
      promptTokens: data.prompt_tokens || 0,
      completionTokens: data.completion_tokens || 0,
      totalTokens: (data.prompt_tokens || 0) + (data.completion_tokens || 0)
    },
    model: data.model || config.model
  };
}

// Call Anthropic API
async function callAnthropic(
  messages: Array<{ role: string; content: string }>,
  config: LLMConfig
): Promise<GenerateResponse> {
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
      top_p: config.parameters.topP
    }),
    signal: AbortSignal.timeout(120000)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic Error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  
  return {
    message: data.content?.[0]?.text || '',
    usage: {
      promptTokens: data.usage?.input_tokens || 0,
      completionTokens: data.usage?.output_tokens || 0,
      totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
    },
    model: data.model || config.model
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateRequest = await request.json();
    const { 
      message, 
      character, 
      messages = [], 
      llmConfig,
      userName = 'User',
      persona
    } = body;

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    if (!llmConfig) {
      return NextResponse.json(
        { error: 'No LLM configuration provided. Please configure an LLM connection in settings.' },
        { status: 400 }
      );
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

    let response: GenerateResponse;

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
        response = await callZAI(chatMessages);
        break;
      }
      
      case 'openai':
      case 'vllm':
      case 'custom': {
        // These need a valid endpoint
        if (!llmConfig.endpoint) {
          throw new Error(`${llmConfig.provider} requires an endpoint URL. Please configure it in settings.`);
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
        response = await callOpenAICompatible(openaiMessages, llmConfig, llmConfig.provider);
        break;
      }
      
      case 'anthropic': {
        if (!llmConfig.apiKey) {
          throw new Error('Anthropic requires an API key. Please configure it in settings.');
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
        response = await callAnthropic(anthropicMessages, llmConfig);
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
        response = await callOllama(prompt, llmConfig);
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
        response = await callTextGenerationWebUI(prompt, llmConfig);
        break;
      }
    }

    // Clean up response
    let cleanedMessage = response.message.trim();
    
    // Remove character name prefix if present
    const namePrefix = `${processedCharacter.name}:`;
    if (cleanedMessage.startsWith(namePrefix)) {
      cleanedMessage = cleanedMessage.slice(namePrefix.length).trim();
    }

    return NextResponse.json({
      message: cleanedMessage,
      usage: response.usage,
      model: response.model
    });

  } catch (error) {
    console.error('Generate error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate response';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
