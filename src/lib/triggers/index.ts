// ============================================
// Triggers Module - Unified Trigger System
// ============================================
//
// This module provides a unified trigger detection and execution system
// that can be used by sounds, sprites, backgrounds, and future trigger types.
//
// Key Features:
// - Unified key detection (all formats: [key], |key|, Peticion:key, etc.)
// - Real-time streaming support
// - Immediate trigger execution
// - Position-based deduplication
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

// ============================================
// NEW: Unified Key Detector (Preferred)
// ============================================
export {
  KeyDetector,
  getKeyDetector,
  resetKeyDetector,
  normalizeKey,
  keyMatches,
  keyMatchesAny,
  classifyKey,
} from './key-detector';

export type {
  DetectedKey,
  KeyFormat,
  KeyCategory,
} from './key-detector';

// ============================================
// Handler Interface (Unified)
// ============================================
export type {
  TriggerMatch,
  TriggerMatchResult,
  KeyHandler,
  HandlerProcessResult,
  CooldownConfig,
  CooldownState,
} from './types';

// ============================================
// Handler Registry (Unified Orchestration)
// ============================================
export {
  getHandlerRegistry,
  resetHandlerRegistry,
  categorizeKeys,
  logDetectedKeys,
  type HandlerRegistryConfig,
  type HandlerRegistryResult,
} from './handler-registry';

// ============================================
// LEGACY: Token Detector (will be deprecated)
// ============================================
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
  KeysDetectedEvent,
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

// Sound Handler
export {
  createSoundHandlerState,
  checkSoundTriggers,
  executeSoundTrigger,
  executeAllSoundTriggers,
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

// Background Handler
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

// ============================================
// NEW: Unified Key Handlers
// ============================================
export {
  createSoundKeyHandler,
  SoundKeyHandler,
  type SoundKeyHandlerContext,
} from './handlers/sound-key-handler';

export {
  createSkillKeyHandler,
  SkillKeyHandler,
  type SkillKeyHandlerContext,
} from './handlers/skill-key-handler';

export {
  createSolicitudKeyHandler,
  SolicitudKeyHandler,
  type SolicitudKeyHandlerContext,
  type SolicitudMatchData,
} from './handlers/solicitud-key-handler';
