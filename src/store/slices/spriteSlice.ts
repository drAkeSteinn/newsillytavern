// ============================================
// Sprite Slice - Unified Sprite State Management
// Supports both single character and group chat
// ============================================

import type { 
  SpriteState, 
  SpriteLockState, 
  SpriteTriggerHit, 
  SpritePack, 
  SpriteIndex, 
  SpriteLibraries 
} from '@/types';
import { v4 as uuidv4 } from 'uuid';

// ============================================
// Per-Character Sprite State
// ============================================

export interface CharacterSpriteState {
  // Current sprite from trigger (highest priority)
  triggerSpriteUrl: string | null;
  triggerSpriteLabel: string | null;
  
  // Return to idle state for this character
  returnToIdle: {
    active: boolean;
    scheduledAt: number;
    returnAt: number;
    triggerSpriteUrl: string;  // URL of trigger sprite (to verify)
    idleSpriteUrl: string;     // URL to return to
    idleSpriteLabel: string | null;
  };
  
  // Track if trigger was activated during current generation
  triggerActivatedDuringGeneration: boolean;
  
  // Current sprite state (thinking/talk/idle)
  spriteState: SpriteState;
}

// Default state for a character
export const createDefaultCharacterState = (): CharacterSpriteState => ({
  triggerSpriteUrl: null,
  triggerSpriteLabel: null,
  returnToIdle: {
    active: false,
    scheduledAt: 0,
    returnAt: 0,
    triggerSpriteUrl: '',
    idleSpriteUrl: '',
    idleSpriteLabel: null,
  },
  triggerActivatedDuringGeneration: false,
  spriteState: 'idle',
});

// ============================================
// Sprite Slice Interface
// ============================================

export interface SpriteSlice {
  // Per-character sprite states (UNIFIED SYSTEM)
  characterSpriteStates: Record<string, CharacterSpriteState>;
  
  // Current sprite state for backward compatibility (single chat)
  currentSpriteState: SpriteState;
  
  // Sprite lock state (global, applies to active character)
  spriteLock: SpriteLockState;
  lockIntervalMs: number;
  lockIntervalId: ReturnType<typeof setInterval> | null;

  // Sprite packs and index (global resources)
  spritePacks: SpritePack[];
  spriteIndex: SpriteIndex;
  spriteLibraries: SpriteLibraries;

  // Last trigger info (for cooldowns)
  lastSpriteTriggerAt: number;
  lastSpritePackId: string | null;

  // ============================================
  // UNIFIED ACTIONS (work for both single and group)
  // ============================================
  
  // Get sprite state for a specific character
  getCharacterSpriteState: (characterId: string) => CharacterSpriteState;
  
  // Apply trigger for a specific character
  applyTriggerForCharacter: (characterId: string, hit: SpriteTriggerHit) => void;
  
  // Schedule return to idle for a specific character
  scheduleReturnToIdleForCharacter: (
    characterId: string,
    triggerUrl: string,
    idleUrl: string,
    idleLabel: string | null,
    delayMs: number
  ) => void;
  
  // Cancel return to idle for a specific character
  cancelReturnToIdleForCharacter: (characterId: string) => void;
  
  // Execute return to idle immediately for a specific character
  executeReturnToIdleForCharacter: (characterId: string) => void;
  
  // Get return to idle countdown for a character
  getReturnToIdleCountdownForCharacter: (characterId: string) => number;
  
  // Check if return to idle is scheduled for a character
  isReturnToIdleScheduledForCharacter: (characterId: string) => boolean;
  
  // Start generation for a character (resets trigger flag, sets thinking state)
  startGenerationForCharacter: (characterId: string) => void;
  
  // End generation for a character (clears if no trigger, keeps if trigger active)
  endGenerationForCharacter: (characterId: string) => void;
  
  // Clear sprite state for a character
  clearCharacterSpriteState: (characterId: string) => void;
  
  // Set sprite state for a character
  setSpriteStateForCharacter: (characterId: string, state: SpriteState) => void;

  // ============================================
  // LEGACY ACTIONS (for backward compatibility)
  // ============================================
  
  // These work on the "active" character (single chat)
  setSpriteState: (state: SpriteState) => void;
  setSpriteUrl: (url: string | null, label?: string | null) => void;
  currentSpriteUrl: string | null;
  currentSpriteLabel: string | null;
  triggerActivatedDuringGeneration: boolean;
  returnToIdle: CharacterSpriteState['returnToIdle'];
  
  // Lock management (still global)
  setSpriteLock: (lock: Partial<SpriteLockState>) => void;
  clearSpriteLock: () => void;
  applySpriteLock: (url: string, durationMs: number, intervalMs?: number) => void;
  reapplySpriteLock: () => void;
  setLockInterval: (intervalMs: number) => void;
  
  // Legacy return to idle (uses active character)
  scheduleReturnToIdle: (currentUrl: string, idleUrl: string, idleLabel: string | null, delayMs: number) => void;
  cancelReturnToIdle: () => void;
  executeReturnToIdle: () => void;

  // Legacy trigger system
  applySpriteTrigger: (hit: SpriteTriggerHit) => void;
  isSpriteLocked: () => boolean;
  isReturnToIdleScheduled: () => boolean;
  getReturnToIdleCountdown: () => number;

  // Legacy generation tracking
  startGeneration: () => void;
  endGeneration: () => void;
  wasTriggerActivated: () => boolean;

  // Packs management
  setSpritePacks: (packs: SpritePack[]) => void;
  addSpritePack: (pack: Omit<SpritePack, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateSpritePack: (id: string, updates: Partial<SpritePack>) => void;
  deleteSpritePack: (id: string) => void;
  cloneSpritePack: (id: string) => void;
  toggleSpritePack: (id: string) => void;
  setSpriteIndex: (index: SpriteIndex) => void;
  setSpriteLibraries: (libraries: SpriteLibraries) => void;

  // Sprite URL lookup
  getSpriteUrlByLabel: (label: string) => string | null;
}

// ============================================
// Timer Management (per character)
// ============================================

// Map of characterId -> timeoutId for return to idle
const _returnToIdleTimers = new Map<string, ReturnType<typeof setTimeout>>();
let _lockIntervalId: ReturnType<typeof setInterval> | null = null;

// Helper to clear timer for a character
const clearReturnToIdleTimer = (characterId: string) => {
  const timer = _returnToIdleTimers.get(characterId);
  if (timer) {
    clearTimeout(timer);
    _returnToIdleTimers.delete(characterId);
  }
};

// Callback for when return to idle executes
let _onReturnToIdle: ((characterId?: string) => void) | null = null;

export const setReturnToIdleCallback = (callback: ((characterId?: string) => void) | null) => {
  _onReturnToIdle = callback;
};

// ============================================
// Slice Creation
// ============================================

export const createSpriteSlice = (set: any, get: any): SpriteSlice => ({
  // ============================================
  // Initial State
  // ============================================
  
  characterSpriteStates: {},
  currentSpriteState: 'idle',
  
  // Legacy state values (for backward compatibility)
  currentSpriteUrl: null,
  currentSpriteLabel: null,
  triggerActivatedDuringGeneration: false,
  returnToIdle: {
    active: false,
    scheduledAt: 0,
    returnAt: 0,
    triggerSpriteUrl: '',
    idleSpriteUrl: '',
    idleSpriteLabel: null,
  },

  spriteLock: {
    active: false,
    spriteUrl: '',
    until: 0,
    lastApplyAt: 0,
  },

  lockIntervalMs: 0,
  lockIntervalId: null,

  spritePacks: [],
  spriteIndex: {
    sprites: [],
    lastUpdated: 0,
    source: '',
  },
  spriteLibraries: {
    actions: [],
    poses: [],
    clothes: [],
  },

  lastSpriteTriggerAt: 0,
  lastSpritePackId: null,

  // ============================================
  // UNIFIED ACTIONS
  // ============================================
  
  getCharacterSpriteState: (characterId: string) => {
    const state = get();
    return state.characterSpriteStates[characterId] || createDefaultCharacterState();
  },
  
  applyTriggerForCharacter: (characterId: string, hit: SpriteTriggerHit) => {
    const now = Date.now();
    
    // Clear any pending return to idle for this character
    clearReturnToIdleTimer(characterId);
    
    set((state: any) => {
      const currentCharState = state.characterSpriteStates[characterId] || createDefaultCharacterState();
      
      return {
        characterSpriteStates: {
          ...state.characterSpriteStates,
          [characterId]: {
            ...currentCharState,
            triggerSpriteUrl: hit.spriteUrl,
            triggerSpriteLabel: hit.spriteLabel,
            triggerActivatedDuringGeneration: true,
            spriteState: 'idle', // Triggers set state to idle
            returnToIdle: {
              active: false,
              scheduledAt: 0,
              returnAt: 0,
              triggerSpriteUrl: '',
              idleSpriteUrl: '',
              idleSpriteLabel: null,
            },
          },
        },
        lastSpriteTriggerAt: now,
        lastSpritePackId: hit.packId,
      };
    });
  },
  
  scheduleReturnToIdleForCharacter: (
    characterId: string,
    triggerUrl: string,
    idleUrl: string,
    idleLabel: string | null,
    delayMs: number
  ) => {
    // Clear any existing timer for this character
    clearReturnToIdleTimer(characterId);
    
    const now = Date.now();
    
    // Create new timer
    const timer = setTimeout(() => {
      const state = get();
      const charState = state.characterSpriteStates[characterId];
      
      // Only execute if the trigger sprite is still the one we scheduled for
      if (charState?.returnToIdle.active && 
          charState.triggerSpriteUrl === charState.returnToIdle.triggerSpriteUrl) {
        // Execute return to idle
        set((state: any) => {
          const currentCharState = state.characterSpriteStates[characterId];
          if (!currentCharState) return state;
          
          return {
            characterSpriteStates: {
              ...state.characterSpriteStates,
              [characterId]: {
                ...currentCharState,
                triggerSpriteUrl: currentCharState.returnToIdle.idleSpriteUrl,
                triggerSpriteLabel: currentCharState.returnToIdle.idleSpriteLabel,
                returnToIdle: {
                  active: false,
                  scheduledAt: 0,
                  returnAt: 0,
                  triggerSpriteUrl: '',
                  idleSpriteUrl: '',
                  idleSpriteLabel: null,
                },
              },
            },
          };
        });
        
        // Call callback if set
        if (_onReturnToIdle) {
          _onReturnToIdle(characterId);
        }
      }
      
      _returnToIdleTimers.delete(characterId);
    }, delayMs);
    
    _returnToIdleTimers.set(characterId, timer);
    
    // Update state
    set((state: any) => {
      const currentCharState = state.characterSpriteStates[characterId] || createDefaultCharacterState();
      
      return {
        characterSpriteStates: {
          ...state.characterSpriteStates,
          [characterId]: {
            ...currentCharState,
            returnToIdle: {
              active: true,
              scheduledAt: now,
              returnAt: now + delayMs,
              triggerSpriteUrl: triggerUrl,
              idleSpriteUrl: idleUrl,
              idleSpriteLabel: idleLabel,
            },
          },
        },
      };
    });
  },
  
  cancelReturnToIdleForCharacter: (characterId: string) => {
    clearReturnToIdleTimer(characterId);
    
    set((state: any) => {
      const currentCharState = state.characterSpriteStates[characterId];
      if (!currentCharState) return state;
      
      return {
        characterSpriteStates: {
          ...state.characterSpriteStates,
          [characterId]: {
            ...currentCharState,
            returnToIdle: {
              active: false,
              scheduledAt: 0,
              returnAt: 0,
              triggerSpriteUrl: '',
              idleSpriteUrl: '',
              idleSpriteLabel: null,
            },
          },
        },
      };
    });
  },
  
  executeReturnToIdleForCharacter: (characterId: string) => {
    clearReturnToIdleTimer(characterId);
    
    set((state: any) => {
      const currentCharState = state.characterSpriteStates[characterId];
      if (!currentCharState || !currentCharState.returnToIdle.active) return state;
      
      return {
        characterSpriteStates: {
          ...state.characterSpriteStates,
          [characterId]: {
            ...currentCharState,
            triggerSpriteUrl: currentCharState.returnToIdle.idleSpriteUrl,
            triggerSpriteLabel: currentCharState.returnToIdle.idleSpriteLabel,
            returnToIdle: {
              active: false,
              scheduledAt: 0,
              returnAt: 0,
              triggerSpriteUrl: '',
              idleSpriteUrl: '',
              idleSpriteLabel: null,
            },
          },
        },
      };
    });
  },
  
  getReturnToIdleCountdownForCharacter: (characterId: string) => {
    const state = get();
    const charState = state.characterSpriteStates[characterId];
    if (!charState?.returnToIdle.active) return 0;
    const remaining = charState.returnToIdle.returnAt - Date.now();
    return Math.max(0, remaining);
  },
  
  isReturnToIdleScheduledForCharacter: (characterId: string) => {
    const state = get();
    const charState = state.characterSpriteStates[characterId];
    return charState?.returnToIdle.active || false;
  },
  
  startGenerationForCharacter: (characterId: string) => {
    // Clear any pending return to idle for this character
    clearReturnToIdleTimer(characterId);
    
    set((state: any) => {
      const currentCharState = state.characterSpriteStates[characterId] || createDefaultCharacterState();
      
      return {
        characterSpriteStates: {
          ...state.characterSpriteStates,
          [characterId]: {
            ...currentCharState,
            triggerSpriteUrl: null,
            triggerSpriteLabel: null,
            triggerActivatedDuringGeneration: false,
            spriteState: 'thinking',
            returnToIdle: {
              active: false,
              scheduledAt: 0,
              returnAt: 0,
              triggerSpriteUrl: '',
              idleSpriteUrl: '',
              idleSpriteLabel: null,
            },
          },
        },
      };
    });
  },
  
  endGenerationForCharacter: (characterId: string) => {
    set((state: any) => {
      const currentCharState = state.characterSpriteStates[characterId];
      if (!currentCharState) return state;
      
      // If trigger was activated, keep the sprite (return to idle timer will handle it)
      // If not, clear the trigger sprite
      if (!currentCharState.triggerActivatedDuringGeneration) {
        return {
          characterSpriteStates: {
            ...state.characterSpriteStates,
            [characterId]: {
              ...currentCharState,
              triggerSpriteUrl: null,
              triggerSpriteLabel: null,
              spriteState: 'idle',
            },
          },
        };
      } else {
        // Trigger was activated, keep the current sprite
        return {
          characterSpriteStates: {
            ...state.characterSpriteStates,
            [characterId]: {
              ...currentCharState,
              spriteState: 'idle',
            },
          },
        };
      }
    });
  },
  
  clearCharacterSpriteState: (characterId: string) => {
    clearReturnToIdleTimer(characterId);
    
    set((state: any) => {
      const newStates = { ...state.characterSpriteStates };
      delete newStates[characterId];
      return { characterSpriteStates: newStates };
    });
  },
  
  setSpriteStateForCharacter: (characterId: string, spriteState: SpriteState) => {
    set((state: any) => {
      const currentCharState = state.characterSpriteStates[characterId] || createDefaultCharacterState();
      
      return {
        characterSpriteStates: {
          ...state.characterSpriteStates,
          [characterId]: {
            ...currentCharState,
            spriteState,
          },
        },
      };
    });
  },

  // ============================================
  // LEGACY ACTIONS (for backward compatibility with single chat)
  // ============================================
  
  setSpriteState: (state: SpriteState) => {
    set({ currentSpriteState: state });
  },

  setSpriteUrl: (url: string | null, label: string | null = null) => {
    // This is now a no-op for the unified system
    // The trigger system handles sprite URLs per character
  },

  // Lock management
  setSpriteLock: (lock: Partial<SpriteLockState>) => set((state: any) => ({
    spriteLock: { ...state.spriteLock, ...lock },
  })),

  clearSpriteLock: () => {
    if (_lockIntervalId) {
      clearInterval(_lockIntervalId);
      _lockIntervalId = null;
    }
    
    set({
      spriteLock: {
        active: false,
        spriteUrl: '',
        until: 0,
        lastApplyAt: 0,
      },
      lockIntervalMs: 0,
      lockIntervalId: null,
    });
  },

  applySpriteLock: (url: string, durationMs: number, intervalMs: number = 0) => {
    const now = Date.now();
    
    if (_lockIntervalId) {
      clearInterval(_lockIntervalId);
      _lockIntervalId = null;
    }
    
    if (intervalMs > 0) {
      _lockIntervalId = setInterval(() => {
        const state = get();
        if (state.spriteLock.active && state.spriteLock.spriteUrl) {
          set({
            spriteLock: {
              ...state.spriteLock,
              lastApplyAt: Date.now(),
            },
          });
        }
      }, intervalMs);
    }
    
    set({
      spriteLock: {
        active: true,
        spriteUrl: url,
        until: durationMs > 0 ? now + durationMs : 0,
        lastApplyAt: now,
      },
      lockIntervalMs: intervalMs,
      lockIntervalId: _lockIntervalId,
    });
  },

  reapplySpriteLock: () => {
    const state = get();
    if (state.spriteLock.active && state.spriteLock.spriteUrl) {
      set({
        spriteLock: {
          ...state.spriteLock,
          lastApplyAt: Date.now(),
        },
      });
    }
  },

  setLockInterval: (intervalMs: number) => {
    if (_lockIntervalId) {
      clearInterval(_lockIntervalId);
      _lockIntervalId = null;
    }
    
    if (intervalMs > 0) {
      _lockIntervalId = setInterval(() => {
        const state = get();
        if (state.spriteLock.active && state.spriteLock.spriteUrl) {
          set({
            spriteLock: {
              ...state.spriteLock,
              lastApplyAt: Date.now(),
            },
          });
        }
      }, intervalMs);
    }
    
    set({ lockIntervalMs: intervalMs, lockIntervalId: _lockIntervalId });
  },

  // Legacy return to idle - now uses active character concept
  scheduleReturnToIdle: (currentUrl: string, idleUrl: string, idleLabel: string | null, delayMs: number) => {
    // This is called by useSpriteTriggers hook
    // We need to find the active character or use a default
    const state = get();
    const activeCharId = Object.keys(state.characterSpriteStates)[0];
    if (activeCharId) {
      get().scheduleReturnToIdleForCharacter(activeCharId, currentUrl, idleUrl, idleLabel, delayMs);
    }
  },
  
  cancelReturnToIdle: () => {
    const state = get();
    const activeCharId = Object.keys(state.characterSpriteStates)[0];
    if (activeCharId) {
      get().cancelReturnToIdleForCharacter(activeCharId);
    }
  },
  
  executeReturnToIdle: () => {
    const state = get();
    const activeCharId = Object.keys(state.characterSpriteStates)[0];
    if (activeCharId) {
      get().executeReturnToIdleForCharacter(activeCharId);
    }
  },

  // Legacy trigger - apply to active character
  applySpriteTrigger: (hit: SpriteTriggerHit) => {
    const state = get();
    const activeCharId = Object.keys(state.characterSpriteStates)[0];
    if (activeCharId) {
      get().applyTriggerForCharacter(activeCharId, hit);
    }
  },

  isSpriteLocked: () => {
    const state = get();
    if (!state.spriteLock.active) return false;
    if (state.spriteLock.until === 0) return true;
    return Date.now() < state.spriteLock.until;
  },

  isReturnToIdleScheduled: () => {
    const state = get();
    const activeCharId = Object.keys(state.characterSpriteStates)[0];
    if (activeCharId) {
      return state.characterSpriteStates[activeCharId]?.returnToIdle.active || false;
    }
    return false;
  },

  getReturnToIdleCountdown: () => {
    const state = get();
    const activeCharId = Object.keys(state.characterSpriteStates)[0];
    if (activeCharId) {
      return get().getReturnToIdleCountdownForCharacter(activeCharId);
    }
    return 0;
  },

  // Legacy generation tracking
  startGeneration: () => {
    // For backward compatibility, we set the global state
    set({
      currentSpriteState: 'thinking',
    });
  },
  
  endGeneration: () => {
    set({
      currentSpriteState: 'idle',
    });
  },
  
  wasTriggerActivated: () => {
    const state = get();
    const activeCharId = Object.keys(state.characterSpriteStates)[0];
    if (activeCharId) {
      return state.characterSpriteStates[activeCharId]?.triggerActivatedDuringGeneration || false;
    }
    return false;
  },

  // Packs management
  setSpritePacks: (packs: SpritePack[]) => set({ spritePacks: packs }),

  addSpritePack: (pack: Omit<SpritePack, 'id' | 'createdAt' | 'updatedAt'>) => set((state: any) => ({
    spritePacks: [...state.spritePacks, {
      ...pack,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }],
  })),

  updateSpritePack: (id: string, updates: Partial<SpritePack>) => set((state: any) => ({
    spritePacks: state.spritePacks.map((p: SpritePack) =>
      p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
    ),
  })),

  deleteSpritePack: (id: string) => set((state: any) => ({
    spritePacks: state.spritePacks.filter((p: SpritePack) => p.id !== id),
  })),

  cloneSpritePack: (id: string) => set((state: any) => {
    const pack = state.spritePacks.find((p: SpritePack) => p.id === id);
    if (!pack) return state;
    return {
      spritePacks: [...state.spritePacks, {
        ...pack,
        id: uuidv4(),
        title: `${pack.title} (copy)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }],
    };
  }),

  toggleSpritePack: (id: string) => set((state: any) => ({
    spritePacks: state.spritePacks.map((p: SpritePack) =>
      p.id === id ? { ...p, active: !p.active, updatedAt: new Date().toISOString() } : p
    ),
  })),

  setSpriteIndex: (index: SpriteIndex) => set({ spriteIndex: index }),

  setSpriteLibraries: (libraries: SpriteLibraries) => set({ spriteLibraries: libraries }),

  getSpriteUrlByLabel: (label: string) => {
    const state = get();
    const entry = state.spriteIndex.sprites.find(s => s.label === label);
    return entry?.url || null;
  },
});
