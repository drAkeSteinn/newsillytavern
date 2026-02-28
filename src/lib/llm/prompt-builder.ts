// ============================================
// Prompt Builder - Unified prompt construction
// ============================================

import type { 
  CharacterCard, 
  ChatMessage, 
  Persona, 
  PromptSection, 
  CharacterGroup,
  Lorebook
} from '@/types';
import type { ChatApiMessage, CompletionPromptConfig, GroupPromptBuildResult } from './types';
import { processCharacterTemplate } from '@/lib/prompt-template';
import { 
  processLorebooks,
  type LorebookInjectOptions,
  type LorebookInjectResult
} from '@/lib/lorebook';

// ============================================
// Section Colors for Prompt Viewer
// ============================================

export const SECTION_COLORS = {
  system: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  persona: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  character_description: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  personality: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  scenario: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  example_dialogue: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  character_note: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  lorebook: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  post_history: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  chat_history: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  instructions: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
} as const;

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
}

// ============================================
// Individual Chat Prompt Building
// ============================================

/**
 * Build the system prompt from character data (SillyTavern style)
 */
export function buildSystemPrompt(
  character: CharacterCard, 
  userName: string = 'User', 
  persona?: Persona,
  lorebookSection?: PromptSection | null
): { prompt: string; sections: PromptSection[] } {
  const sections: PromptSection[] = [];

  // Main system instruction
  const systemContent = `You are now in roleplay mode. You will act as ${character.name}.`;
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
  if (character.mesExample) {
    sections.push({
      type: 'example_dialogue',
      label: 'Example Dialogue',
      content: character.mesExample,
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

  // Add custom system prompt from character card
  if (character.systemPrompt) {
    sections.push({
      type: 'system',
      label: 'Custom System Prompt',
      content: character.systemPrompt,
      color: SECTION_COLORS.system
    });
  }

  // Add lorebook section if provided
  if (lorebookSection) {
    sections.push(lorebookSection);
  }

  // Add roleplay instructions
  const instructionsContent = `Stay in character as ${character.name} at all times.
Write detailed, engaging responses that reflect ${character.name}'s personality and emotions.
Use proper formatting: actions in asterisks, dialogue in quotes, thoughts in parentheses.
Never break character or acknowledge being an AI.
Respond as ${character.name} would, maintaining consistency with the established personality.
The user's name is ${userName}${persona?.description ? `, and their persona has been described above` : ''}`;

  sections.push({
    type: 'instructions',
    label: 'Instructions',
    content: instructionsContent,
    color: SECTION_COLORS.instructions
  });

  // Build the prompt string from sections
  const prompt = sections.map(s => `[${s.label}]\n${s.content}`).join('\n\n');

  return { prompt, sections };
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
 * Build post-history instructions section
 */
export function buildPostHistorySection(postHistoryInstructions?: string): PromptSection | null {
  if (!postHistoryInstructions) return null;

  return {
    type: 'post_history',
    label: 'Post-History Instructions',
    content: postHistoryInstructions,
    color: SECTION_COLORS.post_history
  };
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
 */
export function buildGroupSystemPrompt(
  character: CharacterCard,
  allCharacters: CharacterCard[],
  group: CharacterGroup,
  userName: string = 'User',
  persona?: Persona,
  lorebookSection?: PromptSection | null
): { prompt: string; sections: PromptSection[] } {
  const sections: PromptSection[] = [];

  // Group context
  const groupContext = `You are in a group roleplay. You will act as ${character.name}.`;
  sections.push({
    type: 'system',
    label: 'Group Roleplay',
    content: groupContext,
    color: SECTION_COLORS.system
  });

  // List all characters present
  const otherCharacters = allCharacters.filter(c => c.id !== character.id);
  if (otherCharacters.length > 0) {
    const otherCharsContent = otherCharacters.map(c =>
      `- ${c.name}: ${c.description?.slice(0, 200) || 'No description'}${(c.description?.length || 0) > 200 ? '...' : ''}`
    ).join('\n');
    sections.push({
      type: 'character_description',
      label: 'Other Characters Present',
      content: otherCharsContent,
      color: SECTION_COLORS.character_description
    });
  }

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

  // Add scenario from group or character
  const scenario = group.description || character.scenario;
  if (scenario) {
    sections.push({
      type: 'scenario',
      label: 'Scenario',
      content: scenario,
      color: SECTION_COLORS.scenario
    });
  }

  // Add example messages
  if (character.mesExample) {
    sections.push({
      type: 'example_dialogue',
      label: `Example Dialogue for ${character.name}`,
      content: character.mesExample,
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

  // Add group system prompt if defined
  if (group.systemPrompt) {
    sections.push({
      type: 'system',
      label: 'Group Instructions',
      content: group.systemPrompt,
      color: SECTION_COLORS.system
    });
  }

  // Add roleplay instructions
  const instructionsContent = `- Stay in character as ${character.name} at all times
- Write detailed, engaging responses that reflect ${character.name}'s personality and emotions
- Use proper formatting: actions in asterisks, dialogue in quotes, thoughts in parentheses
- Never break character or acknowledge being an AI
- Be aware that other characters (${otherCharacters.map(c => c.name).join(', ')}) are also present and may respond
- You can interact with, refer to, or address other characters naturally
- The user's name is ${userName}
- Keep your response focused - other characters will have their chance to respond`;

  sections.push({
    type: 'instructions',
    label: 'Instructions',
    content: instructionsContent,
    color: SECTION_COLORS.instructions
  });

  // Build the prompt string from sections
  const prompt = sections.map(s => `[${s.label}]\n${s.content}`).join('\n\n');

  return { prompt, sections };
}

/**
 * Build messages array for group chat
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

  // Build chat history section for prompt viewer
  let chatHistorySection: PromptSection | undefined;
  if (visibleMessages.length > 0) {
    const historyContent = visibleMessages.map(msg => {
      const speaker = msg.role === 'user' ? userName :
        (allCharacters.find(c => c.id === msg.characterId)?.name || 'Character');
      return `${speaker}: ${msg.content}`;
    }).join('\n\n');

    chatHistorySection = {
      type: 'chat_history',
      label: 'Chat History',
      content: historyContent,
      color: SECTION_COLORS.chat_history
    };
  }

  for (const msg of visibleMessages) {
    if (msg.role === 'user') {
      chatMessages.push({ role: 'user', content: msg.content });
    } else if (msg.role === 'assistant') {
      chatMessages.push({ role: 'assistant', content: msg.content });
    }
  }

  return { 
    systemPrompt: fullSystemPrompt, 
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
 */
export function processCharacter(
  character: CharacterCard,
  userName: string,
  persona?: Persona
): CharacterCard {
  return processCharacterTemplate(character, userName, persona);
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
