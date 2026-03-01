// ============================================
// Triggers Module - Unified Trigger System
// ============================================
//
// This module provides a unified trigger detection and execution system
// that can be used by sounds, sprites, backgrounds, and future trigger types.
//
// Key Features:
// - Single pass tokenization for all triggers
// - Real-time streaming support
// - Centralized cooldown management
// - Extensible handler system
//
// Usage:
// ```tsx
// import { useTriggerSystem } from '@/lib/triggers';
// 
// function ChatComponent() {
//   const { processStreamingContent, resetForNewMessage } = useTriggerSystem({
//     soundEnabled: true,
//     spriteEnabled: true,
//   });
//   
//   // During streaming
//   processStreamingContent(content, character, messageKey);
//   
//   // On message end
//   resetForNewMessage(messageKey, character);
// }
// ```

// Core
export { 
  TokenDetector, 
  getTokenDetector, 
  resetTokenDetector,
  normalizeToken,
  tokenMatches,
} from './token-detector';

export type { 
  DetectedToken, 
  TokenType, 
  TokenDetectorConfig 
} from './token-detector';

// Bus
export { 
  getTriggerBus, 
  resetTriggerBus,
  createTokensEvent,
  createMessageStartEvent,
  createMessageEndEvent,
} from './trigger-bus';

export type { 
  TriggerContext, 
  TriggerEvent,
  TokensDetectedEvent,
  MessageStartEvent, 
  MessageEndEvent,
  TriggerEventHandler,
} from './trigger-bus';

// Cooldown
export { 
  getCooldownManager, 
  resetCooldownManager 
} from './cooldown-manager';

// Types
export type {
  TriggerMatchResult,
  TriggerMatch,
  TriggerHandler,
  CooldownConfig,
  CooldownState,
} from './types';

// Sound Handler
export {
  createSoundHandlerState,
  checkSoundTriggers,
  executeSoundTrigger,
  resetSoundHandlerState,
  type SoundHandlerState,
  type SoundTriggerContext,
  type SoundHandlerResult,
} from './handlers/sound-handler';

// Sprite Handler
export {
  createSpriteHandlerState,
  checkSpriteTriggers,
  executeSpriteTrigger,
  resetSpriteHandlerState,
  type SpriteHandlerState,
  type SpriteTriggerContext,
  type SpriteHandlerResult,
} from './handlers/sprite-handler';

// Background Handler (placeholder)
export {
  createBackgroundHandlerState,
  type BackgroundHandlerState,
} from './handlers/background-handler';

// HUD Handler
export {
  createHUDHandlerState,
  checkHUDTriggers,
  executeHUDTrigger,
  resetHUDHandlerState,
  type HUDHandlerState,
  type HUDTriggerContext,
  type HUDHandlerResult,
} from './handlers/hud-handler';

// Main Hook
export { 
  useTriggerSystem,
  type TriggerSystemConfig,
  type TriggerSystemResult,
} from './use-trigger-system';
