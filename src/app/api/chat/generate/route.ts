// ============================================
// Chat Generate Route - Refactored with shared modules
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import type { CharacterCard } from '@/types';
import {
  DEFAULT_CHARACTER,
  buildSystemPrompt,
  buildChatMessages,
  buildCompletionPrompt,
  getEffectiveUserName,
  processCharacter,
  createUserMessage,
  callZAI,
  callOpenAICompatible,
  callAnthropic,
  callOllama,
  callTextGenerationWebUI,
  GenerateResponse
} from '@/lib/llm';
import {
  validateRequest,
  sanitizeInput
} from '@/lib/validations';
import {
  selectContextMessages,
  type ContextConfig
} from '@/lib/context-manager';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request (automatically detects request type)
    const validation = validateRequest(null, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }
    
    const {
      message,
      character,
      messages = [],
      llmConfig,
      userName = 'User',
      persona
    } = validation.data;

    if (!llmConfig) {
      return NextResponse.json(
        { error: 'No LLM configuration provided. Please configure an LLM connection in settings.' },
        { status: 400 }
      );
    }

    // Sanitize user message
    const sanitizedMessage = sanitizeInput(message);
    
    // Create default character if none provided
    const effectiveCharacter: CharacterCard = character || DEFAULT_CHARACTER;

    // Get effective user name from persona or use provided userName
    const effectiveUserName = getEffectiveUserName(persona, userName);

    // Process character template variables ({{user}}, {{char}}, etc.)
    const processedCharacter = processCharacter(effectiveCharacter, effectiveUserName, persona);

    // Build context configuration from request or use defaults
    const contextConfig: Partial<ContextConfig> = body.contextConfig || {};

    // Apply sliding window to messages
    const contextWindow = selectContextMessages(messages, llmConfig, contextConfig);

    // Build system prompt with persona (using processed character)
    const { prompt: systemPrompt } = buildSystemPrompt(processedCharacter, effectiveUserName, persona);

    // Prepare messages with new user message (use context-windowed messages)
    const allMessages = [...contextWindow.messages, createUserMessage(sanitizedMessage)];

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
          processedCharacter.postHistoryInstructions,
          true // Use system role for OpenAI
        );
        response = await callOpenAICompatible(chatMessages, llmConfig, llmConfig.provider);
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
          processedCharacter.postHistoryInstructions,
          true // Use system role for Anthropic
        );
        response = await callAnthropic(chatMessages, llmConfig);
        break;
      }

      case 'ollama': {
        const prompt = buildCompletionPrompt({
          systemPrompt,
          messages: allMessages,
          character: processedCharacter,
          userName: effectiveUserName,
          postHistoryInstructions: processedCharacter.postHistoryInstructions
        });
        response = await callOllama(prompt, llmConfig);
        break;
      }

      case 'text-generation-webui':
      case 'koboldcpp':
      default: {
        const prompt = buildCompletionPrompt({
          systemPrompt,
          messages: allMessages,
          character: processedCharacter,
          userName: effectiveUserName,
          postHistoryInstructions: processedCharacter.postHistoryInstructions
        });
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
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate response';

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
