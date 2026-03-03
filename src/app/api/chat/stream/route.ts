// ============================================
// Chat Stream Route - Refactored with shared modules
// ============================================

import { NextRequest } from 'next/server';
import type { ChatMessage, CharacterCard, LLMConfig, Persona, PromptSection, Lorebook, SessionStats, HUDContextConfig, Quest, QuestSettings } from '@/types';
import {
  StreamRequest,
  DEFAULT_CHARACTER,
  createSSEJSON,
  createErrorResponse,
  createSSEStreamResponse,
  buildSystemPrompt,
  buildChatHistorySections,
  buildPostHistorySection,
  buildChatMessages,
  buildCompletionPrompt,
  getEffectiveUserName,
  processCharacter,
  createUserMessage,
  streamZAI,
  streamOpenAICompatible,
  streamAnthropic,
  streamOllama,
  streamTextGenerationWebUI,
  buildLorebookSectionForPrompt,
  buildHUDContextSection,
  injectHUDContextIntoMessages,
  injectHUDContextIntoSections
} from '@/lib/llm';
import {
  validateRequest,
  sanitizeInput
} from '@/lib/validations';
import {
  selectContextMessages,
  getContextStats,
  type ContextConfig
} from '@/lib/context-manager';
import { buildQuestPromptSection } from '@/lib/triggers/handlers/quest-handler';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request (automatically detects request type)
    const validation = validateRequest(null, body);
    if (!validation.success) {
      return createErrorResponse(validation.error, 400);
    }

    const {
      message,
      character,
      messages = [],
      llmConfig,
      userName = 'User',
      persona,
      sessionStats
    } = validation.data;

    // Extract lorebooks from body (not validated by validation.ts)
    const lorebooks: Lorebook[] = body.lorebooks || [];

    // Extract HUD context from body
    const hudContext: HUDContextConfig | undefined = body.hudContext;

    // Extract Quest data for pre-LLM integration
    const quests: Quest[] = body.quests || [];
    const questSettings: QuestSettings | undefined = body.questSettings;

    // Cast sessionStats to proper type
    const typedSessionStats = sessionStats as SessionStats | undefined;

    if (!llmConfig) {
      return createErrorResponse('No LLM configuration provided', 400);
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

    // Log context stats (for debugging)
    const stats = getContextStats(messages);

    // Process lorebooks and get matched entries
    const { section: lorebookSection } = buildLorebookSectionForPrompt(
      messages,
      lorebooks,
      {
        scanDepth: contextConfig.scanDepth,
        tokenBudget: 2048
      }
    );

    // Build system prompt with persona and lorebook (using processed character)
    const { prompt: systemPrompt, sections: systemSections } = buildSystemPrompt(
      processedCharacter,
      effectiveUserName,
      persona,
      lorebookSection,
      typedSessionStats  // Pass session stats for attribute values
    );

    // Build HUD context section if enabled
    const hudContextSection = hudContext ? buildHUDContextSection(hudContext) : null;

    // Build quest section if enabled (pre-LLM integration)
    let questSection: PromptSection | null = null;
    if (questSettings?.enabled && questSettings?.promptInclude && quests.length > 0) {
      const questPromptContent = buildQuestPromptSection(quests, questSettings.promptTemplate);
      if (questPromptContent) {
        questSection = {
          type: 'lorebook',
          label: 'Active Quests',
          content: questPromptContent,
          color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
        };
      }
    }

    // Build all prompt sections for storage
    const chatHistorySections = buildChatHistorySections(contextWindow.messages, processedCharacter.name, effectiveUserName);
    const postHistorySection = buildPostHistorySection(processedCharacter.postHistoryInstructions);

    // Combine all sections in order
    let allPromptSections: PromptSection[] = [
      ...systemSections,
      ...(questSection ? [questSection] : []),
      ...chatHistorySections,
      ...(postHistorySection ? [postHistorySection] : [])
    ];

    // Inject HUD context into sections if enabled
    if (hudContextSection && hudContext) {
      allPromptSections = injectHUDContextIntoSections(allPromptSections, hudContextSection, hudContext.position);
    }

    // Build the final system prompt (include quest section if present)
    let finalSystemPrompt = systemPrompt;
    if (questSection) {
      finalSystemPrompt += `\n\n[${questSection.label}]\n${questSection.content}`;
    }

    // Prepare messages with new user message (use context-windowed messages)
    const allMessages = [...contextWindow.messages, createUserMessage(sanitizedMessage)];

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
              // Z.ai uses its own SDK
              let chatMessages = buildChatMessages(
                finalSystemPrompt,
                allMessages,
                processedCharacter,
                effectiveUserName,
                processedCharacter.postHistoryInstructions
              );
              // Inject HUD context into chat messages if enabled
              if (hudContextSection && hudContext) {
                chatMessages = injectHUDContextIntoMessages(chatMessages, hudContextSection, hudContext.position);
              }
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
              let chatMessages = buildChatMessages(
                finalSystemPrompt,
                allMessages,
                processedCharacter,
                effectiveUserName,
                processedCharacter.postHistoryInstructions,
                true // Use system role for OpenAI
              );
              // Inject HUD context into chat messages if enabled
              if (hudContextSection && hudContext) {
                chatMessages = injectHUDContextIntoMessages(chatMessages, hudContextSection, hudContext.position);
              }
              generator = streamOpenAICompatible(chatMessages, llmConfig, llmConfig.provider);
              break;
            }

            case 'anthropic': {
              if (!llmConfig.apiKey) {
                throw new Error('Anthropic requires an API key');
              }
              let chatMessages = buildChatMessages(
                finalSystemPrompt,
                allMessages,
                processedCharacter,
                effectiveUserName,
                processedCharacter.postHistoryInstructions,
                true // Use system role for Anthropic
              );
              // Inject HUD context into chat messages if enabled
              if (hudContextSection && hudContext) {
                chatMessages = injectHUDContextIntoMessages(chatMessages, hudContextSection, hudContext.position);
              }
              generator = streamAnthropic(chatMessages, llmConfig);
              break;
            }

            case 'ollama': {
              const prompt = buildCompletionPrompt({
                systemPrompt: finalSystemPrompt,
                messages: allMessages,
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
                systemPrompt: finalSystemPrompt,
                messages: allMessages,
                character: processedCharacter,
                userName: effectiveUserName,
                postHistoryInstructions: processedCharacter.postHistoryInstructions
              });
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

    return createSSEStreamResponse(stream);
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to stream response',
      500
    );
  }
}
