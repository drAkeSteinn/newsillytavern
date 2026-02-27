// ============================================
// TAVERNFLOW - Trigger System Types
// Based on DOP Tirano Suite extension
// ============================================

// ============ SFX Trigger Types ============

export interface SFXTrigger {
  id: string;
  title: string;
  active: boolean;
  keywords: string[];
  requirePipes: boolean; // Si requiere |keyword| o detecta texto plano
  caseSensitive: boolean;
  src: string; // Ruta al archivo de audio
  audioDataUrl?: string; // Base64 audio data
  volume: number; // 0-1
  cooldownMs: number; // Cooldown entre triggers
  repeatCount: number; // Veces que se repite (0 = loop infinito)
  soundPack: string; // ID del pack de sonidos
}

export interface SoundPack {
  id: string;
  name: string;
  path: string;
  files: string[];
}

export interface SoundPacksIndex {
  packs: Record<string, string[]>;
  lastUpdated: number;
}

// ============ Background Trigger Types ============

export interface BackgroundTrigger {
  id: string;
  title: string;
  active: boolean;
  keywords: string[];
  requirePipes: boolean;
  caseSensitive: boolean;
  backgroundName: string; // Nombre del fondo a cargar
  cooldownMs: number;
}

export interface BackgroundPack {
  id: string;
  title: string;
  active: boolean;
  requirePipes: boolean;
  caseSensitive: boolean;
  requireBgKey: boolean; // Requiere que haya un BG-key en el mensaje
  keywords: string[];
  cooldownMs: number;
  items: BackgroundPackItem[];
}

export interface BackgroundPackItem {
  id: string;
  backgroundLabel: string; // Nombre del fondo
  key: string; // Keyword para activar este fondo específico
  overlayLabel?: string; // Overlay opcional
  overlayPlacement?: 'none' | 'back' | 'front';
  enabled: boolean;
}

export interface BackgroundIndex {
  backgrounds: BackgroundEntry[];
  lastUpdated: number;
}

export interface BackgroundEntry {
  id: string;
  label: string;
  path: string;
  thumbnail?: string;
  category?: string;
}

// ============ Sprite Trigger Types ============

export interface SpriteTrigger {
  id: string;
  title: string;
  active: boolean;
  keywords: string[];
  requirePipes: boolean;
  expressionName: string; // Nombre de la expresión/sprite
  cooldownMs: number;
}

export interface SpritePack {
  id: string;
  title: string;
  active: boolean;
  requirePipes: boolean;
  caseSensitive: boolean;
  keywords: string[];
  cooldownMs: number;
  items: SpritePackItem[];
}

export interface SpritePackItem {
  id: string;
  spriteLabel: string; // Nombre del sprite
  keys: string; // Keywords para activar
  actionId?: string;
  poseId?: string;
  clothesId?: string;
  idleSpriteLabel?: string; // Sprite de idle
  returnToIdleMs?: number; // Tiempo para volver a idle
  enabled: boolean;
}

export interface SpriteLibrary {
  actions: SpriteLibraryEntry[];
  poses: SpriteLibraryEntry[];
  clothes: SpriteLibraryEntry[];
}

export interface SpriteLibraryEntry {
  id: string;
  name: string;
  prefix: string; // Prefijo para el trigger key
}

export interface SpriteIndex {
  sprites: SpriteEntry[];
  lastUpdated: number;
  source: string;
}

export interface SpriteEntry {
  id: string;
  label: string;
  path: string;
  thumbnail?: string;
  expressions?: string[]; // Expresiones disponibles
}

// ============ Emotion Trigger Types ============

export interface EmotionTrigger {
  id: string;
  title: string;
  active: boolean;
  keywords: string[];
  requirePipes: boolean;
  src: string;
  audioDataUrl?: string;
  volume: number;
  cooldownMs: number;
  repeatCount: number;
  soundPack: string;
}

// ============ TTS Types ============

export interface TTSJob {
  id: string;
  text: string;
  voiceId: string;
  characterId: string;
  characterName: string;
  status: 'pending' | 'processing' | 'playing' | 'completed' | 'error';
  audioUrl?: string;
  audioBlob?: Blob;
  createdAt: string;
}

export interface TTSVoice {
  id: string;
  name: string;
  language?: string;
  previewUrl?: string;
  provider: string;
}

export interface TTSVoiceMap {
  [characterName: string]: string; // characterName -> voiceId
}

// ============ Trigger System Settings ============

export interface TriggerSystemSettings {
  enabled: boolean;
  
  // Scan mode
  scanMode: 'pipes' | 'pipes+text'; // Solo pipes o también texto plano
  tagDelimiters: {
    start: string;
    end: string;
  };
  
  // Fuzzy matching
  fuzzyEnabled: boolean;
  fuzzyThreshold: number; // 0-1, recommended 0.2-0.35
  
  // Safety limits
  maxSoundsPerMessage: number;
  globalCooldownMs: number;
  
  // Audio
  globalVolume: number;
  
  // Realtime
  realtimeEnabled: boolean;
  realtimeDebounceMs: number;
  
  // Multi-sound mode
  multiSoundMode: 'random' | 'shuffle';
  
  // Background settings
  playBackgroundTriggers: boolean;
  backgroundGlobalCooldownMs: number;
  backgroundMultiMode: 'random' | 'shuffle-cycle';
  
  // Sprite settings
  playSpriteTriggers: boolean;
  spriteGlobalCooldownMs: number;
  spriteApplyDelayMs: number;
  spriteMultiMode: 'random' | 'shuffle';
  spriteLockEnabled: boolean;
  spriteLockDurationMs: number;
  spriteLockReapplyIntervalMs: number;
  
  // Emotion settings
  playEmotionSounds: boolean;
  playEmotionOnChangeOnly: boolean;
  emotionSource: 'sprite' | 'tags' | 'sprite+tags';
}

// ============ Audio Bus Types ============

export interface AudioTask {
  id: string;
  type: 'sfx' | 'tts' | 'emotion';
  priority: number;
  audioUrl?: string;
  audioBlob?: Blob;
  volume: number;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

export interface AudioBusState {
  isPlaying: boolean;
  currentTask: AudioTask | null;
  queue: AudioTask[];
  token: number; // Para cancelación
}

// ============ Message Scan Result ============

export interface MessageScanResult {
  sfxTriggers: SFXTrigger[];
  backgroundTriggers: (BackgroundTrigger | BackgroundPack)[];
  spriteTriggers: (SpriteTrigger | SpritePack)[];
  emotionTriggers: EmotionTrigger[];
  detectedKeywords: string[];
  detectedEmotions: string[];
}

// ============ Default Settings ============

export const DEFAULT_TRIGGER_SETTINGS: TriggerSystemSettings = {
  enabled: true,
  scanMode: 'pipes',
  tagDelimiters: { start: '|', end: '|' },
  fuzzyEnabled: true,
  fuzzyThreshold: 0.25,
  maxSoundsPerMessage: 3,
  globalCooldownMs: 150,
  globalVolume: 0.85,
  realtimeEnabled: true,
  realtimeDebounceMs: 120,
  multiSoundMode: 'random',
  playBackgroundTriggers: true,
  backgroundGlobalCooldownMs: 250,
  backgroundMultiMode: 'random',
  playSpriteTriggers: true,
  spriteGlobalCooldownMs: 250,
  spriteApplyDelayMs: 180,
  spriteMultiMode: 'random',
  spriteLockEnabled: false,
  spriteLockDurationMs: 0,
  spriteLockReapplyIntervalMs: 450,
  playEmotionSounds: true,
  playEmotionOnChangeOnly: true,
  emotionSource: 'sprite+tags',
};
