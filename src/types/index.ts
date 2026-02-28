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
  spriteConfig?: SpriteConfig;  // Sprite configuration for the character
  voice: VoiceSettings | null;
  createdAt: string;
  updatedAt: string;
}

// Sprite state type
export type SpriteState = 'idle' | 'talk' | 'thinking' | 'happy' | 'sad' | 'angry';

// Single sprite with state mapping
export interface CharacterSprite {
  id: string;
  name: string;
  expression: string;  // Legacy: kept for backward compatibility
  imageUrl: string;
  state?: SpriteState;  // Which state this sprite is for
  animations?: SpriteAnimation[];
}

// Sprite configuration for a character
export interface SpriteConfig {
  enabled: boolean;
  collection?: string;  // Selected collection name
  sprites: {
    [key in SpriteState]?: string;  // URL to sprite for each state
  };
}

export interface SpriteAnimation {
  type: 'idle' | 'talking' | 'excited' | 'sad' | 'angry' | 'thinking';
  frames: string[];
  frameDuration: number;
  loop: boolean;
}

// Sprite collection from the filesystem
export interface SpriteCollection {
  id: string;
  name: string;
  path: string;
  files: SpriteFile[];
}

export interface SpriteFile {
  name: string;
  url: string;
  type: 'image' | 'animation';
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
  swipes: string[];           // Array of all swipe alternatives (content is swipes[swipeIndex])
  metadata?: MessageMetadata;
}

export interface MessageMetadata {
  tokens?: number;
  model?: string;
  finishReason?: string;
  promptData?: PromptSection[];  // Store the prompt sent to LLM
}

// Prompt section for displaying in prompt viewer
export interface PromptSection {
  type: 'system' | 'persona' | 'character_description' | 'personality' | 'scenario' | 'example_dialogue' | 'character_note' | 'lorebook' | 'post_history' | 'chat_history' | 'instructions';
  label: string;
  content: string;
  color: string;  // Tailwind color class for the section header
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

export type GroupRole = 'leader' | 'member' | 'observer';

export interface GroupMember {
  characterId: string;
  role: GroupRole;
  isActive: boolean;      // Can respond
  isPresent: boolean;     // Is in the scene
  joinOrder: number;      // Order they joined the group
}

export type GroupActivationStrategy = 
  | 'all'           // All active members respond
  | 'round_robin'   // Take turns in order
  | 'random'        // Random selection
  | 'reactive'      // Only mentioned characters respond
  | 'smart';        // AI decides who should respond

export interface CharacterGroup {
  id: string;
  name: string;
  description: string;
  characterIds: string[];     // Legacy: simple list of character IDs
  members: GroupMember[];     // Enhanced: detailed member info
  avatar: string;
  systemPrompt: string;
  activationStrategy: GroupActivationStrategy;
  maxResponsesPerTurn: number;  // Limit responses per turn (except 'all' strategy)
  allowMentions: boolean;       // Enable mention detection
  mentionTriggers: string[];    // Additional mention trigger words
  conversationStyle: 'sequential' | 'parallel';  // How responses are generated
  createdAt: string;
  updatedAt: string;
}

export interface MentionDetectionResult {
  characterId: string;
  characterName: string;
  triggerType: 'name' | 'alias' | 'pronoun' | 'keyword';
  matchedText: string;
  position: number;
}

export interface GroupStreamEvent {
  type: 'character_start' | 'token' | 'character_done' | 'character_error' | 'done' | 'error';
  characterId?: string;
  characterName?: string;
  content?: string;
  error?: string;
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

// Context settings for message limits
export interface ContextSettings {
  maxMessages: number;           // Maximum messages in context (sliding window)
  maxTokens: number;             // Maximum tokens for context
  keepFirstN: number;            // Always keep first N messages
  keepLastN: number;             // Always keep last N messages
  enableSummaries: boolean;      // Enable future summarization
  summaryThreshold: number;      // When to trigger summarization
}

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
  context: ContextSettings;
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

// ============ Lorebook Types (SillyTavern Compatible) ============

export type LorebookPosition = 
  | 0   // After system prompt
  | 1   // After user message
  | 2   // Before user message  
  | 3   // After assistant message
  | 4   // Before assistant message
  | 5   // At top of chat
  | 6   // At bottom of chat (newest messages)
  | 7;  // Outlet (custom position)

export type LorebookLogic = 
  | 'AND_ANY'    // Match ANY primary key AND ANY secondary key
  | 'NOT_ALL'    // NOT match ALL primary keys
  | 'NOT_ANY'    // NOT match ANY primary key
  | 'AND_ALL';   // Match ALL primary keys

export interface LorebookEntry {
  uid: number;                    // Unique identifier
  key: string[];                  // Primary keywords
  keysecondary: string[];         // Secondary keywords (optional)
  comment: string;                // Entry title/description
  content: string;                // Content to inject
  constant: boolean;              // Always active
  selective: boolean;             // Use secondary keys
  order: number;                  // Insertion order (higher = later)
  position: LorebookPosition;     // Where to inject
  disable: boolean;               // Entry disabled
  excludeRecursion: boolean;      // Exclude from recursive scanning
  preventRecursion: boolean;      // Prevent this entry from triggering others
  delayUntilRecursion: boolean;   // Only activate during recursion
  probability: number;            // Activation probability (0-100)
  useProbability: boolean;        // Use probability check
  depth: number;                  // Scan depth (messages to scan back)
  selectLogic: number;            // 0 = AND_ANY, 1 = NOT_ALL, 2 = NOT_ANY, 3 = AND_ALL
  group: string;                  // Group name
  groupOverride: boolean;         // Override group settings
  groupWeight: number;            // Weight within group (for random selection)
  scanDepth: number | null;       // Custom scan depth (null = use global)
  caseSensitive: boolean | null;  // Case sensitive matching (null = use global)
  matchWholeWords: boolean | null; // Match whole words only
  useGroupScoring: boolean | null; // Use group scoring
  automationId: string;           // Automation ID
  role: number | null;            // Role (0 = system, 1 = user, 2 = assistant)
  vectorized: boolean;            // Vectorized for semantic search
  displayIndex: number;           // Display order in UI
  extensions: Record<string, unknown>; // Extension data
}

export interface LorebookSettings {
  scanDepth: number;              // Global scan depth
  caseSensitive: boolean;         // Global case sensitivity
  matchWholeWords: boolean;       // Global whole word matching
  useGroupScoring: boolean;       // Use group scoring
  automationId: string;           // Default automation ID
  tokenBudget: number;            // Max tokens for lorebook content
  recursionLimit: number;         // Max recursion depth
}

export interface Lorebook {
  id: string;                     // Internal ID
  name: string;                   // Lorebook name
  description: string;            // Lorebook description
  entries: LorebookEntry[];       // Entries (converted from object for easier handling)
  settings: LorebookSettings;     // Lorebook settings
  characterId?: string;           // Attached to character (optional)
  tags: string[];                 // Tags for organization
  active: boolean;                // Lorebook active
  createdAt: string;
  updatedAt: string;
}

// SillyTavern Lorebook format (for import/export)
export interface SillyTavernLorebook {
  entries: Record<string, LorebookEntry>;
  settings?: Partial<LorebookSettings>;
}
