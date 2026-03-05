// ============================================
// Prompt Builder - Unified prompt construction
// ============================================

import type {
  CharacterCard,
  ChatMessage,
  Persona,
  PromptSection,
  CharacterGroup,
  Lorebook,
  SummaryData,
  CharacterMemory,
  SessionStats,
  HUDContextConfig,
  QuestTemplate,
  SessionQuestInstance,
} from '@/types';
import type { ChatApiMessage, CompletionPromptConfig, GroupPromptBuildResult } from './types';
import { processExampleDialogue } from '@/lib/prompt-template';
import {
  processLorebooks,
  type LorebookInjectOptions,
  type LorebookInjectResult
} from '@/lib/lorebook';
import {
  resolveStats,
  type StatsResolutionContext,
} from '@/lib/stats';
import {
  resolveAllKeys,
  resolveSectionsKeys,
  buildKeyResolutionContext,
  type KeyResolutionContext,
} from '@/lib/key-resolver';
import {
  buildQuestPromptSection,
  buildQuestKeysPrompt,
} from '@/lib/triggers/handlers/quest-handler';

// ============================================
// Section Colors for Prompt Viewer
// ============================================

export const SECTION_COLORS = {
  system: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  persona: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  character_description: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  personality: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  scenario: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  example_dialogue: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:bg-cyan-300',
  character_note: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  lorebook: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  post_history: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  chat_history: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  instructions: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  summary: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  memory: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  relationship: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-300',
  hud_context: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  quest: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
} as const;

// ============================================
// HUD Context Injection
// ============================================

/**
 * Build a HUD context section for prompt injection
 * 
 * Now resolves ALL keys including:
 * - Template variables: {{user}}, {{char}}, {{userpersona}}
 * - Stats keys: {{resistencia}}, {{habilidades}}, etc.
 */
export function buildHUDContextSection(
  contextConfig: HUDContextConfig,
  keyContext?: KeyResolutionContext
): PromptSection | null {
  if (!contextConfig.enabled || !contextConfig.content.trim()) {
    return null;
  }

  // Resolve all keys in the context content
  let resolvedContent = contextConfig.content;
  if (keyContext) {
    resolvedContent = resolveAllKeys(contextConfig.content, keyContext);
  }

  return {
    type: 'hud_context',
    label: 'HUD Context',
    content: resolvedContent,
    color: SECTION_COLORS.hud_context
  };
}

/**
 * Inject HUD context at the specified position
 *
 * Positions:
 * 0 = After system prompt
 * 1 = After user message (after last user message)
 * 2 = Before user message (before last user message)
 * 3 = After assistant message (after last assistant message)
 * 4 = Before assistant message (before last assistant message)
 * 5 = At top of chat (before chat history)
 * 6 = At bottom of chat (after all messages)
 * 7 = After lorebook / Author's Note position
 */
export function injectHUDContextIntoMessages(
  messages: ChatApiMessage[],
  contextSection: PromptSection,
  position: number
): ChatApiMessage[] {
  if (!contextSection.content.trim()) {
    return messages;
  }

  const contextContent = `[${contextSection.label}]\n${contextSection.content}`;
  const result: ChatApiMessage[] = [...messages];

  switch (position) {
    case 0: // After system prompt
      // Find the first system/assistant message (the system prompt)
      const sysIdx = result.findIndex(m => m.role === 'assistant' || m.role === 'system');
      if (sysIdx >= 0) {
        result[sysIdx] = {
          ...result[sysIdx],
          content: result[sysIdx].content + '\n\n' + contextContent
        };
      }
      break;

    case 1: // After user message
      // Find the last user message
      const lastUserIdx = result.map((m, i) => m.role === 'user' ? i : -1).filter(i => i >= 0).pop();
      if (lastUserIdx !== undefined && lastUserIdx >= 0) {
        result[lastUserIdx] = {
          ...result[lastUserIdx],
          content: result[lastUserIdx].content + '\n\n' + contextContent
        };
      }
      break;

    case 2: // Before user message
      const lastUserIdx2 = result.map((m, i) => m.role === 'user' ? i : -1).filter(i => i >= 0).pop();
      if (lastUserIdx2 !== undefined && lastUserIdx2 >= 0) {
        result[lastUserIdx2] = {
          ...result[lastUserIdx2],
          content: contextContent + '\n\n' + result[lastUserIdx2].content
        };
      }
      break;

    case 3: // After assistant message
      const lastAsstIdx = result.map((m, i) => m.role === 'assistant' ? i : -1).filter(i => i >= 0).pop();
      if (lastAsstIdx !== undefined && lastAsstIdx >= 0) {
        result[lastAsstIdx] = {
          ...result[lastAsstIdx],
          content: result[lastAsstIdx].content + '\n\n' + contextContent
        };
      }
      break;

    case 4: // Before assistant message
      const lastAsstIdx4 = result.map((m, i) => m.role === 'assistant' ? i : -1).filter(i => i >= 0).pop();
      if (lastAsstIdx4 !== undefined && lastAsstIdx4 >= 0) {
        result[lastAsstIdx4] = {
          ...result[lastAsstIdx4],
          content: contextContent + '\n\n' + result[lastAsstIdx4].content
        };
      }
      break;

    case 5: // At top of chat (after system, before first message)
      const firstNonSysIdx = result.findIndex(m => m.role !== 'system');
      if (firstNonSysIdx > 0) {
        result.splice(firstNonSysIdx, 0, {
          role: 'system',
          content: contextContent
        });
      } else {
        result.push({
          role: 'system',
          content: contextContent
        });
      }
      break;

    case 6: // At bottom of chat (after all messages)
      result.push({
        role: 'system',
        content: contextContent
      });
      break;

    case 7: // After lorebook / Author's Note position
      // Insert after the first assistant message (system prompt), similar to lorebook
      const sysMsgIdx = result.findIndex(m => m.role === 'assistant' || m.role === 'system');
      if (sysMsgIdx >= 0) {
        // Insert after system prompt
        result.splice(sysMsgIdx + 1, 0, {
          role: 'system',
          content: contextContent
        });
      } else {
        // No system message found, add at beginning
        result.unshift({
          role: 'system',
          content: contextContent
        });
      }
      break;

    default:
      result.push({
        role: 'system',
        content: contextContent
      });
      break;
  }

  return result;
}

/**
 * Inject HUD context into prompt sections
 * This is for the prompt viewer display
 *
 * Positions:
 * 0 = After system prompt
 * 1 = After user message (not applicable to sections, uses chat_history)
 * 2 = Before user message (not applicable to sections, uses chat_history)
 * 3 = After assistant message (not applicable to sections, uses chat_history)
 * 4 = Before assistant message (not applicable to sections, uses chat_history)
 * 5 = At top of chat (before chat history)
 * 6 = At bottom of chat (after all sections)
 * 7 = After lorebook
 */
export function injectHUDContextIntoSections(
  sections: PromptSection[],
  contextSection: PromptSection,
  position: number
): PromptSection[] {
  if (!contextSection.content.trim()) {
    return sections;
  }

  const result: PromptSection[] = [...sections];

  switch (position) {
    case 0: // After system prompt
      const sysSectionIdx = result.findIndex(s => s.type === 'system');
      if (sysSectionIdx >= 0) {
        result.splice(sysSectionIdx + 1, 0, contextSection);
      } else {
        result.unshift(contextSection);
      }
      break;

    case 1: // After user message - inject before chat history
    case 2: // Before user message - inject before chat history
    case 3: // After assistant message - inject before chat history
    case 4: // Before assistant message - inject before chat history
      // These positions apply to messages, for sections we inject before chat history
      const chatHistoryIdx = result.findIndex(s => s.type === 'chat_history');
      if (chatHistoryIdx >= 0) {
        result.splice(chatHistoryIdx, 0, contextSection);
      } else {
        result.push(contextSection);
      }
      break;

    case 5: // At top of chat (before chat history)
      const chatIdx = result.findIndex(s => s.type === 'chat_history');
      if (chatIdx >= 0) {
        result.splice(chatIdx, 0, contextSection);
      } else {
        result.push(contextSection);
      }
      break;

    case 7: // After lorebook
      const lorebookIdx = result.findIndex(s => s.type === 'lorebook');
      if (lorebookIdx >= 0) {
        result.splice(lorebookIdx + 1, 0, contextSection);
      } else {
        // If no lorebook, insert after system prompt
        const sysIdx = result.findIndex(s => s.type === 'system');
        if (sysIdx >= 0) {
          result.splice(sysIdx + 1, 0, contextSection);
        } else {
          result.unshift(contextSection);
        }
      }
      break;

    case 6: // At bottom of chat
    default:
      result.push(contextSection);
      break;
  }

  return result;
}

// ============================================
// Extended Build Options
// ============================================

export interface PromptBuildOptions {
  userName?: string;
  persona?: Persona;
  messages?: ChatMessage[];
  lorebooks?: Lorebook[];
  postHistoryInstructions?: string;
  lorebookOptions?: LorebookInjectOptions;
  sessionStats?: SessionStats;
  hudContext?: HUDContextConfig;
  questTemplates?: QuestTemplate[];
  sessionQuests?: SessionQuestInstance[];
  questSettings?: { enabled: boolean; promptInclude: boolean; promptTemplate: string };
}

// ============================================
// Individual Chat Prompt Building
// ============================================

/**
 * Build the system prompt from character data (SillyTavern style)
 *
 * Uses unified key resolution for ALL sections:
 * - Template variables: {{user}}, {{char}}, {{userpersona}}, etc.
 * - Stats keys: {{resistencia}}, {{habilidades}}, etc.
 */
export function buildSystemPrompt(
  character: CharacterCard,
  userName: string = 'User',
  persona?: Persona,
  lorebookSection?: PromptSection | null,
  sessionStats?: SessionStats
): { prompt: string; sections: PromptSection[] } {
  const sections: PromptSection[] = [];

  // Resolve stats for this character
  const resolvedStats = resolveStats({
    characterId: character.id,
    statsConfig: character.statsConfig,
    sessionStats,
  });

  // Build unified key resolution context
  const keyContext = buildKeyResolutionContext(character, userName, persona, resolvedStats);

  // Main system instruction
  // If character has a custom system prompt, use it instead of the default
  const systemContent = character.systemPrompt?.trim()
    ? character.systemPrompt
    : `You are now in roleplay mode. You will act as ${character.name}.`;

  sections.push({
    type: 'system',
    label: 'System Prompt',
    content: systemContent,
    color: SECTION_COLORS.system
  });

  // Add user's persona description if available
  if (persona && persona.description) {
    sections.push({
      type: 'persona',
      label: `User's Persona (${userName})`,
      content: persona.description,
      color: SECTION_COLORS.persona
    });
  }

  // Add character description
  if (character.description) {
    sections.push({
      type: 'character_description',
      label: 'Character Description',
      content: character.description,
      color: SECTION_COLORS.character_description
    });
  }

  // Add personality
  if (character.personality) {
    sections.push({
      type: 'personality',
      label: 'Personality',
      content: character.personality,
      color: SECTION_COLORS.personality
    });
  }

  // Add scenario
  if (character.scenario) {
    sections.push({
      type: 'scenario',
      label: 'Scenario',
      content: character.scenario,
      color: SECTION_COLORS.scenario
    });
  }

  // Add example messages (important for few-shot learning)
  // Format them with SillyTavern-style <START> blocks
  if (character.mesExample) {
    const formattedExamples = processExampleDialogue(
      character.mesExample,
      userName,
      character.name
    );
    sections.push({
      type: 'example_dialogue',
      label: 'Example Dialogue',
      content: formattedExamples,
      color: SECTION_COLORS.example_dialogue
    });
  }

  // Add character's note (user-defined instructions for this character)
  if (character.characterNote) {
    sections.push({
      type: 'character_note',
      label: "Character's Note",
      content: character.characterNote,
      color: SECTION_COLORS.character_note
    });
  }

  // Add lorebook section if provided
  if (lorebookSection) {
    sections.push(lorebookSection);
  }

  // Add post-history instructions if provided
  if (character.postHistoryInstructions?.trim()) {
    sections.push({
      type: 'post_history',
      label: 'Post-History Instructions',
      content: character.postHistoryInstructions,
      color: SECTION_COLORS.post_history
    });
  }

  // ========================================
  // UNIFIED KEY RESOLUTION - Apply to ALL sections
  // ========================================
  // This resolves:
  // - Template variables: {{user}}, {{char}}, {{userpersona}}, etc.
  // - Stats keys: {{resistencia}}, {{habilidades}}, etc.
  // All in one place, consistently
  const processedSections = resolveSectionsKeys(sections, keyContext);

  // Build the prompt string from processed sections
  const prompt = processedSections.map(s => `[${s.label}]\n${s.content}`).join('\n\n');

  return { prompt, sections: processedSections };
}

/**
 * Build lorebook section from active lorebooks and chat messages
 */
export function buildLorebookSectionForPrompt(
  messages: ChatMessage[],
  lorebooks: Lorebook[],
  options?: LorebookInjectOptions
): { section: PromptSection | null; result: LorebookInjectResult } {
  const result = processLorebooks(messages, lorebooks, options);

  return {
    section: result.lorebookSection,
    result
  };
}

/**
 * Build chat history sections for prompt viewer
 */
export function buildChatHistorySections(
  messages: ChatMessage[],
  characterName: string,
  userName: string
): PromptSection[] {
  const sections: PromptSection[] = [];
  const visibleMessages = messages.filter(m => !m.isDeleted);

  const historyParts: string[] = [];
  for (const msg of visibleMessages) {
    const name = msg.role === 'user' ? userName : characterName;
    historyParts.push(`${name}: ${msg.content}`);
  }

  if (historyParts.length > 0) {
    sections.push({
      type: 'chat_history',
      label: 'Chat History',
      content: historyParts.join('\n\n'),
      color: SECTION_COLORS.chat_history
    });
  }

  return sections;
}

/**
 * Build messages array for chat models
 */
export function buildChatMessages(
  systemPrompt: string,
  messages: ChatMessage[],
  character: CharacterCard,
  userName: string = 'User',
  postHistoryInstructions?: string,
  useSystemRole: boolean = false
): ChatApiMessage[] {
  const chatMessages: ChatApiMessage[] = [];

  // System message
  let fullSystemPrompt = systemPrompt;
  if (postHistoryInstructions) {
    fullSystemPrompt += `\n\n${postHistoryInstructions}`;
  }

  // Some providers prefer 'system' role, others use 'assistant' for system
  chatMessages.push({
    role: useSystemRole ? 'system' : 'assistant',
    content: fullSystemPrompt
  });

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

/**
 * Build prompt for completion-style APIs (Ollama, KoboldCPP, etc.)
 */
export function buildCompletionPrompt(config: CompletionPromptConfig): string {
  const { systemPrompt, messages, character, userName, postHistoryInstructions } = config;
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

// ============================================
// Group Chat Prompt Building
// ============================================

/**
 * Build the system prompt for a character in a group chat
 *
 * Uses unified key resolution for ALL sections
 */
export function buildGroupSystemPrompt(
  character: CharacterCard,
  group: CharacterGroup,
  userName: string = 'User',
  persona?: Persona,
  lorebookSection?: PromptSection | null,
  sessionStats?: SessionStats,
  postHistoryInstructions?: string
): { prompt: string; sections: PromptSection[] } {
  const sections: PromptSection[] = [];

  // Resolve stats for this character in the group
  const resolvedStats = resolveStats({
    characterId: character.id,
    statsConfig: character.statsConfig,
    sessionStats,
  });

  // Build unified key resolution context
  const keyContext = buildKeyResolutionContext(character, userName, persona, resolvedStats);

  // System Prompt Priority: Group > Character > Default
  let systemContent: string;
  let systemLabel: string;

  if (group.systemPrompt?.trim()) {
    // Group system prompt takes highest priority
    systemContent = group.systemPrompt;
    systemLabel = 'System Prompt (Group)';
  } else if (character.systemPrompt?.trim()) {
    // Character system prompt
    systemContent = character.systemPrompt;
    systemLabel = 'System Prompt';
  } else {
    // Default fallback
    systemContent = `You are in a group roleplay. You will act as ${character.name}.`;
    systemLabel = 'System Prompt';
  }

  sections.push({
    type: 'system',
    label: systemLabel,
    content: systemContent,
    color: SECTION_COLORS.system
  });

  // Add user's persona description if available
  if (persona && persona.description) {
    sections.push({
      type: 'persona',
      label: `User's Persona (${userName})`,
      content: persona.description,
      color: SECTION_COLORS.persona
    });
  }

  // Add this character's details
  if (character.description) {
    sections.push({
      type: 'character_description',
      label: `${character.name}'s Description`,
      content: character.description,
      color: SECTION_COLORS.character_description
    });
  }

  if (character.personality) {
    sections.push({
      type: 'personality',
      label: `${character.name}'s Personality`,
      content: character.personality,
      color: SECTION_COLORS.personality
    });
  }

  // Add scenario - Group description takes priority over character scenario
  if (group.description?.trim()) {
    sections.push({
      type: 'scenario',
      label: 'Scenario (Group)',
      content: group.description,
      color: SECTION_COLORS.scenario
    });
  } else if (character.scenario?.trim()) {
    sections.push({
      type: 'scenario',
      label: 'Scenario',
      content: character.scenario,
      color: SECTION_COLORS.scenario
    });
  }

  // Add example messages (formatted with SillyTavern-style <START> blocks)
  if (character.mesExample) {
    const formattedExamples = processExampleDialogue(
      character.mesExample,
      userName,
      character.name
    );
    sections.push({
      type: 'example_dialogue',
      label: `Example Dialogue for ${character.name}`,
      content: formattedExamples,
      color: SECTION_COLORS.example_dialogue
    });
  }

  // Add character's note
  if (character.characterNote) {
    sections.push({
      type: 'character_note',
      label: `${character.name}'s Note`,
      content: character.characterNote,
      color: SECTION_COLORS.character_note
    });
  }

  // Add lorebook section if provided
  if (lorebookSection) {
    sections.push(lorebookSection);
  }

  // Add post-history instructions
  // Priority: parameter > character's postHistoryInstructions
  const postHistory = postHistoryInstructions?.trim() || character.postHistoryInstructions?.trim();
  if (postHistory) {
    sections.push({
      type: 'post_history',
      label: 'Post-History Instructions',
      content: postHistory,
      color: SECTION_COLORS.post_history
    });
  }

  // ========================================
  // UNIFIED KEY RESOLUTION - Apply to ALL sections
  // ========================================
  const processedSections = resolveSectionsKeys(sections, keyContext);

  // Build the prompt string from processed sections
  const prompt = processedSections.map(s => `[${s.label}]\n${s.content}`).join('\n\n');

  return { prompt, sections: processedSections };
}

/**
 * Build messages array for group chat
 *
 * Chat History format for group chats:
 * - Shows all messages in chronological order
 * - Includes previous responses from current turn BEFORE this character responds
 * - Each message shows the speaker's name (user or character name)
 */
export function buildGroupChatMessages(
  systemPrompt: string,
  messages: ChatMessage[],
  character: CharacterCard,
  allCharacters: CharacterCard[],
  userName: string = 'User',
  previousResponses?: Array<{ characterName: string; content: string }>
): GroupPromptBuildResult {
  const chatMessages: ChatApiMessage[] = [];

  // System message (just the character/group prompt, no chat history here)
  chatMessages.push({ role: 'assistant', content: systemPrompt });

  // Filter visible messages
  const visibleMessages = messages.filter(m => !m.isDeleted);

  // Build chat history content for prompt viewer
  const historyLines: string[] = [];

  // Add all historical messages
  for (const msg of visibleMessages) {
    const speaker = msg.role === 'user' ? userName :
      (allCharacters.find(c => c.id === msg.characterId)?.name || 'Character');
    historyLines.push(`${speaker}: ${msg.content}`);

    // Add to API messages
    if (msg.role === 'user') {
      chatMessages.push({ role: 'user', content: msg.content });
    } else if (msg.role === 'assistant') {
      chatMessages.push({ role: 'assistant', content: msg.content });
    }
  }

  // Add previous responses from this turn AFTER the user's message
  if (previousResponses && previousResponses.length > 0) {
    for (const resp of previousResponses) {
      historyLines.push(`${resp.characterName}: ${resp.content}`);
      chatMessages.push({ role: 'assistant', content: resp.content });
    }
  }

  // Build chat history section for prompt viewer
  let chatHistorySection: PromptSection | undefined;
  if (historyLines.length > 0) {
    chatHistorySection = {
      type: 'chat_history',
      label: 'Chat History',
      content: historyLines.join('\n\n'),
      color: SECTION_COLORS.chat_history
    };
  }

  return {
    systemPrompt,
    sections: [],
    chatMessages,
    chatHistorySection
  };
}

// ============================================
// Helper Functions
// ============================================

/**
 * Process character and return effective values
 * Uses the unified key resolver
 */
export function processCharacter(
  character: CharacterCard,
  userName: string,
  persona?: Persona,
  sessionStats?: SessionStats
): CharacterCard {
  // Resolve stats for this character
  const resolvedStats = resolveStats({
    characterId: character.id,
    statsConfig: character.statsConfig,
    sessionStats,
  });

  // Build key resolution context
  const keyContext = buildKeyResolutionContext(character, userName, persona, resolvedStats);

  // Process all text fields
  return {
    ...character,
    description: resolveAllKeys(character.description, keyContext),
    personality: resolveAllKeys(character.personality, keyContext),
    scenario: resolveAllKeys(character.scenario, keyContext),
    firstMes: resolveAllKeys(character.firstMes, keyContext),
    mesExample: resolveAllKeys(character.mesExample, keyContext),
    systemPrompt: resolveAllKeys(character.systemPrompt, keyContext),
    postHistoryInstructions: resolveAllKeys(character.postHistoryInstructions, keyContext),
    characterNote: resolveAllKeys(character.characterNote, keyContext),
    alternateGreetings: character.alternateGreetings.map(greeting =>
      resolveAllKeys(greeting, keyContext)
    )
  };
}

/**
 * Get effective user name from persona or default
 */
export function getEffectiveUserName(persona?: Persona, defaultName: string = 'User'): string {
  return persona?.name || defaultName;
}

/**
 * Create empty user message for API
 */
export function createUserMessage(content: string): ChatMessage {
  return {
    id: '',
    characterId: '',
    role: 'user',
    content,
    timestamp: '',
    isDeleted: false,
    swipeId: '',
    swipeIndex: 0
  };
}

// ============================================
// Summary & Memory Functions
// ============================================

/**
 * Build summary section for context compression
 */
export function buildSummarySection(summary: SummaryData): PromptSection {
  return {
    type: 'system',
    label: 'Conversation Summary',
    content: `[Previous Conversation Summary]\n${summary.content}`,
    color: SECTION_COLORS.summary
  };
}

/**
 * Build character memory section
 */
export function buildMemorySection(memory: CharacterMemory, characterName: string): PromptSection | null {
  if (!memory.events.length && !memory.relationships.length && !memory.notes) {
    return null;
  }

  const parts: string[] = [];

  // Add events
  if (memory.events.length > 0) {
    parts.push(`[Key Events and Facts]`);
    for (const event of memory.events) {
      const importance = event.importance >= 0.7 ? '⭐' : '';
      parts.push(`${importance} ${event.content}`);
    }
  }

  // Add relationships
  if (memory.relationships.length > 0) {
    parts.push(`\n[Relationships]`);
    for (const rel of memory.relationships) {
      const sentiment = rel.sentiment > 50 ? '😊' : rel.sentiment < -50 ? '😞' : '😐';
      parts.push(`${sentiment} ${rel.targetName}: ${rel.relationship} (${rel.sentiment >= 0 ? '+' : ''}${rel.sentiment})`);
    }
  }

  // Add notes
  if (memory.notes) {
    parts.push(`\n[Notes]\n${memory.notes}`);
  }

  return {
    type: 'character_note',
    label: `${characterName}'s Memory`,
    content: parts.join('\n'),
    color: SECTION_COLORS.memory
  };
}

/**
 * Build instructions section for summary behavior
 */
export function buildSummaryInstructionsSection(
  characterName: string,
  summaryEnabled: boolean
): PromptSection | null {
  if (!summaryEnabled) return null;

  const content = `## Memory Instructions
- Remember important events, decisions, and emotional moments
- Track relationship development with ${characterName}
- Maintain consistency with previous conversations
- Key information should be naturally recalled when relevant`;

  return {
    type: 'instructions',
    label: 'Memory Instructions',
    content,
    color: SECTION_COLORS.instructions
  };
}

/**
 * Get messages for summarization
 * Returns messages that should be included in summary generation
 */
export function getMessagesForSummary(
  messages: ChatMessage[],
  summarySettings: { triggerThreshold: number; keepRecentMessages: number }
): ChatMessage[] {
  const visibleMessages = messages.filter(m => !m.isDeleted);

  if (visibleMessages.length <= summarySettings.triggerThreshold) {
    return [];
  }

  // Exclude recent messages that should stay unsummarized
  const messagesToSummarize = visibleMessages.slice(
    0,
    visibleMessages.length - summarySettings.keepRecentMessages
  );

  return messagesToSummarize;
}

/**
 * Format summary with context markers
 */
export function formatSummaryWithContext(summary: SummaryData, totalMessages: number): string {
  const startMsg = summary.messageRange.start + 1;
  const endMsg = summary.messageRange.end + 1;

  return `[Summary of messages ${startMsg}-${endMsg} of ${totalMessages}]\n${summary.content}`;
}

// ============================================
// Quest Section Builder (Pre-LLM Quest Prompts)
// ============================================

// Quest prompt options type
type QuestPromptOptions = {
  questInclude?: boolean;
  questTemplate?: string;
  showKeys?: boolean;
  showProgress?: boolean;
};

const DEFAULT_QUEST_PROMPT_OPTIONS: QuestPromptOptions = {
  questInclude: true,
  showKeys: true,
  showProgress: true,
};

type QuestSettings = {
  enabled: boolean;
  promptInclude: boolean;
  promptTemplate: string;
};

/**
 * Build quest prompt section for LLM context
 * This function builds a section that shows active quests with their objectives
 * and progress. and completion keys. the AI can use to progress quests.
 */
export function buildQuestPromptForLLM(
  templates: QuestTemplate[],
  sessionQuests: SessionQuestInstance[],
  options: QuestPromptOptions = DEFAULT_QUEST_PROMPT_OPTIONS,
  keyContext?: KeyResolutionContext
): PromptSection | null {
  // Filter to active quests only
  const activeQuests = sessionQuests.filter(q => q.status === 'active');
  
  if (activeQuests.length === 0) {
    return null;
  }
  
  // Build quest section using the handler function
  const questSection = buildQuestPromptSection(
    templates,
    activeQuests,
    {
      enabled: options.questInclude ?? true,
      promptTemplate: options.questTemplate,
      showKeys: options.showKeys ?? true,
      showProgress: options.showProgress ?? true,
    },
    keyContext
  );
  
  // Resolve keys if keyContext provided
  const resolvedContent = resolveAllKeys(questSection.content, keyContext);
  questSection.content = resolvedContent;
  
  return questSection;
}

/**
 * Prepare quest data for API route
 */
export function prepareQuestDataForAPI(
  questTemplateIds?: string[],
  sessionQuests?: SessionQuestInstance[],
  allTemplates: QuestTemplate[]
): {
  templates: QuestTemplate[],
  sessionQuests: SessionQuestInstance[],
} {
  // Filter templates by questTemplateIds if provided
  let templates = allTemplates;
  if (questTemplateIds && questTemplateIds.length > 0) {
    templates = allTemplates.filter(t => questTemplateIds.includes(t.id));
  }
  
  // Filter session quests
  let sessionQuestsList = sessionQuests || [];
  
  return {
    templates,
    sessionQuests: sessionQuestsList,
  };
}
