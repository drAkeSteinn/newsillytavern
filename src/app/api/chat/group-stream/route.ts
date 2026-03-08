// ============================================
// Group Stream Route - Simplified with unified key resolution
// ============================================
//
// Key resolution happens in buildGroupSystemPrompt():
// - Template variables: {{user}}, {{char}}, {{userpersona}}
// - Stats keys: {{resistencia}}, {{habilidades}}, etc.
// - All sections are processed consistently

import { NextRequest } from 'next/server';
import type { ChatMessage, CharacterCard, CharacterGroup, PromptSection, Lorebook, SessionStats, HUDContextConfig, QuestSettings, QuestTemplate, SessionQuestInstance, SessionSummary } from '@/types';
import { DEFAULT_QUEST_SETTINGS } from '@/types';
import {
  createSSEJSON,
  createErrorResponse,
  createSSEStreamResponse,
  cleanResponseContent,
  buildGroupSystemPrompt,
  buildGroupChatMessages,
  buildPostHistorySection,
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
  type ContextConfig
} from '@/lib/context-manager';
import { detectMentions } from '@/lib/mention-detector';
import { buildQuestPromptSection } from '@/lib/triggers/handlers/quest-handler';

// ============================================
// Responder Selection Logic
// ============================================

/**
 * Determine responders based on strategy
 * Note: Narrators are excluded from normal response flow and handled separately
 */
function getResponders(
  message: string,
  characters: CharacterCard[],
  group: CharacterGroup,
  lastResponderId?: string
): CharacterCard[] {
  const strategy = group.activationStrategy;

  // Get active members, EXCLUDING narrators (they have their own response logic)
  const activeMemberIds = (group.members || [])
    .filter(m => m.isActive && m.isPresent !== false && !m.isNarrator)
    .map(m => m.characterId);

  // If no members defined, use characterIds (excluding narrators)
  const eligibleIds = activeMemberIds.length > 0
    ? activeMemberIds
    : (group.characterIds || []).filter(id => {
        const member = (group.members || []).find(m => m.characterId === id);
        return !member?.isNarrator;
      });

  // Filter to only characters that exist and are eligible
  const eligibleCharacters = characters.filter(c => eligibleIds.includes(c.id));

  if (eligibleCharacters.length === 0) {
    return [];
  }

  // Get ordered member IDs (excluding narrators)
  const orderedIds = (group.members || [])
    .filter(m => !m.isNarrator)
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
      lastResponderId,
      sessionStats,
      hudContext
    } = validation.data;

    // Extract lorebooks from body (not validated by validation.ts)
    const lorebooks: Lorebook[] = body.lorebooks || [];

    // Extract Quest data for pre-LLM integration (NEW FORMAT)
    const questTemplates: QuestTemplate[] = body.questTemplates || [];
    const sessionQuests: SessionQuestInstance[] = body.sessionQuests || [];
    const questSettings: QuestSettings = {
      ...DEFAULT_QUEST_SETTINGS,
      ...(body.questSettings || {})
    };

    // Extract summaries for memory/context compression
    const summary: SessionSummary | undefined = body.summary;

    // Cast sessionStats to proper type
    const typedSessionStats = sessionStats as SessionStats | undefined;

    // Cast hudContext to proper type
    const typedHUDContext = hudContext as HUDContextConfig | undefined;

    // Extract per-character lorebook map for when group has no lorebooks
    const characterLorebooksMap: Record<string, string[]> = body.characterLorebooksMap || {};

    // Determine if we should use per-character lorebooks
    const useGroupLorebooks = lorebooks.length > 0;

    // Extract narrator-related data
    const turnCount: number = body.turnCount || 0;
    const activeQuestsCount: number = sessionQuests.filter(q => q.status === 'active').length;
    const narratorLastTurn: number = body.narratorLastTurn || -999; // Turn when narrator last spoke

    // Get narrator settings from group
    const narratorSettings = group.narratorSettings;

    // Find narrator character (if any)
    const narratorMember = (group.members || []).find(m => m.isNarrator);
    const narratorCharacter = narratorMember
      ? characters.find(c => c.id === narratorMember.characterId)
      : null;

    // Determine if narrator should intervene based on conditions
    const shouldNarratorIntervene = (): boolean => {
      if (!narratorCharacter || !narratorSettings) return false;

      const { conditional } = narratorSettings;

      // Check turn interval
      if (conditional.minTurnInterval > 0) {
        const turnsSinceLastNarration = turnCount - narratorLastTurn;
        if (turnsSinceLastNarration < conditional.minTurnInterval) {
          return false;
        }
      }

      // Check if only when no active quests
      if (conditional.onlyWhenNoActiveQuests && activeQuestsCount > 0) {
        return false;
      }

      return true;
    };

    const narratorCanIntervene = shouldNarratorIntervene();

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

    // Build group-level lorebook section if group has lorebooks
    let groupLorebookSection: PromptSection | null = null;
    if (useGroupLorebooks && lorebooks.length > 0) {
      const result = buildLorebookSectionForPrompt(
        messages,
        lorebooks,
        {
          scanDepth: contextConfig.scanDepth,
          tokenBudget: 2048
        }
      );
      groupLorebookSection = result.section;
    }

    // Note: HUD context section is built inside the character loop
    // so it can resolve keys for each specific character

    // Note: Quest section is built inside the character loop
    // so each character sees only their relevant objectives

    // ========================================
    // Narrator Integration
    // ========================================
    // Add narrator to responders based on response mode and conditions
    let narratorAddedToResponders = false;
    if (narratorCharacter && narratorCanIntervene && narratorSettings) {
      const mode = narratorSettings.responseMode;
      if (mode === 'turn_start') {
        // Add narrator at the beginning
        responders.unshift(narratorCharacter);
        narratorAddedToResponders = true;
      } else if (mode === 'turn_end' || mode === 'before_each' || mode === 'after_each') {
        // Add narrator at the end (for turn_end, before_each, after_each we treat similarly for now)
        responders.push(narratorCharacter);
        narratorAddedToResponders = true;
      }
    }

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

            // Determine lorebook section for this character
            let lorebookSectionForCharacter: PromptSection | null = groupLorebookSection;

            // If group has no lorebooks, use character's own lorebooks
            if (!useGroupLorebooks) {
              const characterLorebookIds = characterLorebooksMap[responder.id] || [];
              if (characterLorebookIds.length > 0) {
                const characterLorebooksFiltered = lorebooks.filter(lb =>
                  characterLorebookIds.includes(lb.id) && lb.active
                );

                if (characterLorebooksFiltered.length > 0) {
                  const result = buildLorebookSectionForPrompt(
                    messages,
                    characterLorebooksFiltered,
                    {
                      scanDepth: contextConfig.scanDepth,
                      tokenBudget: 2048
                    }
                  );
                  lorebookSectionForCharacter = result.section;
                }
              } else {
                lorebookSectionForCharacter = null;
              }
            }

            // ========================================
            // Build system prompt with unified key resolution
            // ========================================
            // This handles ALL key resolution internally:
            // - Template variables: {{user}}, {{char}}, {{userpersona}}
            // - Stats keys: {{resistencia}}, {{habilidades}}, etc.
            // - All sections including post-history instructions
            const { prompt: systemPrompt, sections: promptSections } = buildGroupSystemPrompt(
              responder,
              group,
              effectiveUserName,
              persona,
              lorebookSectionForCharacter,
              typedSessionStats
              // Note: postHistoryInstructions is included internally
            );

            // Build key resolution context for this character
            const resolvedStats = resolveStats({
              characterId: responder.id,
              statsConfig: responder.statsConfig,
              sessionStats: typedSessionStats,
            });
            const keyContext = buildKeyResolutionContext(
              responder,
              effectiveUserName,
              persona,
              resolvedStats
            );

            // Build HUD context section for this character (resolves keys!)
            const hudContextSection = typedHUDContext ? buildHUDContextSection(typedHUDContext, keyContext) : null;

            // Check if this responder is a narrator in the group (MUST be before buildQuestPromptSection)
            const responderMember = group.members?.find(m => m.characterId === responder.id);
            const isResponderNarrator = responderMember?.isNarrator || false;

            // Build quest section for this character (filters objectives by characterId)
            // For narrator, show both active and available quests with different format
            let resolvedQuestSection: PromptSection | null = null;
            if (questSettings.enabled && questSettings.promptInclude && sessionQuests.length > 0 && questTemplates.length > 0) {
              const questSectionContent = buildQuestPromptSection(
                questTemplates,
                sessionQuests,
                questSettings.promptTemplate || DEFAULT_QUEST_SETTINGS.promptTemplate,
                responder.id,  // Filter objectives for this character
                isResponderNarrator  // Pass narrator flag for different format
              );
              if (questSectionContent) {
                const resolvedQuestContent = resolveAllKeys(questSectionContent, keyContext);
                resolvedQuestSection = {
                  type: 'quest',
                  label: 'Active Quests',
                  content: resolvedQuestContent,
                  color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                };
              }
            }

            // Add quest section to the system prompt if present
            let finalSystemPrompt = systemPrompt;
            if (resolvedQuestSection) {
              finalSystemPrompt += `\n\n[${resolvedQuestSection.label}]\n${resolvedQuestSection.content}`;
            }

            // Build chat messages with previous responses from this turn
            const previousResponses = responsesThisTurn.map(r => ({
              characterName: r.characterName,
              content: r.content
            }));

            // Check if the last message is already the user's current message
            const lastMessage = contextWindow.messages[contextWindow.messages.length - 1];
            const isLastMessageCurrentUser = lastMessage?.role === 'user' &&
              lastMessage?.content === sanitizedMessage;

            // Create summary message if summary exists (inject at start of chat history)
            const summaryMessage = summary ? {
              id: 'summary-' + Date.now(),
              role: 'assistant' as const,
              content: `[Previous Conversation Summary]\n${summary.content}`,
              characterId: responder.id,
              isDeleted: false,
              timestamp: summary.createdAt,
              swipeId: 'summary',
              swipeIndex: 0
            } : null;

            // Build messages: summary (if exists) + context window messages + user message
            let baseMessages = isLastMessageCurrentUser
              ? contextWindow.messages
              : [...contextWindow.messages, createUserMessage(sanitizedMessage)];
            
            // Inject summary at the START of chat history
            const messagesForPrompt = summaryMessage 
              ? [summaryMessage, ...baseMessages] 
              : baseMessages;

            // Resolve keys in post-history instructions BEFORE passing to buildGroupChatMessages
            // This ensures {{user}}, {{char}}, {{stats}}, etc. are replaced
            const rawPostHistoryInstructions = responder.postHistoryInstructions?.trim();
            const resolvedPostHistoryInstructions = rawPostHistoryInstructions
              ? resolveAllKeys(rawPostHistoryInstructions, keyContext)
              : undefined;

            // Build post-history section for prompt viewer (pass raw instructions, function will resolve keys)
            const postHistorySection = buildPostHistorySection(
              responder.postHistoryInstructions,
              keyContext
            );

            // Note: isResponderNarrator is already defined above before buildQuestPromptSection

            const { chatMessages, chatHistorySection } = buildGroupChatMessages(
              finalSystemPrompt,
              messagesForPrompt,
              responder,
              characters,
              effectiveUserName,
              previousResponses,
              resolvedPostHistoryInstructions,  // Post-history instructions AFTER chat (with keys resolved)
              undefined,  // authorNote
              isResponderNarrator  // If responder is narrator, they see all messages
            );

            // Combine prompt sections with chat history for the viewer
            // Order: System sections -> Quest -> Chat History -> Post-History Instructions
            let allPromptSections: PromptSection[] = chatHistorySection
              ? [...promptSections, ...(resolvedQuestSection ? [resolvedQuestSection] : []), chatHistorySection, ...(postHistorySection ? [postHistorySection] : [])]
              : [...promptSections, ...(resolvedQuestSection ? [resolvedQuestSection] : []), ...(postHistorySection ? [postHistorySection] : [])];

            // Inject HUD context into sections if enabled
            if (hudContextSection && typedHUDContext) {
              allPromptSections = injectHUDContextIntoSections(allPromptSections, hudContextSection, typedHUDContext.position);
            }

            // Generate response
            let fullContent = '';

            try {
              // Get the appropriate streaming generator based on provider
              let generator: AsyncGenerator<string>;

              // Inject HUD context into chat messages if enabled
              const finalChatMessages = hudContextSection && typedHUDContext
                ? injectHUDContextIntoMessages(chatMessages, hudContextSection, typedHUDContext.position)
                : chatMessages;

              switch (llmConfig.provider) {
                case 'z-ai': {
                  generator = streamZAI(finalChatMessages);
                  break;
                }

                case 'openai':
                case 'vllm':
                case 'custom': {
                  if (!llmConfig.endpoint) {
                    throw new Error(`${llmConfig.provider} requires an endpoint URL`);
                  }
                  // Convert assistant role to system for first message
                  const openaiMessages = finalChatMessages.map((m, idx) => ({
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
                  const anthropicMessages = finalChatMessages.map((m, idx) => ({
                    role: m.role === 'assistant' && idx === 0 ? 'system' : m.role,
                    content: m.content
                  }));
                  generator = streamAnthropic(anthropicMessages, llmConfig);
                  break;
                }

                case 'ollama': {
                  // Build completion prompt for Ollama
                  const prompt = buildGroupCompletionPrompt(
                    finalSystemPrompt,
                    messagesForPrompt,
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
                    finalSystemPrompt,
                    messagesForPrompt,
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
              // Include isNarrator flag so frontend can tag the message appropriately
              controller.enqueue(createSSEJSON({
                type: 'character_done',
                characterId: responder.id,
                characterName: responder.name,
                fullContent: cleanedContent,
                promptSections: allPromptSections,
                isNarrator: isResponderNarrator
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
