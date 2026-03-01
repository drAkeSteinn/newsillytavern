// ============================================
// Session Slice - Chat sessions and messages
// ============================================

import type { ChatSession, ChatMessage } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { processMessageTemplate } from '@/lib/prompt-template';

export interface SessionSlice {
  // State
  sessions: ChatSession[];
  activeSessionId: string | null;

  // Session Actions
  createSession: (characterId: string, groupId?: string) => string;
  updateSession: (id: string, updates: Partial<ChatSession>) => void;
  deleteSession: (id: string) => void;
  setActiveSession: (id: string | null) => void;

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
        updatedAt: new Date().toISOString()
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
