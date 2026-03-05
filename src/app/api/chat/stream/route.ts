// ============================================
// Chat Stream Route - Simplified with unified key resolution
// ============================================
//
// Key resolution happens in buildSystemPrompt():
// - Template variables: {{user}}, {{char}}, {{userpersona}}
// - Stats keys: {{resistencia}}, {{habilidades}}, etc.
// - All sections are processed consistently

import { NextRequest } from 'next/server';
import type { ChatMessage, CharacterCard, LLMConfig, Persona, PromptSection, Lorebook, SessionStats, HUDContextConfig, QuestSettings, QuestTemplate, SessionQuestInstance } from '@/types';
import { DEFAULT_QUEST_SETTINGS } from '@/types';
import {
  DEFAULT_CHARACTER,
  createSSEJSON,
  createErrorResponse,
  createSSEStreamResponse,
  buildSystemPrompt,
  buildChatHistorySections,
  buildChatMessages,
  buildCompletionPrompt,
  getEffectiveUserName,
  createUserMessage,
  streamZAI,
  streamOpenAICompatible,
  streamAnthropic,
  streamOllama,
  streamTextGenerationWebUI,
  buildLorebookSectionForPrompt,
  buildHUDContextSection,
  injectHUDContextIntoMessages,
  injectHUDContextIntoSections,
  resolveAllKeys,
  buildKeyResolutionContext,
  resolveStats,
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

    // Extract Quest data for pre-LLM integration (NEW FORMAT)
    const questTemplates: QuestTemplate[] = body.questTemplates || [];
    const sessionQuests: SessionQuestInstance[] = body.sessionQuests || [];
    const questSettings: QuestSettings = {
      ...DEFAULT_QUEST_SETTINGS,
      ...(body.questSettings || {})
    };

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

    // ========================================
    // Build system prompt with unified key resolution
    // ========================================
    // This handles ALL key resolution internally:
    // - Template variables: {{user}}, {{char}}, {{userpersona}}
    // - Stats keys: {{resistencia}}, {{habilidades}}, etc.
    // - All sections including post-history instructions
    const { prompt: systemPrompt, sections: systemSections } = buildSystemPrompt(
      effectiveCharacter,
      effectiveUserName,
      persona,
      lorebookSection,
      typedSessionStats
    );

    // Build key resolution context for HUD context and quest sections
    const resolvedStats = resolveStats({
      characterId: effectiveCharacter.id,
      statsConfig: effectiveCharacter.statsConfig,
      sessionStats: typedSessionStats,
    });
    const keyContext = buildKeyResolutionContext(
      effectiveCharacter,
      effectiveUserName,
      persona,
      resolvedStats
    );

    // Build HUD context section if enabled (now resolves keys!)
    const hudContextSection = hudContext ? buildHUDContextSection(hudContext, keyContext) : null;

    // Build quest section if enabled (pre-LLM integration)
    let questSection: PromptSection | null = null;
    if (questSettings.enabled && questSettings.promptInclude && sessionQuests.length > 0 && questTemplates.length > 0) {
      const questPromptContent = buildQuestPromptSection(
        questTemplates,
        sessionQuests,
        questSettings.promptTemplate || DEFAULT_QUEST_SETTINGS.promptTemplate
      );
      if (questPromptContent) {
        const resolvedQuestContent = resolveAllKeys(questPromptContent, keyContext);

        questSection = {
          type: 'quest',
          label: 'Active Quests',
          content: resolvedQuestContent,
          color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
        };
      }
    }

    // Build chat history sections (for prompt viewer)
    const chatHistorySections = buildChatHistorySections(
      contextWindow.messages,
      effectiveCharacter.name,
      effectiveUserName
    );

    // Combine all sections in order for prompt viewer
    let allPromptSections: PromptSection[] = [
      ...systemSections,
      ...(questSection ? [questSection] : []),
      ...chatHistorySections
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
                effectiveCharacter,
                effectiveUserName
                // Note: postHistoryInstructions is already included in systemPrompt
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
                effectiveCharacter,
                effectiveUserName,
                undefined, // postHistoryInstructions already in systemPrompt
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
                effectiveCharacter,
                effectiveUserName,
                undefined, // postHistoryInstructions already in systemPrompt
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
                character: effectiveCharacter,
                userName: effectiveUserName
                // Note: postHistoryInstructions already in systemPrompt
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
                character: effectiveCharacter,
                userName: effectiveUserName
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
