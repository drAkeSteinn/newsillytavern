import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { 
  CharacterCard, 
  ChatSession, 
  ChatMessage, 
  CharacterGroup,
  GroupMember,
  LLMConfig,
  TTSConfig,
  AppSettings,
  Background,
  PromptTemplate,
  SoundTrigger,
  SoundCollection,
  Persona,
  BackgroundPack,
  BackgroundIndex,
  BackgroundTriggerHit,
  Lorebook,
  LorebookEntry,
  LorebookSettings,
  SillyTavernLorebook
} from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { processMessageTemplate } from '@/lib/prompt-template';

// ============ Default Values ============

const defaultLLMConfig: LLMConfig = {
  id: 'default',
  name: 'Z.ai Chat',
  provider: 'z-ai',
  endpoint: '',
  model: '',
  parameters: {
    temperature: 0.7,
    topP: 0.9,
    topK: 40,
    maxTokens: 512,
    contextSize: 4096,
    repetitionPenalty: 1.1,
    frequencyPenalty: 0,
    presencePenalty: 0,
    stopStrings: [],
    stream: true
  },
  isActive: true
};

const defaultSettings: AppSettings = {
  theme: 'dark',
  fontSize: 16,
  messageDisplay: 'bubble',
  showTimestamps: true,
  showTokens: true,
  autoScroll: true,
  autoSave: true,
  autoSaveInterval: 30000,
  confirmDelete: true,
  defaultBackground: '',
  backgroundFit: 'cover',
  swipeEnabled: true,
  quickReplies: ['Continue', '...', 'Yes', 'No'],
  hotkeys: {
    send: 'Enter',
    newLine: 'Shift+Enter',
    regenerate: 'Ctrl+R',
    swipeLeft: 'ArrowLeft',
    swipeRight: 'ArrowRight'
  },
  sound: {
    enabled: true,
    globalVolume: 0.85,
    maxSoundsPerMessage: 3,
    globalCooldown: 150,
    realtimeEnabled: true
  },
  backgroundTriggers: {
    enabled: true,
    globalCooldown: 250,
    realtimeEnabled: true,
    transitionDuration: 500
  },
  chatLayout: {
    novelMode: true,
    chatWidth: 60,
    chatHeight: 70,
    chatX: 50,
    chatY: 50,
    chatOpacity: 0.95,
    blurBackground: true,
    showCharacterSprite: true
  }
};

const defaultPromptTemplate: PromptTemplate = {
  id: 'default',
  name: 'Default Template',
  description: 'Standard roleplay template',
  systemPrompt: `You are now in roleplay mode. You will act as {{char}}.
{{#if description}}
Character Description: {{description}}
{{/if}}
{{#if personality}}
Personality: {{personality}}
{{/if}}
{{#if scenario}}
Scenario: {{scenario}}
{{/if}}
Stay in character at all times. Write detailed, engaging responses that reflect {{char}}'s personality and emotions.`,
  userPrompt: '{{user}}',
  assistantPrompt: '{{char}}',
  contextTemplate: `{{#each messages}}
{{#if (eq role 'user')}}{{../userPrompt}}: {{content}}{{/if}}
{{#if (eq role 'assistant')}}{{../assistantPrompt}}: {{content}}{{/if}}
{{/each}}`,
  characterTemplate: `{{name}}'s Persona:
{{description}}

Personality traits: {{personality}}
{{#if scenario}}
Current scenario: {{scenario}}
{{/if}}`,
  groupTemplate: `Multiple characters are present in this conversation.
Characters: {{#each characters}}{{name}}{{#unless @last}}, {{/unless}}{{/each}}

{{#each characters}}
---
{{name}}:
{{description}}
Personality: {{personality}}
{{/each}}`,
  isDefault: true
};

const defaultPersona: Persona = {
  id: 'default',
  name: 'User',
  description: '',
  avatar: '',
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

const defaultLorebookSettings: LorebookSettings = {
  scanDepth: 5,
  caseSensitive: false,
  matchWholeWords: false,
  useGroupScoring: false,
  automationId: '',
  tokenBudget: 2048,
  recursionLimit: 3
};

// ============ Store Interface ============

interface TavernState {
  // Data
  characters: CharacterCard[];
  sessions: ChatSession[];
  groups: CharacterGroup[];
  backgrounds: Background[];
  llmConfigs: LLMConfig[];
  ttsConfigs: TTSConfig[];
  promptTemplates: PromptTemplate[];
  settings: AppSettings;
  soundTriggers: SoundTrigger[];
  soundCollections: SoundCollection[];
  personas: Persona[];
  backgroundPacks: BackgroundPack[];
  backgroundIndex: BackgroundIndex;
  lorebooks: Lorebook[];
  activeLorebookIds: string[];  // IDs of active lorebooks

  // Current State
  activeSessionId: string | null;
  activeCharacterId: string | null;
  activeGroupId: string | null;
  activeBackground: string;
  activeOverlayBack: string;
  activeOverlayFront: string;
  activePersonaId: string | null;
  isLoading: boolean;
  isGenerating: boolean;
  error: string | null;

  // UI State
  sidebarOpen: boolean;
  settingsOpen: boolean;
  characterEditorOpen: boolean;
  groupEditorOpen: boolean;

  // Character Actions
  addCharacter: (character: Omit<CharacterCard, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateCharacter: (id: string, updates: Partial<CharacterCard>) => void;
  deleteCharacter: (id: string) => void;
  setActiveCharacter: (id: string | null) => void;

  // Session Actions
  createSession: (characterId: string, groupId?: string) => string;
  updateSession: (id: string, updates: Partial<ChatSession>) => void;
  deleteSession: (id: string) => void;
  setActiveSession: (id: string | null) => void;
  
  // Message Actions
  addMessage: (sessionId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  updateMessage: (sessionId: string, messageId: string, content: string) => void;
  deleteMessage: (sessionId: string, messageId: string) => void;
  swipeMessage: (sessionId: string, messageId: string, direction: 'left' | 'right') => void;

  // Group Actions
  addGroup: (group: Omit<CharacterGroup, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateGroup: (id: string, updates: Partial<CharacterGroup>) => void;
  deleteGroup: (id: string) => void;
  setActiveGroup: (id: string | null) => void;
  getGroupById: (id: string) => CharacterGroup | undefined;
  addGroupMember: (groupId: string, characterId: string, role?: 'leader' | 'member' | 'observer') => void;
  removeGroupMember: (groupId: string, characterId: string) => void;
  updateGroupMember: (groupId: string, characterId: string, updates: Partial<GroupMember>) => void;
  toggleGroupMemberActive: (groupId: string, characterId: string) => void;
  toggleGroupMemberPresent: (groupId: string, characterId: string) => void;

  // LLM Actions
  addLLMConfig: (config: Omit<LLMConfig, 'id'>) => void;
  updateLLMConfig: (id: string, updates: Partial<LLMConfig>) => void;
  deleteLLMConfig: (id: string) => void;
  setActiveLLMConfig: (id: string) => void;
  getActiveLLMConfig: () => LLMConfig | undefined;

  // TTS Actions
  addTTSConfig: (config: Omit<TTSConfig, 'id'>) => void;
  updateTTSConfig: (id: string, updates: Partial<TTSConfig>) => void;
  deleteTTSConfig: (id: string) => void;

  // Background Actions
  addBackground: (background: Omit<Background, 'id'>) => void;
  setActiveBackground: (url: string) => void;
  setActiveOverlay: (backUrl: string, frontUrl: string) => void;
  applyBackgroundHit: (hit: BackgroundTriggerHit) => void;

  // Sound Actions
  addSoundTrigger: (trigger: Omit<SoundTrigger, 'id' | 'createdAt' | 'updatedAt' | 'currentIndex'>) => void;
  updateSoundTrigger: (id: string, updates: Partial<SoundTrigger>) => void;
  deleteSoundTrigger: (id: string) => void;
  cloneSoundTrigger: (id: string) => void;
  toggleSoundTrigger: (id: string) => void;
  toggleSoundKeyword: (triggerId: string, keyword: string) => void;
  setSoundCollections: (collections: SoundCollection[]) => void;
  updateSoundTriggerIndex: (id: string, index: number) => void;

  // Background Pack Actions
  addBackgroundPack: (pack: Omit<BackgroundPack, 'id' | 'createdAt' | 'updatedAt' | 'currentIndex'>) => void;
  updateBackgroundPack: (id: string, updates: Partial<BackgroundPack>) => void;
  deleteBackgroundPack: (id: string) => void;
  cloneBackgroundPack: (id: string) => void;
  toggleBackgroundPack: (id: string) => void;
  setBackgroundIndex: (index: BackgroundIndex) => void;
  updateBackgroundPackIndex: (id: string, index: number) => void;

  // Settings Actions
  updateSettings: (updates: Partial<AppSettings>) => void;

  // Persona Actions
  addPersona: (persona: Omit<Persona, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updatePersona: (id: string, updates: Partial<Persona>) => void;
  deletePersona: (id: string) => void;
  setActivePersona: (id: string) => void;
  getActivePersona: () => Persona | undefined;

  // Lorebook Actions
  addLorebook: (lorebook: Omit<Lorebook, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateLorebook: (id: string, updates: Partial<Lorebook>) => void;
  deleteLorebook: (id: string) => void;
  toggleLorebook: (id: string) => void;
  setActiveLorebooks: (ids: string[]) => void;
  addLorebookEntry: (lorebookId: string, entry: Omit<LorebookEntry, 'uid'>) => void;
  updateLorebookEntry: (lorebookId: string, uid: number, updates: Partial<LorebookEntry>) => void;
  deleteLorebookEntry: (lorebookId: string, uid: number) => void;
  duplicateLorebookEntry: (lorebookId: string, uid: number) => void;
  importSillyTavernLorebook: (stLorebook: SillyTavernLorebook, name: string, description?: string) => Lorebook;
  exportSillyTavernLorebook: (id: string) => SillyTavernLorebook | null;
  getActiveLorebooks: () => Lorebook[];
  getLorebookById: (id: string) => Lorebook | undefined;

  // Prompt Template Actions
  addPromptTemplate: (template: Omit<PromptTemplate, 'id'>) => void;
  updatePromptTemplate: (id: string, updates: Partial<PromptTemplate>) => void;
  deletePromptTemplate: (id: string) => void;

  // UI Actions
  setSidebarOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setCharacterEditorOpen: (open: boolean) => void;
  setGroupEditorOpen: (open: boolean) => void;
  setLoading: (loading: boolean) => void;
  setGenerating: (generating: boolean) => void;
  setError: (error: string | null) => void;

  // Utility
  getActiveSession: () => ChatSession | undefined;
  getActiveCharacter: () => CharacterCard | undefined;
  getCharacterById: (id: string) => CharacterCard | undefined;
  getSessionById: (id: string) => ChatSession | undefined;
}

// ============ Store Implementation ============

export const useTavernStore = create<TavernState>()(
  persist(
    (set, get) => ({
      // Initial Data
      characters: [],
      sessions: [],
      groups: [],
      backgrounds: [],
      llmConfigs: [defaultLLMConfig],
      ttsConfigs: [],
      promptTemplates: [defaultPromptTemplate],
      settings: defaultSettings,
      soundTriggers: [],
      soundCollections: [],
      personas: [defaultPersona],
      backgroundPacks: [],
      backgroundIndex: { backgrounds: [], lastUpdated: 0, source: '' },
      lorebooks: [],
      activeLorebookIds: [],

      // Initial State
      activeSessionId: null,
      activeCharacterId: null,
      activeGroupId: null,
      activeBackground: '',
      activeOverlayBack: '',
      activeOverlayFront: '',
      activePersonaId: 'default',
      isLoading: false,
      isGenerating: false,
      error: null,

      // Initial UI State
      sidebarOpen: true,
      settingsOpen: false,
      characterEditorOpen: false,
      groupEditorOpen: false,

      // Character Actions
      addCharacter: (character) => set((state) => ({
        characters: [...state.characters, {
          ...character,
          id: uuidv4(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }]
      })),

      updateCharacter: (id, updates) => set((state) => ({
        characters: state.characters.map((c) =>
          c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c
        )
      })),

      deleteCharacter: (id) => set((state) => ({
        characters: state.characters.filter((c) => c.id !== id),
        sessions: state.sessions.filter((s) => s.characterId !== id),
        activeCharacterId: state.activeCharacterId === id ? null : state.activeCharacterId
      })),

      setActiveCharacter: (id) => set({ activeCharacterId: id }),

      // Session Actions
      createSession: (characterId, groupId) => {
        const id = uuidv4();
        const character = get().getCharacterById(characterId);
        const activePersona = get().getActivePersona();
        const userName = activePersona?.name || 'User';
        
        // Process the first message with template variables
        const processedFirstMes = character 
          ? processMessageTemplate(character.firstMes, character.name, userName)
          : '';
        
        set((state) => ({
          sessions: [...state.sessions, {
            id,
            characterId,
            groupId,
            name: character ? `Chat with ${character.name}` : 'New Chat',
            messages: character ? [{
              id: uuidv4(),
              characterId,
              role: 'assistant' as const,
              content: processedFirstMes,
              timestamp: new Date().toISOString(),
              isDeleted: false,
              swipeId: uuidv4(),
              swipeIndex: 0
            }] : [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }],
          activeSessionId: id,
          activeCharacterId: characterId,
          activeGroupId: groupId || null
        }));

        return id;
      },

      updateSession: (id, updates) => set((state) => ({
        sessions: state.sessions.map((s) =>
          s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s
        )
      })),

      deleteSession: (id) => set((state) => ({
        sessions: state.sessions.filter((s) => s.id !== id),
        activeSessionId: state.activeSessionId === id ? null : state.activeSessionId
      })),

      setActiveSession: (id) => {
        const session = get().getSessionById(id);
        set({ 
          activeSessionId: id,
          activeCharacterId: session?.characterId || null,
          activeGroupId: session?.groupId || null
        });
      },

      // Message Actions
      addMessage: (sessionId, message) => set((state) => ({
        sessions: state.sessions.map((s) =>
          s.id === sessionId ? {
            ...s,
            messages: [...s.messages, {
              ...message,
              id: uuidv4(),
              timestamp: new Date().toISOString()
            }],
            updatedAt: new Date().toISOString()
          } : s
        )
      })),

      updateMessage: (sessionId, messageId, content) => set((state) => ({
        sessions: state.sessions.map((s) =>
          s.id === sessionId ? {
            ...s,
            messages: s.messages.map((m) =>
              m.id === messageId ? { ...m, content } : m
            ),
            updatedAt: new Date().toISOString()
          } : s
        )
      })),

      deleteMessage: (sessionId, messageId) => set((state) => ({
        sessions: state.sessions.map((s) =>
          s.id === sessionId ? {
            ...s,
            messages: s.messages.map((m) =>
              m.id === messageId ? { ...m, isDeleted: true } : m
            ),
            updatedAt: new Date().toISOString()
          } : s
        )
      })),

      swipeMessage: (sessionId, messageId, direction) => {
        // Implement swipe logic for alternative responses
        set((state) => ({
          sessions: state.sessions.map((s) => {
            if (s.id !== sessionId) return s;
            return {
              ...s,
              messages: s.messages.map((m) => {
                if (m.id !== messageId) return m;
                const newIndex = direction === 'right' 
                  ? m.swipeIndex + 1 
                  : Math.max(0, m.swipeIndex - 1);
                return { ...m, swipeIndex: newIndex };
              })
            };
          })
        }));
      },

      // Group Actions
      addGroup: (group) => set((state) => ({
        groups: [...state.groups, {
          ...group,
          id: uuidv4(),
          // Ensure members array is initialized from characterIds if not provided
          members: group.members || (group.characterIds || []).map((id, index) => ({
            characterId: id,
            role: 'member' as const,
            isActive: true,
            isPresent: true,
            joinOrder: index
          })),
          // Set defaults for new fields
          maxResponsesPerTurn: group.maxResponsesPerTurn ?? 3,
          allowMentions: group.allowMentions ?? true,
          mentionTriggers: group.mentionTriggers ?? [],
          conversationStyle: group.conversationStyle ?? 'sequential',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }]
      })),

      updateGroup: (id, updates) => set((state) => ({
        groups: state.groups.map((g) =>
          g.id === id ? { ...g, ...updates, updatedAt: new Date().toISOString() } : g
        )
      })),

      deleteGroup: (id) => set((state) => ({
        groups: state.groups.filter((g) => g.id !== id),
        activeGroupId: state.activeGroupId === id ? null : state.activeGroupId
      })),

      setActiveGroup: (id) => set({ activeGroupId: id }),

      getGroupById: (id) => get().groups.find((g) => g.id === id),

      addGroupMember: (groupId, characterId, role = 'member') => set((state) => ({
        groups: state.groups.map((g) => {
          if (g.id !== groupId) return g;
          const existingMember = g.members?.find(m => m.characterId === characterId);
          if (existingMember) return g; // Already a member
          const newMember: GroupMember = {
            characterId,
            role,
            isActive: true,
            isPresent: true,
            joinOrder: g.members?.length || 0
          };
          return {
            ...g,
            members: [...(g.members || []), newMember],
            characterIds: [...(g.characterIds || []), characterId],
            updatedAt: new Date().toISOString()
          };
        })
      })),

      removeGroupMember: (groupId, characterId) => set((state) => ({
        groups: state.groups.map((g) => {
          if (g.id !== groupId) return g;
          return {
            ...g,
            members: (g.members || []).filter(m => m.characterId !== characterId),
            characterIds: (g.characterIds || []).filter(id => id !== characterId),
            updatedAt: new Date().toISOString()
          };
        })
      })),

      updateGroupMember: (groupId, characterId, updates) => set((state) => ({
        groups: state.groups.map((g) => {
          if (g.id !== groupId) return g;
          return {
            ...g,
            members: (g.members || []).map(m =>
              m.characterId === characterId ? { ...m, ...updates } : m
            ),
            updatedAt: new Date().toISOString()
          };
        })
      })),

      toggleGroupMemberActive: (groupId, characterId) => set((state) => ({
        groups: state.groups.map((g) => {
          if (g.id !== groupId) return g;
          return {
            ...g,
            members: (g.members || []).map(m =>
              m.characterId === characterId ? { ...m, isActive: !m.isActive } : m
            ),
            updatedAt: new Date().toISOString()
          };
        })
      })),

      toggleGroupMemberPresent: (groupId, characterId) => set((state) => ({
        groups: state.groups.map((g) => {
          if (g.id !== groupId) return g;
          return {
            ...g,
            members: (g.members || []).map(m =>
              m.characterId === characterId ? { ...m, isPresent: !m.isPresent } : m
            ),
            updatedAt: new Date().toISOString()
          };
        })
      })),

      // LLM Actions
      addLLMConfig: (config) => set((state) => ({
        llmConfigs: [...state.llmConfigs, { ...config, id: uuidv4() }]
      })),

      updateLLMConfig: (id, updates) => set((state) => ({
        llmConfigs: state.llmConfigs.map((c) =>
          c.id === id ? { ...c, ...updates } : c
        )
      })),

      deleteLLMConfig: (id) => set((state) => ({
        llmConfigs: state.llmConfigs.filter((c) => c.id !== id)
      })),

      setActiveLLMConfig: (id) => set((state) => ({
        llmConfigs: state.llmConfigs.map((c) => ({
          ...c,
          isActive: c.id === id
        }))
      })),

      getActiveLLMConfig: () => get().llmConfigs.find((c) => c.isActive),

      // TTS Actions
      addTTSConfig: (config) => set((state) => ({
        ttsConfigs: [...state.ttsConfigs, { ...config, id: uuidv4() }]
      })),

      updateTTSConfig: (id, updates) => set((state) => ({
        ttsConfigs: state.ttsConfigs.map((c) =>
          c.id === id ? { ...c, ...updates } : c
        )
      })),

      deleteTTSConfig: (id) => set((state) => ({
        ttsConfigs: state.ttsConfigs.filter((c) => c.id !== id)
      })),

      // Background Actions
      addBackground: (background) => set((state) => ({
        backgrounds: [...state.backgrounds, { ...background, id: uuidv4() }]
      })),

      setActiveBackground: (url) => set({ activeBackground: url }),

      setActiveOverlay: (backUrl, frontUrl) => set({ 
        activeOverlayBack: backUrl, 
        activeOverlayFront: frontUrl 
      }),

      applyBackgroundHit: (hit) => set((state) => {
        const updates: Partial<TavernState> = {
          activeBackground: hit.backgroundUrl || '',
        };
        
        // Apply overlay based on placement
        if (hit.overlayPlacement === 'back') {
          updates.activeOverlayBack = hit.overlayUrl || '';
          updates.activeOverlayFront = '';
        } else if (hit.overlayPlacement === 'front') {
          updates.activeOverlayBack = '';
          updates.activeOverlayFront = hit.overlayUrl || '';
        } else {
          updates.activeOverlayBack = '';
          updates.activeOverlayFront = '';
        }
        
        return updates;
      }),

      // Sound Actions
      addSoundTrigger: (trigger) => set((state) => {
        const keywordsEnabled: Record<string, boolean> = {};
        trigger.keywords.forEach(kw => {
          keywordsEnabled[kw] = true;
        });
        return {
          soundTriggers: [...state.soundTriggers, {
            ...trigger,
            id: uuidv4(),
            currentIndex: 0,
            keywordsEnabled,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }]
        };
      }),

      updateSoundTrigger: (id, updates) => set((state) => ({
        soundTriggers: state.soundTriggers.map((t) =>
          t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
        )
      })),

      deleteSoundTrigger: (id) => set((state) => ({
        soundTriggers: state.soundTriggers.filter((t) => t.id !== id)
      })),

      cloneSoundTrigger: (id) => set((state) => {
        const trigger = state.soundTriggers.find((t) => t.id === id);
        if (!trigger) return state;
        return {
          soundTriggers: [...state.soundTriggers, {
            ...trigger,
            id: uuidv4(),
            name: `${trigger.name} (copy)`,
            currentIndex: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }]
        };
      }),

      toggleSoundTrigger: (id) => set((state) => ({
        soundTriggers: state.soundTriggers.map((t) =>
          t.id === id ? { ...t, active: !t.active, updatedAt: new Date().toISOString() } : t
        )
      })),

      toggleSoundKeyword: (triggerId, keyword) => set((state) => ({
        soundTriggers: state.soundTriggers.map((t) => {
          if (t.id !== triggerId) return t;
          return {
            ...t,
            keywordsEnabled: {
              ...t.keywordsEnabled,
              [keyword]: !t.keywordsEnabled[keyword]
            },
            updatedAt: new Date().toISOString()
          };
        })
      })),

      setSoundCollections: (collections) => set({ soundCollections: collections }),

      updateSoundTriggerIndex: (id, index) => set((state) => ({
        soundTriggers: state.soundTriggers.map((t) =>
          t.id === id ? { ...t, currentIndex: index, updatedAt: new Date().toISOString() } : t
        )
      })),

      // Background Pack Actions
      addBackgroundPack: (pack) => set((state) => ({
        backgroundPacks: [...state.backgroundPacks, {
          ...pack,
          id: uuidv4(),
          currentIndex: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }]
      })),

      updateBackgroundPack: (id, updates) => set((state) => ({
        backgroundPacks: state.backgroundPacks.map((p) =>
          p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
        )
      })),

      deleteBackgroundPack: (id) => set((state) => ({
        backgroundPacks: state.backgroundPacks.filter((p) => p.id !== id)
      })),

      cloneBackgroundPack: (id) => set((state) => {
        const pack = state.backgroundPacks.find((p) => p.id === id);
        if (!pack) return state;
        return {
          backgroundPacks: [...state.backgroundPacks, {
            ...pack,
            id: uuidv4(),
            title: `${pack.title} (copy)`,
            currentIndex: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }]
        };
      }),

      toggleBackgroundPack: (id) => set((state) => ({
        backgroundPacks: state.backgroundPacks.map((p) =>
          p.id === id ? { ...p, active: !p.active, updatedAt: new Date().toISOString() } : p
        )
      })),

      setBackgroundIndex: (index) => set({ backgroundIndex: index }),

      updateBackgroundPackIndex: (id, index) => set((state) => ({
        backgroundPacks: state.backgroundPacks.map((p) =>
          p.id === id ? { ...p, currentIndex: index, updatedAt: new Date().toISOString() } : p
        )
      })),

      // Settings Actions
      updateSettings: (updates) => set((state) => ({
        settings: { ...state.settings, ...updates }
      })),

      // Persona Actions
      addPersona: (persona) => set((state) => ({
        personas: [...state.personas, {
          ...persona,
          id: uuidv4(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }]
      })),

      updatePersona: (id, updates) => set((state) => ({
        personas: state.personas.map((p) =>
          p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
        )
      })),

      deletePersona: (id) => set((state) => {
        // Don't allow deleting the default persona
        if (id === 'default') return state;
        return {
          personas: state.personas.filter((p) => p.id !== id),
          activePersonaId: state.activePersonaId === id ? 'default' : state.activePersonaId
        };
      }),

      setActivePersona: (id) => set((state) => ({
        personas: state.personas.map((p) => ({
          ...p,
          isActive: p.id === id
        })),
        activePersonaId: id
      })),

      getActivePersona: () => {
        const state = get();
        return state.personas.find((p) => p.id === state.activePersonaId);
      },

      // Lorebook Actions
      addLorebook: (lorebook) => set((state) => ({
        lorebooks: [...state.lorebooks, {
          ...lorebook,
          id: uuidv4(),
          settings: lorebook.settings || defaultLorebookSettings,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }]
      })),

      updateLorebook: (id, updates) => set((state) => ({
        lorebooks: state.lorebooks.map((l) =>
          l.id === id ? { ...l, ...updates, updatedAt: new Date().toISOString() } : l
        )
      })),

      deleteLorebook: (id) => set((state) => ({
        lorebooks: state.lorebooks.filter((l) => l.id !== id),
        activeLorebookIds: state.activeLorebookIds.filter((aid) => aid !== id)
      })),

      toggleLorebook: (id) => set((state) => {
        const isActive = state.activeLorebookIds.includes(id);
        return {
          activeLorebookIds: isActive
            ? state.activeLorebookIds.filter((aid) => aid !== id)
            : [...state.activeLorebookIds, id],
          lorebooks: state.lorebooks.map((l) =>
            l.id === id ? { ...l, active: !l.active, updatedAt: new Date().toISOString() } : l
          )
        };
      }),

      setActiveLorebooks: (ids) => set((state) => ({
        activeLorebookIds: ids,
        lorebooks: state.lorebooks.map((l) => ({
          ...l,
          active: ids.includes(l.id),
          updatedAt: new Date().toISOString()
        }))
      })),

      addLorebookEntry: (lorebookId, entry) => set((state) => {
        const lorebook = state.lorebooks.find((l) => l.id === lorebookId);
        if (!lorebook) return state;
        
        const maxUid = lorebook.entries.reduce((max, e) => Math.max(max, e.uid), -1);
        const newEntry: LorebookEntry = {
          ...entry,
          uid: maxUid + 1,
          key: entry.key || [],
          keysecondary: entry.keysecondary || [],
          comment: entry.comment || '',
          content: entry.content || '',
          constant: entry.constant ?? false,
          selective: entry.selective ?? false,
          order: entry.order ?? 100,
          position: entry.position ?? 0,
          disable: entry.disable ?? false,
          excludeRecursion: entry.excludeRecursion ?? false,
          preventRecursion: entry.preventRecursion ?? false,
          delayUntilRecursion: entry.delayUntilRecursion ?? false,
          probability: entry.probability ?? 100,
          useProbability: entry.useProbability ?? false,
          depth: entry.depth ?? 4,
          selectLogic: entry.selectLogic ?? 0,
          group: entry.group ?? '',
          groupOverride: entry.groupOverride ?? false,
          groupWeight: entry.groupWeight ?? 100,
          scanDepth: entry.scanDepth ?? null,
          caseSensitive: entry.caseSensitive ?? null,
          matchWholeWords: entry.matchWholeWords ?? null,
          useGroupScoring: entry.useGroupScoring ?? null,
          automationId: entry.automationId ?? '',
          role: entry.role ?? null,
          vectorized: entry.vectorized ?? false,
          displayIndex: entry.displayIndex ?? lorebook.entries.length,
          extensions: entry.extensions ?? {}
        };
        
        return {
          lorebooks: state.lorebooks.map((l) =>
            l.id === lorebookId 
              ? { 
                  ...l, 
                  entries: [...l.entries, newEntry],
                  updatedAt: new Date().toISOString() 
                } 
              : l
          )
        };
      }),

      updateLorebookEntry: (lorebookId, uid, updates) => set((state) => ({
        lorebooks: state.lorebooks.map((l) =>
          l.id === lorebookId 
            ? { 
                ...l, 
                entries: l.entries.map((e) =>
                  e.uid === uid ? { ...e, ...updates } : e
                ),
                updatedAt: new Date().toISOString() 
              } 
            : l
        )
      })),

      deleteLorebookEntry: (lorebookId, uid) => set((state) => ({
        lorebooks: state.lorebooks.map((l) =>
          l.id === lorebookId 
            ? { 
                ...l, 
                entries: l.entries.filter((e) => e.uid !== uid),
                updatedAt: new Date().toISOString() 
              } 
            : l
        )
      })),

      duplicateLorebookEntry: (lorebookId, uid) => set((state) => {
        const lorebook = state.lorebooks.find((l) => l.id === lorebookId);
        if (!lorebook) return state;
        
        const entry = lorebook.entries.find((e) => e.uid === uid);
        if (!entry) return state;
        
        const maxUid = lorebook.entries.reduce((max, e) => Math.max(max, e.uid), -1);
        const newEntry: LorebookEntry = {
          ...entry,
          uid: maxUid + 1,
          comment: `${entry.comment} (copy)`,
          displayIndex: lorebook.entries.length
        };
        
        return {
          lorebooks: state.lorebooks.map((l) =>
            l.id === lorebookId 
              ? { 
                  ...l, 
                  entries: [...l.entries, newEntry],
                  updatedAt: new Date().toISOString() 
                } 
              : l
          )
        };
      }),

      importSillyTavernLorebook: (stLorebook, name, description = '') => {
        const entries: LorebookEntry[] = Object.values(stLorebook.entries).map((entry, index) => ({
          uid: entry.uid ?? index,
          key: entry.key || [],
          keysecondary: entry.keysecondary || [],
          comment: entry.comment || '',
          content: entry.content || '',
          constant: entry.constant ?? false,
          selective: entry.selective ?? false,
          order: entry.order ?? 100,
          position: entry.position ?? 0,
          disable: entry.disable ?? false,
          excludeRecursion: entry.excludeRecursion ?? false,
          preventRecursion: entry.preventRecursion ?? false,
          delayUntilRecursion: entry.delayUntilRecursion ?? false,
          probability: entry.probability ?? 100,
          useProbability: entry.useProbability ?? false,
          depth: entry.depth ?? 4,
          selectLogic: entry.selectLogic ?? 0,
          group: entry.group ?? '',
          groupOverride: entry.groupOverride ?? false,
          groupWeight: entry.groupWeight ?? 100,
          scanDepth: entry.scanDepth ?? null,
          caseSensitive: entry.caseSensitive ?? null,
          matchWholeWords: entry.matchWholeWords ?? null,
          useGroupScoring: entry.useGroupScoring ?? null,
          automationId: entry.automationId ?? '',
          role: entry.role ?? null,
          vectorized: entry.vectorized ?? false,
          displayIndex: entry.displayIndex ?? index,
          extensions: entry.extensions ?? {}
        }));

        const lorebook: Lorebook = {
          id: uuidv4(),
          name,
          description,
          entries,
          settings: {
            ...defaultLorebookSettings,
            ...(stLorebook.settings || {})
          },
          tags: [],
          active: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        set((state) => ({
          lorebooks: [...state.lorebooks, lorebook],
          activeLorebookIds: [...state.activeLorebookIds, lorebook.id]
        }));

        return lorebook;
      },

      exportSillyTavernLorebook: (id) => {
        const lorebook = get().lorebooks.find((l) => l.id === id);
        if (!lorebook) return null;

        const entries: Record<string, LorebookEntry> = {};
        lorebook.entries.forEach((entry) => {
          entries[entry.uid.toString()] = entry;
        });

        return {
          entries,
          settings: lorebook.settings
        };
      },

      getActiveLorebooks: () => {
        const state = get();
        return state.lorebooks.filter((l) => state.activeLorebookIds.includes(l.id));
      },

      getLorebookById: (id) => get().lorebooks.find((l) => l.id === id),

      // Prompt Template Actions
      addPromptTemplate: (template) => set((state) => ({
        promptTemplates: [...state.promptTemplates, { ...template, id: uuidv4() }]
      })),

      updatePromptTemplate: (id, updates) => set((state) => ({
        promptTemplates: state.promptTemplates.map((t) =>
          t.id === id ? { ...t, ...updates } : t
        )
      })),

      deletePromptTemplate: (id) => set((state) => ({
        promptTemplates: state.promptTemplates.filter((t) => t.id !== id)
      })),

      // UI Actions
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setSettingsOpen: (open) => set({ settingsOpen: open }),
      setCharacterEditorOpen: (open) => set({ characterEditorOpen: open }),
      setGroupEditorOpen: (open) => set({ groupEditorOpen: open }),
      setLoading: (loading) => set({ isLoading: loading }),
      setGenerating: (generating) => set({ isGenerating: generating }),
      setError: (error) => set({ error }),

      // Utility Functions
      getActiveSession: () => {
        const state = get();
        return state.sessions.find((s) => s.id === state.activeSessionId);
      },

      getActiveCharacter: () => {
        const state = get();
        return state.characters.find((c) => c.id === state.activeCharacterId);
      },

      getCharacterById: (id) => get().characters.find((c) => c.id === id),
      getSessionById: (id) => get().sessions.find((s) => s.id === id)
    }),
    {
      name: 'tavernflow-storage',
      partialize: (state) => ({
        characters: state.characters,
        sessions: state.sessions,
        groups: state.groups,
        backgrounds: state.backgrounds,
        llmConfigs: state.llmConfigs,
        ttsConfigs: state.ttsConfigs,
        promptTemplates: state.promptTemplates,
        settings: state.settings,
        soundTriggers: state.soundTriggers,
        soundCollections: state.soundCollections,
        personas: state.personas,
        backgroundPacks: state.backgroundPacks,
        backgroundIndex: state.backgroundIndex,
        lorebooks: state.lorebooks,
        activeLorebookIds: state.activeLorebookIds,
        activeSessionId: state.activeSessionId,
        activeCharacterId: state.activeCharacterId,
        activeGroupId: state.activeGroupId,
        activeBackground: state.activeBackground,
        activeOverlayBack: state.activeOverlayBack,
        activeOverlayFront: state.activeOverlayFront,
        activePersonaId: state.activePersonaId
      }),
      merge: (persistedState: unknown, currentState) => {
        const persisted = persistedState as Record<string, unknown> | undefined;
        if (!persisted) return currentState;
        
        // Merge settings with defaults to ensure new fields exist
        const persistedSettings = persisted.settings as Record<string, unknown> | undefined;
        const mergedSettings = {
          ...currentState.settings,
          ...(persistedSettings || {}),
          // Ensure sound settings exist with defaults
          sound: {
            ...currentState.settings.sound,
            ...((persistedSettings?.sound as Record<string, unknown>) || {})
          },
          // Ensure backgroundTriggers settings exist with defaults
          backgroundTriggers: {
            ...currentState.settings.backgroundTriggers,
            ...((persistedSettings?.backgroundTriggers as Record<string, unknown>) || {})
          },
          // Ensure chatLayout settings exist with defaults
          chatLayout: {
            ...currentState.settings.chatLayout,
            ...((persistedSettings?.chatLayout as Record<string, unknown>) || {})
          }
        };

        // Ensure characters have the characterNote field
        const persistedCharacters = persisted.characters as CharacterCard[] | undefined;
        const mergedCharacters = (persistedCharacters || currentState.characters).map(char => ({
          ...char,
          characterNote: char.characterNote ?? '' // Add characterNote if missing
        }));

        // Ensure personas exist with default if not present
        const persistedPersonas = persisted.personas as Persona[] | undefined;
        const mergedPersonas = persistedPersonas && persistedPersonas.length > 0 
          ? persistedPersonas 
          : currentState.personas;

        // Migrate groups to new format with members array
        const persistedGroups = persisted.groups as CharacterGroup[] | undefined;
        const mergedGroups = (persistedGroups || currentState.groups).map(group => {
          // If group already has members array, just ensure all fields exist
          if (group.members && group.members.length > 0) {
            return {
              ...group,
              maxResponsesPerTurn: group.maxResponsesPerTurn ?? 3,
              allowMentions: group.allowMentions ?? true,
              mentionTriggers: group.mentionTriggers ?? [],
              conversationStyle: group.conversationStyle ?? 'sequential',
              characterIds: group.characterIds || group.members.map(m => m.characterId)
            };
          }
          
          // Migrate from characterIds to members
          const characterIds = group.characterIds || [];
          const members: GroupMember[] = characterIds.map((characterId, index) => ({
            characterId,
            role: 'member' as const,
            isActive: true,
            isPresent: true,
            joinOrder: index
          }));
          
          return {
            ...group,
            members,
            characterIds,
            maxResponsesPerTurn: group.maxResponsesPerTurn ?? 3,
            allowMentions: group.allowMentions ?? true,
            mentionTriggers: group.mentionTriggers ?? [],
            conversationStyle: group.conversationStyle ?? 'sequential'
          };
        });

        return {
          ...currentState,
          ...persisted,
          characters: mergedCharacters,
          settings: mergedSettings,
          personas: mergedPersonas,
          groups: mergedGroups,
          activePersonaId: (persisted.activePersonaId as string) || 'default',
          soundTriggers: (persisted.soundTriggers as SoundTrigger[]) || currentState.soundTriggers,
          soundCollections: currentState.soundCollections, // Always use fresh collections from API
          backgroundPacks: (persisted.backgroundPacks as BackgroundPack[]) || currentState.backgroundPacks,
          backgroundIndex: currentState.backgroundIndex, // Always use fresh index from API
          lorebooks: (persisted.lorebooks as Lorebook[]) || currentState.lorebooks,
          activeLorebookIds: (persisted.activeLorebookIds as string[]) || currentState.activeLorebookIds
        };
      }
    }
  )
);
