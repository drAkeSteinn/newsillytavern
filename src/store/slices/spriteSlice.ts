// ============================================
// Sprite Slice - Unified Sprite State Management
// Supports both single character and group chat
// ============================================
//
// ⚠️ SPRITE PRIORITY SYSTEM - CRITICAL - DO NOT MODIFY ⚠️
//
// This module implements the sprite priority system. The rules are:
//
// 1. TRIGGER SPRITE HAS ABSOLUTE PRIORITY
//    - Once set, triggerSpriteUrl MUST NOT be cleared by:
//      * startGenerationForCharacter()
//      * endGenerationForCharacter()
//      * State changes (talk/thinking/idle)
//    - Only cleared by:
//      * Timer expiration (returnToIdleMs > 0)
//      * New trigger replacing it
//      * User manual action
//
// 2. TIMER BEHAVIOR
//    - returnToIdleMs = 0: Trigger persists indefinitely
//    - returnToIdleMs > 0: Trigger clears after X ms
//
// 3. RETURN MODE
//    - 'clear': Clear trigger, show state-based sprite (talk/thinking/idle)
//    - 'idle': Clear trigger, show idle sprite
//    - 'talk': Clear trigger, show talk sprite
//    - 'thinking': Clear trigger, show thinking sprite
//
// See: /docs/SPRITE_PRIORITY_SYSTEM.md for full documentation
//
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
  // Current sprite from trigger (HIGHEST PRIORITY - DO NOT OVERRIDE)
  triggerSpriteUrl: string | null;
  triggerSpriteLabel: string | null;
  
  // Return to idle state for this character
  returnToIdle: {
    active: boolean;
    scheduledAt: number;
    returnAt: number;
    triggerSpriteUrl: string;  // URL of trigger sprite (to verify)
    returnToMode: 'idle' | 'talk' | 'thinking' | 'clear';  // What state to return to
    returnSpriteUrl: string;     // URL to return to (if mode is idle/talk/thinking)
    returnSpriteLabel: string | null;
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
    returnToMode: 'clear',
    returnSpriteUrl: '',
    returnSpriteLabel: null,
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
    returnToMode: 'idle' | 'talk' | 'thinking' | 'clear',
    returnSpriteUrl: string,
    returnSpriteLabel: string | null,
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
    returnToMode: 'clear',
    returnSpriteUrl: '',
    returnSpriteLabel: null,
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
              returnToMode: 'clear',
              returnSpriteUrl: '',
              returnSpriteLabel: null,
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
    returnToMode: 'idle' | 'talk' | 'thinking' | 'clear',
    returnSpriteUrl: string,
    returnSpriteLabel: string | null,
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
        
        // Execute return based on mode
        set((state: any) => {
          const currentCharState = state.characterSpriteStates[characterId];
          if (!currentCharState) return state;
          
          // If mode is 'clear', just clear the trigger sprite and let normal logic determine what to show
          // Otherwise, set the trigger sprite to the return sprite
          const shouldClearTrigger = returnToMode === 'clear';
          
          return {
            characterSpriteStates: {
              ...state.characterSpriteStates,
              [characterId]: {
                ...currentCharState,
                triggerSpriteUrl: shouldClearTrigger ? null : currentCharState.returnToIdle.returnSpriteUrl,
                triggerSpriteLabel: shouldClearTrigger ? null : currentCharState.returnToIdle.returnSpriteLabel,
                returnToIdle: {
                  active: false,
                  scheduledAt: 0,
                  returnAt: 0,
                  triggerSpriteUrl: '',
                  returnToMode: 'clear',
                  returnSpriteUrl: '',
                  returnSpriteLabel: null,
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
              returnToMode,
              returnSpriteUrl,
              returnSpriteLabel,
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
              returnToMode: 'clear',
              returnSpriteUrl: '',
              returnSpriteLabel: null,
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
      
      // If mode is 'clear', just clear the trigger sprite and let normal logic determine what to show
      const shouldClearTrigger = currentCharState.returnToIdle.returnToMode === 'clear';
      
      return {
        characterSpriteStates: {
          ...state.characterSpriteStates,
          [characterId]: {
            ...currentCharState,
            triggerSpriteUrl: shouldClearTrigger ? null : currentCharState.returnToIdle.returnSpriteUrl,
            triggerSpriteLabel: shouldClearTrigger ? null : currentCharState.returnToIdle.returnSpriteLabel,
            returnToIdle: {
              active: false,
              scheduledAt: 0,
              returnAt: 0,
              triggerSpriteUrl: '',
              returnToMode: 'clear',
              returnSpriteUrl: '',
              returnSpriteLabel: null,
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
    set((state: any) => {
      const currentCharState = state.characterSpriteStates[characterId] || createDefaultCharacterState();
      
      // Check if there's an active trigger sprite
      // Trigger sprites have priority over thinking/talk states
      const hasActiveTrigger = currentCharState.triggerSpriteUrl !== null;
      
      if (hasActiveTrigger) {
        // Keep the trigger sprite - it has priority
        // The return to idle timer (if any) will handle transitioning back
        return {
          characterSpriteStates: {
            ...state.characterSpriteStates,
            [characterId]: {
              ...currentCharState,
              // Keep triggerSpriteUrl and returnToIdle as they are
              spriteState: 'thinking',
              // Reset the flag for new generation (will be set to true if new trigger activates)
              triggerActivatedDuringGeneration: false,
            },
          },
        };
      }
      
      // No active trigger - proceed with normal generation start
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
              returnToMode: 'clear',
              returnSpriteUrl: '',
              returnSpriteLabel: null,
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
      
      // If there's an active trigger sprite (with or without return to idle),
      // keep it - the return to idle timer will handle transitioning back if scheduled
      const hasActiveTrigger = currentCharState.triggerSpriteUrl !== null;
      
      if (hasActiveTrigger) {
        // Trigger sprite is active, keep it
        // The return to idle timer (if any) will handle the transition
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
      
      // No trigger active, clear everything
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
      get().scheduleReturnToIdleForCharacter(activeCharId, currentUrl, 'clear', idleUrl, idleLabel, delayMs);
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
