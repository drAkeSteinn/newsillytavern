// ============================================
// Session Slice - Chat sessions and messages
// ============================================

import type { ChatSession, ChatMessage, SessionStats, CharacterSessionStats } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { processMessageTemplate } from '@/lib/prompt-template';

// ============================================
// Helper Functions for Session Stats
// ============================================

/**
 * Create default character stats from statsConfig
 */
function createDefaultCharacterStats(
  statsConfig?: { enabled?: boolean; attributes?: Array<{ key: string; defaultValue: number | string }> }
): CharacterSessionStats {
  const attributeValues: Record<string, number | string> = {};
  const lastUpdated: Record<string, number> = {};
  const now = Date.now();
  
  if (statsConfig?.enabled && statsConfig.attributes) {
    for (const attr of statsConfig.attributes) {
      attributeValues[attr.key] = attr.defaultValue;
      lastUpdated[attr.key] = now;
    }
  }
  
  return {
    attributeValues,
    lastUpdated,
    changeLog: [],
  };
}

/**
 * Initialize session stats for a character or group of characters
 */
function initializeSessionStatsForCharacters(
  characters: Array<{ id: string; statsConfig?: { enabled?: boolean; attributes?: Array<{ key: string; defaultValue: number | string }> } }>
): SessionStats {
  const now = Date.now();
  const characterStats: Record<string, CharacterSessionStats> = {};
  
  for (const char of characters) {
    characterStats[char.id] = createDefaultCharacterStats(char.statsConfig);
  }
  
  return {
    characterStats,
    initialized: true,
    lastModified: now,
  };
}

export interface SessionSlice {
  // State
  sessions: ChatSession[];
  activeSessionId: string | null;

  // Session Actions
  createSession: (characterId: string, groupId?: string) => string;
  updateSession: (id: string, updates: Partial<ChatSession>) => void;
  deleteSession: (id: string) => void;
  setActiveSession: (id: string | null) => void;
  resetSessionStats: (sessionId: string) => void;
  clearChat: (sessionId: string) => void;

  // Message Actions
  addMessage: (sessionId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  updateMessage: (sessionId: string, messageId: string, content: string) => void;
  deleteMessage: (sessionId: string, messageId: string) => void;
  
  // Swipe Actions
  swipeMessage: (sessionId: string, messageId: string, direction: 'left' | 'right') => number;
  addSwipeAlternative: (sessionId: string, messageId: string, content: string, metadata?: ChatMessage['metadata']) => void;
  setCurrentSwipe: (sessionId: string, messageId: string, swipeIndex: number) => void;
  getSwipeCount: (sessionId: string, messageId: string) => number;

  // Utilities
  getActiveSession: () => ChatSession | undefined;
  getSessionById: (id: string) => ChatSession | undefined;
}

export const createSessionSlice = (set: any, get: any): SessionSlice => ({
  // Initial State
  sessions: [],
  activeSessionId: null,

  // Session Actions
  createSession: (characterId, groupId) => {
    const id = uuidv4();
    const character = get().getCharacterById(characterId);
    const activePersona = get().getActivePersona?.();
    const userName = activePersona?.name || 'User';

    // Process the first message with template variables
    const processedFirstMes = character
      ? processMessageTemplate(character.firstMes, character.name, userName)
      : '';

    const initialContent = processedFirstMes || '';
    
    // Initialize session stats
    let sessionStats: SessionStats | undefined;
    
    if (groupId) {
      // Group chat: initialize stats for all group members
      const group = get().getGroupById?.(groupId);
      if (group?.members) {
        const groupCharacters = group.members
          .map((m: any) => get().getCharacterById(m.characterId))
          .filter((c: any) => c !== undefined);
        sessionStats = initializeSessionStatsForCharacters(groupCharacters);
      }
    } else if (character) {
      // Single character chat
      sessionStats = initializeSessionStatsForCharacters([character]);
    }
    
    set((state: any) => ({
      sessions: [...state.sessions, {
        id,
        characterId,
        groupId,
        name: character ? `Chat with ${character.name}` : 'New Chat',
        messages: character ? [{
          id: uuidv4(),
          characterId,
          role: 'assistant' as const,
          content: initialContent,
          timestamp: new Date().toISOString(),
          isDeleted: false,
          swipeId: uuidv4(),
          swipeIndex: 0,
          swipes: [initialContent]  // Initialize with first swipe
        }] : [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sessionStats  // Include initialized session stats
      }],
      activeSessionId: id,
      activeCharacterId: characterId,
      activeGroupId: groupId || null
    }));

    return id;
  },

  updateSession: (id, updates) => set((state: any) => ({
    sessions: state.sessions.map((s: ChatSession) =>
      s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s
    )
  })),

  deleteSession: (id) => set((state: any) => ({
    sessions: state.sessions.filter((s: ChatSession) => s.id !== id),
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

  resetSessionStats: (sessionId) => {
    const session = get().getSessionById(sessionId);
    if (!session) return;
    
    // Get characters for this session
    let characters: Array<{ id: string; statsConfig?: any }> = [];
    
    if (session.groupId) {
      // Group chat: get all group members
      const group = get().getGroupById?.(session.groupId);
      if (group?.members) {
        characters = group.members
          .map((m: any) => get().getCharacterById(m.characterId))
          .filter((c: any) => c !== undefined);
      }
    } else {
      // Single character chat
      const character = get().getCharacterById(session.characterId);
      if (character) {
        characters = [character];
      }
    }
    
    // Reset session stats to default values
    const newSessionStats = initializeSessionStatsForCharacters(characters);
    
    set((state: any) => ({
      sessions: state.sessions.map((s: ChatSession) =>
        s.id === sessionId ? { 
          ...s, 
          sessionStats: newSessionStats,
          updatedAt: new Date().toISOString() 
        } : s
      ),
    }));
  },

  clearChat: (sessionId) => {
    const session = get().getSessionById(sessionId);
    if (!session) return;
    
    // Get character for first message
    const character = get().getCharacterById(session.characterId);
    const activePersona = get().getActivePersona?.();
    const userName = activePersona?.name || 'User';
    
    // Process the first message with template variables
    const processedFirstMes = character
      ? processMessageTemplate(character.firstMes, character.name, userName)
      : '';
    
    // Get characters for stats reset
    let characters: Array<{ id: string; statsConfig?: any }> = [];
    
    if (session.groupId) {
      const group = get().getGroupById?.(session.groupId);
      if (group?.members) {
        characters = group.members
          .map((m: any) => get().getCharacterById(m.characterId))
          .filter((c: any) => c !== undefined);
      }
    } else {
      if (character) {
        characters = [character];
      }
    }
    
    // Reset session stats to default values
    const newSessionStats = initializeSessionStatsForCharacters(characters);
    
    // Reset messages to only the first message
    const initialContent = processedFirstMes || '';
    
    set((state: any) => ({
      sessions: state.sessions.map((s: ChatSession) =>
        s.id === sessionId ? {
          ...s,
          messages: character ? [{
            id: uuidv4(),
            characterId: session.characterId,
            role: 'assistant' as const,
            content: initialContent,
            timestamp: new Date().toISOString(),
            isDeleted: false,
            swipeId: uuidv4(),
            swipeIndex: 0,
            swipes: [initialContent]
          }] : [],
          sessionStats: newSessionStats,
          updatedAt: new Date().toISOString()
        } : s
      ),
    }));
  },

  // Message Actions
  addMessage: (sessionId, message) => set((state: any) => {
    // Ensure swipes array is initialized
    const content = message.content || '';
    const swipes = message.swipes?.length ? message.swipes : [content];
    
    return {
      sessions: state.sessions.map((s: ChatSession) =>
        s.id === sessionId ? {
          ...s,
          messages: [...s.messages, {
            ...message,
            id: uuidv4(),
            timestamp: new Date().toISOString(),
            content,
            swipes,
            swipeIndex: message.swipeIndex ?? 0
          }],
          updatedAt: new Date().toISOString()
        } : s
      )
    };
  }),

  updateMessage: (sessionId, messageId, content) => set((state: any) => ({
    sessions: state.sessions.map((s: ChatSession) =>
      s.id === sessionId ? {
        ...s,
        messages: s.messages.map((m: ChatMessage) =>
          m.id === messageId ? { 
            ...m, 
            content,
            // Also update the current swipe, or initialize swipes if missing
            swipes: m.swipes?.length 
              ? m.swipes.map((s, i) => i === (m.swipeIndex || 0) ? content : s)
              : [content]
          } : m
        ),
        updatedAt: new Date().toISOString()
      } : s
    )
  })),

  deleteMessage: (sessionId, messageId) => set((state: any) => ({
    sessions: state.sessions.map((s: ChatSession) =>
      s.id === sessionId ? {
        ...s,
        messages: s.messages.map((m: ChatMessage) =>
          m.id === messageId ? { ...m, isDeleted: true } : m
        ),
        updatedAt: new Date().toISOString()
      } : s
    )
  })),

  // Swipe Actions
  swipeMessage: (sessionId, messageId, direction) => {
    let newIndex = 0;
    
    set((state: any) => ({
      sessions: state.sessions.map((s: ChatSession) => {
        if (s.id !== sessionId) return s;
        return {
          ...s,
          messages: s.messages.map((m: ChatMessage) => {
            if (m.id !== messageId) return m;
            
            const maxIndex = (m.swipes?.length || 1) - 1;
            
            if (direction === 'right') {
              newIndex = Math.min(m.swipeIndex + 1, maxIndex);
            } else {
              newIndex = Math.max(0, m.swipeIndex - 1);
            }
            
            return { 
              ...m, 
              swipeIndex: newIndex,
              content: m.swipes?.[newIndex] || m.content
            };
          })
        };
      })
    }));
    
    return newIndex;
  },

  addSwipeAlternative: (sessionId, messageId, content, metadata) => set((state: any) => ({
    sessions: state.sessions.map((s: ChatSession) => {
      if (s.id !== sessionId) return s;
      return {
        ...s,
        messages: s.messages.map((m: ChatMessage) => {
          if (m.id !== messageId) return m;
          
          const swipes = [...(m.swipes || [m.content]), content];
          const newIndex = swipes.length - 1;
          
          return {
            ...m,
            swipes,
            swipeIndex: newIndex,
            content,
            metadata: metadata || m.metadata
          };
        }),
        updatedAt: new Date().toISOString()
      };
    })
  })),

  setCurrentSwipe: (sessionId, messageId, swipeIndex) => set((state: any) => ({
    sessions: state.sessions.map((s: ChatSession) => {
      if (s.id !== sessionId) return s;
      return {
        ...s,
        messages: s.messages.map((m: ChatMessage) => {
          if (m.id !== messageId) return m;
          if (swipeIndex < 0 || swipeIndex >= (m.swipes?.length || 1)) return m;
          
          return {
            ...m,
            swipeIndex,
            content: m.swipes?.[swipeIndex] || m.content
          };
        })
      };
    })
  })),

  getSwipeCount: (sessionId, messageId) => {
    const state = get();
    const session = state.sessions.find((s: ChatSession) => s.id === sessionId);
    if (!session) return 1;
    const message = session.messages.find((m: ChatMessage) => m.id === messageId);
    return message?.swipes?.length || 1;
  },

  // Utilities
  getActiveSession: () => {
    const state = get();
    return state.sessions.find((s: ChatSession) => s.id === state.activeSessionId);
  },

  getSessionById: (id) => get().sessions.find((s: ChatSession) => s.id === id),
});
