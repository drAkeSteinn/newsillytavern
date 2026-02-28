// ============================================
// Chat Regenerate Route - Generate swipe alternative
// ============================================

import { NextRequest } from 'next/server';
import type { CharacterCard, PromptSection } from '@/types';
import {
  DEFAULT_CHARACTER,
  createSSEJSON,
  createErrorResponse,
  createSSEStreamResponse,
  cleanResponseContent,
  buildSystemPrompt,
  buildChatHistorySections,
  buildPostHistorySection,
  buildChatMessages,
  buildCompletionPrompt,
  getEffectiveUserName,
  processCharacter,
  streamZAI,
  streamOpenAICompatible,
  streamAnthropic,
  streamOllama,
  streamTextGenerationWebUI
} from '@/lib/llm';
import {
  validateRequest,
  sanitizeInput
} from '@/lib/validations';
import {
  selectContextMessages,
  type ContextConfig
} from '@/lib/context-manager';
import { z } from 'zod';

// Request schema for regenerate
const regenerateRequestSchema = z.object({
  sessionId: z.string().min(1),
  messageId: z.string().min(1),
  character: z.any().optional(),
  messages: z.array(z.any()).optional(),
  llmConfig: z.any(),
  userName: z.string().optional(),
  persona: z.any().optional(),
  contextConfig: z.any().optional()
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request
    const validation = validateRequest(regenerateRequestSchema, body);
    if (!validation.success) {
      return createErrorResponse(validation.error, 400);
    }
    
    const {
      sessionId,
      messageId,
      character,
      messages = [],
      llmConfig,
      userName = 'User',
      persona,
      contextConfig
    } = validation.data;

    if (!llmConfig) {
      return createErrorResponse('No LLM configuration provided', 400);
    }

    // Find the message to regenerate
    const messageToRegenerate = messages.find((m: { id: string }) => m.id === messageId);
    if (!messageToRegenerate) {
      return createErrorResponse('Message not found', 404);
    }

    // Only regenerate assistant messages
    if (messageToRegenerate.role !== 'assistant') {
      return createErrorResponse('Can only regenerate assistant messages', 400);
    }

    // Create default character if none provided
    const effectiveCharacter: CharacterCard = character || DEFAULT_CHARACTER;

    // Get effective user name from persona or use provided userName
    const effectiveUserName = getEffectiveUserName(persona, userName);

    // Process character template variables ({{user}}, {{char}}, etc.)
    const processedCharacter = processCharacter(effectiveCharacter, effectiveUserName, persona);

    // Get messages before the one to regenerate
    const messageIndex = messages.findIndex((m: { id: string }) => m.id === messageId);
    const messagesBeforeRegenerate = messages.slice(0, messageIndex);

    // Build context configuration from request or use defaults
    const ctxConfig: Partial<ContextConfig> = contextConfig || {};

    // Apply sliding window to messages
    const contextWindow = selectContextMessages(messagesBeforeRegenerate, llmConfig, ctxConfig);

    // Build system prompt with persona (using processed character)
    const { prompt: systemPrompt, sections: systemSections } = buildSystemPrompt(
      processedCharacter,
      effectiveUserName,
      persona
    );

    // Build all prompt sections for storage
    const chatHistorySections = buildChatHistorySections(contextWindow.messages, processedCharacter.name, effectiveUserName);
    const postHistorySection = buildPostHistorySection(processedCharacter.postHistoryInstructions);

    // Combine all sections in order
    const allPromptSections: PromptSection[] = [
      ...systemSections,
      ...chatHistorySections,
      ...(postHistorySection ? [postHistorySection] : [])
    ];

    // Create a TransformStream for SSE
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send prompt data at the start
          controller.enqueue(createSSEJSON({
            type: 'prompt_data',
            promptSections: allPromptSections
          }));

          let generator: AsyncGenerator<string>;

          // Route to appropriate provider
          switch (llmConfig.provider) {
            case 'z-ai': {
              const chatMessages = buildChatMessages(
                systemPrompt,
                contextWindow.messages,
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
              if (!llmConfig.endpoint) {
                throw new Error(`${llmConfig.provider} requires an endpoint URL`);
              }
              const chatMessages = buildChatMessages(
                systemPrompt,
                contextWindow.messages,
                processedCharacter,
                effectiveUserName,
                processedCharacter.postHistoryInstructions,
                true
              );
              generator = streamOpenAICompatible(chatMessages, llmConfig, llmConfig.provider);
              break;
            }

            case 'anthropic': {
              if (!llmConfig.apiKey) {
                throw new Error('Anthropic requires an API key');
              }
              const chatMessages = buildChatMessages(
                systemPrompt,
                contextWindow.messages,
                processedCharacter,
                effectiveUserName,
                processedCharacter.postHistoryInstructions,
                true
              );
              generator = streamAnthropic(chatMessages, llmConfig);
              break;
            }

            case 'ollama': {
              const prompt = buildCompletionPrompt({
                systemPrompt,
                messages: contextWindow.messages,
                character: processedCharacter,
                userName: effectiveUserName,
                postHistoryInstructions: processedCharacter.postHistoryInstructions
              });
              generator = streamOllama(prompt, llmConfig);
              break;
            }

            case 'text-generation-webui':
            case 'koboldcpp':
            default: {
              const prompt = buildCompletionPrompt({
                systemPrompt,
                messages: contextWindow.messages,
                character: processedCharacter,
                userName: effectiveUserName,
                postHistoryInstructions: processedCharacter.postHistoryInstructions
              });
              generator = streamTextGenerationWebUI(prompt, llmConfig);
              break;
            }
          }

          let fullContent = '';
          
          // Stream the response
          for await (const chunk of generator) {
            fullContent += chunk;
            controller.enqueue(createSSEJSON({ type: 'token', content: chunk }));
          }

          // Clean response
          const cleanedContent = cleanResponseContent(fullContent, processedCharacter.name);

          // Send done signal with the full content
          controller.enqueue(createSSEJSON({ 
            type: 'done', 
            content: cleanedContent,
            messageId,
            sessionId
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
      error instanceof Error ? error.message : 'Failed to regenerate response',
      500
    );
  }
}
