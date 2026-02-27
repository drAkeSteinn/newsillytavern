// ============================================
// TAVERNFLOW - Type Definitions
// ============================================

// ============ Character Card Types ============

export interface CharacterCard {
  id: string;
  name: string;
  description: string;
  personality: string;
  scenario: string;
  firstMes: string;
  mesExample: string;
  creatorNotes: string;
  characterNote: string;  // Character's Note - sent to AI to influence behavior
  systemPrompt: string;
  postHistoryInstructions: string;
  alternateGreetings: string[];
  tags: string[];
  avatar: string;
  sprites: CharacterSprite[];
  voice: VoiceSettings | null;
  createdAt: string;
  updatedAt: string;
}

export interface CharacterSprite {
  id: string;
  name: string;
  expression: string;
  imageUrl: string;
  animations?: SpriteAnimation[];
}

export interface SpriteAnimation {
  type: 'idle' | 'talking' | 'excited' | 'sad' | 'angry' | 'thinking';
  frames: string[];
  frameDuration: number;
  loop: boolean;
}

// ============ Chat Types ============

export interface ChatMessage {
  id: string;
  characterId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  isDeleted: boolean;
  swipeId: string;
  swipeIndex: number;
  metadata?: MessageMetadata;
}

export interface MessageMetadata {
  tokens?: number;
  model?: string;
  finishReason?: string;
}

export interface ChatSession {
  id: string;
  characterId: string;
  groupId?: string;
  name: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
  background?: string;
  scenario?: string;
}

// ============ Group Types ============

export interface CharacterGroup {
  id: string;
  name: string;
  description: string;
  characterIds: string[];
  avatar: string;
  systemPrompt: string;
  activationStrategy: 'round_robin' | 'random' | 'smart';
  createdAt: string;
  updatedAt: string;
}

// ============ LLM Configuration Types ============

export interface LLMConfig {
  id: string;
  name: string;
  provider: LLMProvider;
  endpoint: string;
  apiKey?: string;
  model: string;
  parameters: LLMParameters;
  isActive: boolean;
}

export type LLMProvider = 
  | 'text-generation-webui'
  | 'openai'
  | 'anthropic'
  | 'ollama'
  | 'koboldcpp'
  | 'vllm'
  | 'z-ai'
  | 'custom';

export interface LLMParameters {
  temperature: number;
  topP: number;
  topK: number;
  maxTokens: number;
  contextSize: number;
  repetitionPenalty: number;
  frequencyPenalty: number;
  presencePenalty: number;
  stopStrings: string[];
  stream: boolean;
}

// ============ Prompt Template Types ============

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  userPrompt: string;
  assistantPrompt: string;
  contextTemplate: string;
  characterTemplate: string;
  groupTemplate: string;
  isDefault: boolean;
}

// ============ TTS Types ============

export interface TTSConfig {
  id: string;
  name: string;
  provider: TTSProvider;
  endpoint: string;
  apiKey?: string;
  voice: string;
  speed: number;
  pitch: number;
  isActive: boolean;
}

export type TTSProvider = 
  | 'edge-tts'
  | 'elevenlabs'
  | 'coqui'
  | 'bark'
  | 'silero'
  | 'custom';

export interface VoiceSettings {
  enabled: boolean;
  voiceId: string;
  speed: number;
  pitch: number;
  emotionMapping: Record<string, string>;
}

// ============ Background Types ============

export interface Background {
  id: string;
  name: string;
  url: string;
  thumbnail: string;
  category: string;
  tags: string[];
}

// ============ Persona Types ============

export interface Persona {
  id: string;
  name: string;
  description: string;  // The user's personality/description
  avatar: string;       // User's avatar image
  isActive: boolean;    // Currently selected persona
  createdAt: string;
  updatedAt: string;
}

// ============ Sound Types ============

export interface SoundTrigger {
  id: string;
  name: string;
  active: boolean;
  keywords: string[];
  keywordsEnabled: Record<string, boolean>;
  collection: string;
  playMode: 'random' | 'cyclic';
  volume: number;
  cooldown: number;
  delay: number;
  currentIndex: number;
  createdAt: string;
  updatedAt: string;
}

export interface SoundCollection {
  name: string;
  path: string;
  files: string[];
}

export interface SoundSettings {
  enabled: boolean;
  globalVolume: number;
  maxSoundsPerMessage: number;
  globalCooldown: number;
  realtimeEnabled: boolean;
}

// ============ Background Trigger Types ============

export type OverlayPlacement = 'none' | 'back' | 'front';

export interface BackgroundItem {
  backgroundLabel: string;    // Name/label for this background
  backgroundUrl?: string;     // Direct URL (optional, can be resolved from index)
  key: string;                // BG-key that must match in message
  overlayLabel?: string;      // Optional overlay image label
  overlayPlacement: OverlayPlacement;
  overlayUrl?: string;        // Direct URL for overlay (optional)
  enabled: boolean;
  spriteLoc?: {               // Saved sprite position for this background
    left: number;
    top: number;
    width: number;
    height: number;
  };
}

export interface BackgroundPack {
  id: string;
  title: string;
  active: boolean;
  keywords: string[];         // Pack-level keywords (must match first)
  requirePipes: boolean;      // Keywords must be wrapped in |pipes|
  caseSensitive: boolean;     // Case sensitivity for matching
  requireBgKey: boolean;      // BG-key must also match (if false, any item can be picked)
  cooldown: number;           // Cooldown in ms between triggers
  playMode: 'random' | 'cyclic';  // How to select background when multiple match
  items: BackgroundItem[];
  currentIndex: number;       // For cyclic mode
  createdAt: string;
  updatedAt: string;
}

export interface BackgroundIndexEntry {
  label: string;              // Unique label for this background
  filename: string;           // Original filename
  url: string;                // Full URL to the background image
  thumb?: string;             // Thumbnail URL
  pack: string;               // Pack name this belongs to
}

export interface BackgroundIndex {
  backgrounds: BackgroundIndexEntry[];
  lastUpdated: number;
  source: string;             // Where backgrounds were scanned from
}

export interface BackgroundTriggerSettings {
  enabled: boolean;
  globalCooldown: number;     // Global cooldown between any background changes
  realtimeEnabled: boolean;   // Detect during streaming
  transitionDuration: number; // Fade transition duration in ms
}

export interface BackgroundTriggerHit {
  packId: string;
  pack?: BackgroundPack;
  backgroundLabel: string;
  backgroundUrl?: string;
  overlayLabel?: string;
  overlayPlacement: OverlayPlacement;
  overlayUrl?: string;
}

// ============ Settings Types ============

export interface ChatLayoutSettings {
  novelMode: boolean;
  chatWidth: number;      // percentage (20-100)
  chatHeight: number;     // percentage (30-100)
  chatX: number;          // percentage (0-100)
  chatY: number;          // percentage (0-100)
  chatOpacity: number;    // 0-1
  blurBackground: boolean;
  showCharacterSprite: boolean;
}

export type BackgroundFit = 'cover' | 'contain' | 'stretch';

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  fontSize: number;
  messageDisplay: 'bubble' | 'compact' | 'full';
  showTimestamps: boolean;
  showTokens: boolean;
  autoScroll: boolean;
  autoSave: boolean;
  autoSaveInterval: number;
  confirmDelete: boolean;
  defaultBackground: string;
  backgroundFit: BackgroundFit;
  swipeEnabled: boolean;
  quickReplies: string[];
  hotkeys: Record<string, string>;
  sound: SoundSettings;
  backgroundTriggers: BackgroundTriggerSettings;
  chatLayout: ChatLayoutSettings;
}

// ============ API Types ============

export interface GenerateRequest {
  messages: ChatMessage[];
  character: CharacterCard;
  systemPrompt: string;
  parameters: LLMParameters;
  stream: boolean;
}

export interface GenerateResponse {
  message: ChatMessage;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface StreamChunk {
  type: 'token' | 'done' | 'error';
  content?: string;
  error?: string;
}

// ============ File Storage Types ============

export interface StorageData {
  characters: CharacterCard[];
  groups: CharacterGroup[];
  sessions: ChatSession[];
  backgrounds: Background[];
  llmConfigs: LLMConfig[];
  ttsConfigs: TTSConfig[];
  promptTemplates: PromptTemplate[];
  settings: AppSettings;
}

// ============ Character Card Import/Export ============

export interface CharacterCardV2 {
  spec: 'chara_card_v2';
  spec_version: '2.0';
  data: {
    name: string;
    description: string;
    personality: string;
    scenario: string;
    first_mes: string;
    mes_example: string;
    creator_notes: string;
    character_note?: string;  // Character's Note - sent to AI to influence behavior
    system_prompt: string;
    post_history_instructions: string;
    alternate_greetings: string[];
    tags: string[];
    creator: string;
    character_version: string;
    extensions: Record<string, unknown>;
  };
}

// TavernCardImage type for PNG files with embedded character data
// These are PNG images with Base64 encoded JSON in tEXt chunks
export type TavernCardImage = Blob;
