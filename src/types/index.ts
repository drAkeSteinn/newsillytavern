// ============================================
// TAVERNFLOW - Type Definitions
// ============================================

// ============ Atmosphere Types ============

// Atmosphere layer type (how it's rendered)
export type AtmosphereRenderType = 'css' | 'canvas' | 'overlay' | 'shader';

// Atmosphere category for grouping
export type AtmosphereCategory = 
  | 'precipitation'  // rain, snow, hail
  | 'particles'      // fireflies, leaves, dust, embers
  | 'fog'            // fog, mist, haze
  | 'light'          // sun rays, lightning, aurora
  | 'overlay'        // color filters, vignette, lens effects
  | 'ambient';       // background ambient effects

// Single atmosphere layer definition
export interface AtmosphereLayer {
  id: string;
  name: string;
  category: AtmosphereCategory;
  renderType: AtmosphereRenderType;
  
  // Visual settings
  intensity: number;         // 0-1, controls particle count/speed
  speed: number;             // Animation speed multiplier
  opacity: number;           // Layer opacity 0-1
  color?: string;            // Primary color (hex or rgba)
  colorSecondary?: string;   // Secondary color for gradients
  
  // Size/density settings
  density?: number;          // Particle density
  sizeMin?: number;          // Min particle size
  sizeMax?: number;          // Max particle size
  
  // Direction/movement
  direction?: number;        // Direction in degrees (0 = down, 90 = right)
  windSpeed?: number;        // Wind effect on particles
  
  // CSS/Canvas specific settings
  cssClass?: string;         // CSS class for CSS-based effects
  spriteUrl?: string;        // Sprite URL for overlay/particle effects
  
  // Animation settings
  loop?: boolean;            // Loop animation
  duration?: number;         // Duration in ms for non-looping effects
  
  // Trigger keywords
  triggerKeys: string[];     // Keywords that activate this layer
  contextKeys?: string[];    // Additional context keys required
  
  // Audio
  audioLoopUrl?: string;     // Ambient audio loop
  audioVolume?: number;      // Volume 0-1
  
  // State
  active: boolean;
  priority: number;          // Rendering priority (higher = on top)
}

// Preset atmosphere configuration
export interface AtmospherePreset {
  id: string;
  name: string;
  description?: string;
  icon?: string;             // Emoji or icon name
  thumbnail?: string;        // Preview image
  layers: AtmosphereLayer[]; // Layers in this preset
  transitionDuration?: number; // Time to transition to this preset
}

// Active atmosphere state
export interface AtmosphereState {
  activeLayers: AtmosphereLayer[];
  activePresetId: string | null;
  transitionProgress: number; // 0-1 for smooth transitions
  audioEnabled: boolean;
  globalIntensity: number;    // Multiplier for all layers
}

// Atmosphere settings
export interface AtmosphereSettings {
  enabled: boolean;
  autoDetect: boolean;        // Auto-detect from messages
  realtimeEnabled: boolean;   // Detect during streaming
  globalIntensity: number;    // Global intensity multiplier
  globalVolume: number;       // Global audio volume
  transitionDuration: number; // Default transition time
  showPreview: boolean;       // Show preview in settings
  performanceMode: 'quality' | 'balanced' | 'performance';
}

// Atmosphere trigger result
export interface AtmosphereTriggerHit {
  layerId: string;
  layer?: AtmosphereLayer;
  presetId?: string;
  preset?: AtmospherePreset;
  intensity?: number;         // Detected intensity from context
}

// ============ Character Card Types ============

// ============ Sprite Trigger System Types ============

// Return to idle mode for triggers
export type ReturnToMode = 'idle_collection' | 'custom_sprite';

// Character sprite trigger for automatic sprite changes (simple triggers)
export interface CharacterSpriteTrigger {
  id: string;
  title: string;
  active: boolean;
  keywords: string[];
  requirePipes: boolean;
  caseSensitive: boolean;
  spriteUrl: string;         // Sprite to show when triggered
  spriteState?: SpriteState; // Or reference to a sprite state
  returnToIdleMs: number;    // Time before returning to idle (0 = no return)
  returnToMode?: ReturnToMode;  // What to return to: idle collection or custom sprite
  returnToSpriteUrl?: string;  // Custom sprite URL to return to (if returnToMode is 'custom_sprite')
  cooldownMs: number;
  priority: number;          // Higher priority triggers override lower ones
}

// Sprite Library Entry - reusable action/pose/clothes definitions
export interface SpriteLibraryEntry {
  id: string;
  name: string;              // Display name (e.g., "wave", "sitting", "casual")
  prefix: string;            // Key prefix (e.g., "act-", "pose-", "cloth-")
}

// Sprite Libraries collection
export interface SpriteLibraries {
  actions: SpriteLibraryEntry[];
  poses: SpriteLibraryEntry[];
  clothes: SpriteLibraryEntry[];
}

// Sprite Pack Item - individual sprite within a pack
export interface SpritePackItem {
  id: string;
  spriteLabel: string;       // Label/name from sprite index
  spriteUrl?: string;        // Direct URL (can be resolved from index)
  keys: string;              // CSV of keys that ALL must match (e.g., "act-wave,pose-sitting")
  actionId?: string;         // Reference to action library entry
  poseId?: string;           // Reference to pose library entry
  clothesId?: string;        // Reference to clothes library entry
  idleSpriteLabel?: string;  // Sprite to return to after delay
  returnToIdleMs?: number;   // Time before returning to idle (0 = no return)
  enabled: boolean;
}

// Sprite Pack - collection of sprites triggered by pack keywords
export interface SpritePack {
  id: string;
  title: string;
  active: boolean;
  requirePipes: boolean;     // Keywords must be in |pipes|
  caseSensitive: boolean;
  keywords: string[];        // ANY of these triggers the pack
  cooldownMs: number;
  items: SpritePackItem[];
  createdAt?: string;
  updatedAt?: string;
}

// Sprite Index Entry - available sprites from filesystem
export interface SpriteIndexEntry {
  label: string;             // Unique label for this sprite
  filename: string;          // Original filename
  url: string;               // Full URL to the sprite
  thumb?: string;            // Thumbnail URL
  pack?: string;             // Pack name this belongs to
  expressions?: string[];    // Available expressions
}

// Sprite Index - cached index of available sprites
export interface SpriteIndex {
  sprites: SpriteIndexEntry[];
  lastUpdated: number;
  source: string;            // Where sprites were scanned from
}

// Sprite Lock State - keeps sprite fixed for duration
export interface SpriteLockState {
  active: boolean;
  spriteUrl: string;
  until: number;             // Timestamp ms; 0 = infinite
  lastApplyAt: number;
}

// Sprite Trigger Hit - result of matching sprite triggers
export interface SpriteTriggerHit {
  packId: string;
  pack?: SpritePack;
  item?: SpritePackItem;
  spriteLabel: string;
  spriteUrl: string;
  idleSpriteLabel?: string;
  returnToIdleMs?: number;
  returnToMode?: ReturnToMode;        // What to return to: idle_collection or custom_sprite
  returnToSpriteUrl?: string;         // Custom sprite URL to return to (if returnToMode is 'custom_sprite')
  cooldownMs?: number;                // Cooldown before this trigger can fire again
  score?: number;            // For priority sorting
}

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
  spriteTriggers?: CharacterSpriteTrigger[];  // Simple character-specific sprite triggers
  spritePacks?: SpritePack[];   // Advanced sprite packs (DOP Tirano style)
  spriteLibraries?: SpriteLibraries;  // Reusable action/pose/clothes definitions
  spriteIndex?: SpriteIndex;    // Cached sprite file index
  voice: VoiceSettings | null;
  hudTemplateId?: string | null;  // HUD template to use for this character
  createdAt: string;
  updatedAt: string;
}

// Sprite state type (only standard states)
export type SpriteState = 'idle' | 'talk' | 'thinking';

// Sprite role in a collection
export type SpriteRole = 'principal' | 'alternate';

// Collection behavior mode
export type CollectionBehavior = 'principal' | 'random' | 'list';

// Sprite collection entry (sprite with role in a state collection)
export interface StateCollectionEntry {
  id: string;
  spriteLabel: string;       // Label from custom sprites
  spriteUrl: string;         // Direct URL to the sprite
  role: SpriteRole;          // Principal or alternate
  order: number;             // For list mode ordering
}

// State sprite collection (for idle, talk, thinking)
export interface StateSpriteCollection {
  entries: StateCollectionEntry[];  // Sprites in this collection
  behavior: CollectionBehavior;     // How to select sprite
  currentIndex: number;             // Current index for list mode rotation
}

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
    [key in SpriteState]?: string;  // Legacy: URL to sprite for each state (backward compatibility)
  };
  // New: Collection-based system for idle, talk, thinking
  stateCollections?: {
    [key in SpriteState]?: StateSpriteCollection;
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
  hudTemplateId?: string | null;  // HUD template to use for this group
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

// ============ Background Collection with Metadata ============

/**
 * Background entry within a collection (from JSON metadata)
 */
export interface BackgroundCollectionEntry {
  id: string;                 // Unique ID within collection
  name: string;               // Display name (e.g., "Bosque Nocturno")
  url: string;                // URL to the background image
  triggerKeys: string[];      // Primary keywords that trigger this background
  contextKeys: string[];      // Secondary keywords that must ALSO be present
  tags?: string[];            // Optional tags for organization
  transitionDuration?: number; // Override transition duration (ms)
}

/**
 * Background file from filesystem
 */
export interface BackgroundFile {
  name: string;               // Filename
  url: string;                // URL path to the file
  type: 'image' | 'video';    // Media type
}

/**
 * Background collection with JSON metadata
 * Each collection folder can have a collection.json file
 */
export interface BackgroundCollection {
  name: string;               // Collection name (folder name)
  path: string;               // Path to collection folder
  description?: string;       // Optional description
  version?: string;           // Optional version string
  transitionDuration?: number; // Default transition duration for this collection
  entries: BackgroundCollectionEntry[];
  files: BackgroundFile[];    // All files in the collection with metadata
}

// ============ Background Trigger Pack (Unified System) ============

/**
 * Match mode for background triggers
 * - any_any: ANY trigger key AND ANY context key (default)
 * - all_any: ALL trigger keys AND ANY context key
 * - any_all: ANY trigger key AND ALL context keys
 * - all_all: ALL trigger keys AND ALL context keys
 */
export type BackgroundMatchMode = 'any_any' | 'all_any' | 'any_all' | 'all_all';

/**
 * Transition types for background changes
 */
export type BackgroundTransitionType = 
  | 'none' 
  | 'fade' 
  | 'slide-left' 
  | 'slide-right' 
  | 'slide-up' 
  | 'slide-down'
  | 'zoom-in'
  | 'zoom-out'
  | 'crossfade';

/**
 * Overlay positioning
 */
export type OverlayPosition = 'back' | 'front' | 'fill';

/**
 * Background overlay - layer displayed over/under main background
 */
export interface BackgroundOverlay {
  id: string;
  url: string;                 // URL to overlay image/video
  name: string;                // Display name
  position: OverlayPosition;   // back = behind main, front = on top
  opacity: number;             // 0-1
  blendMode?: string;          // CSS blend mode (overlay, multiply, screen, etc.)
  animated?: boolean;          // For animated overlays (rain, snow, etc.)
  animationSpeed?: number;     // Animation speed multiplier
}

/**
 * Background variant - alternative version of same background
 * e.g., day/night versions of same location
 */
export interface BackgroundVariant {
  id: string;
  name: string;                // e.g., "Night", "Sunset", "Rain"
  url: string;                 // URL to variant background
  timeOfDay?: 'day' | 'night' | 'dawn' | 'dusk' | 'any';
  weather?: 'clear' | 'rain' | 'snow' | 'storm' | 'any';
  triggerKeys: string[];       // Keywords that activate this variant
  contextKeys: string[];       // Additional context required
  overlays: BackgroundOverlay[]; // Overlays specific to this variant
}

/**
 * Individual background item within a trigger pack
 */
export interface BackgroundTriggerItem {
  id: string;
  backgroundUrl: string;      // URL to the background
  backgroundName: string;     // Display name
  triggerKeys: string[];      // Primary keywords
  contextKeys: string[];      // Secondary keywords
  matchMode?: BackgroundMatchMode;  // Override pack's default match mode
  enabled: boolean;
  priority: number;           // Higher = more important (0-100)
  transitionDuration?: number; // Custom transition duration
  transitionType?: BackgroundTransitionType; // Custom transition
  // Overlays for this background
  overlays: BackgroundOverlay[];
  // Variants (day/night, etc.)
  variants: BackgroundVariant[];
}

/**
 * Background Trigger Pack - integrates with unified trigger system
 * Supports priority, multiple match modes, overlays, variants, and return to default
 */
export interface BackgroundTriggerPack {
  id: string;
  name: string;
  active: boolean;
  collection: string;         // Collection name to use
  priority: number;           // Pack priority (higher = checked first, 0-100)
  cooldown: number;           // Cooldown in ms (0 = no cooldown)
  matchMode: BackgroundMatchMode;  // Default match mode for items
  transitionDuration: number; // Default transition duration in ms
  transitionType: BackgroundTransitionType;  // Transition effect
  items: BackgroundTriggerItem[];
  // Default overlays applied to all backgrounds in this pack
  defaultOverlays: BackgroundOverlay[];
  // Return to default settings
  returnToDefault: boolean;   // Enable return to default after inactivity
  returnToDefaultAfter: number; // Time in ms before returning to default
  defaultBackground: string;  // URL to default background for this pack
  createdAt: string;
  updatedAt: string;
}

export interface BackgroundTriggerSettings {
  enabled: boolean;
  globalCooldown: number;     // Global cooldown between any background changes
  realtimeEnabled: boolean;   // Detect during streaming
  transitionDuration: number; // Default fade transition duration in ms
  defaultTransitionType: BackgroundTransitionType; // Default transition
  // Global return to default
  returnToDefaultEnabled: boolean;  // Enable global return to default
  returnToDefaultAfter: number;     // Time in ms (default 5 minutes)
  defaultBackgroundUrl: string;     // Global default background
  // Global overlays (always applied)
  globalOverlays: BackgroundOverlay[];
}

export interface BackgroundTriggerHit {
  packId: string;
  pack?: BackgroundTriggerPack;
  backgroundUrl: string;
  backgroundName: string;
  transitionDuration: number;
  transitionType: BackgroundTransitionType;
  priority: number;
  overlays: BackgroundOverlay[];
  variant?: BackgroundVariant;
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

// ============ HUD Types ============

// HUD field type
export type HUDFieldType = 'number' | 'enum' | 'string' | 'boolean';

// HUD field display style
export type HUDFieldStyle = 
  | 'default'      // Standard label + value
  | 'progress'     // Progress bar (for numbers)
  | 'badge'        // Badge/pill style
  | 'icon'         // Icon with value
  | 'chip'         // Small chip/tag
  | 'status'       // Status indicator with dot
  | 'gauge'        // Circular gauge (for numbers)
  | 'separator'    // Horizontal separator line
  | 'label-only'   // Just the label, no value shown
  | 'pill'         // Rounded pill with background
  | 'meter'        // Vertical meter bar
  | 'dots';        // Dots indicator (for numbers 1-5 or boolean)

// HUD position on screen
export type HUDPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

// HUD overall style
export type HUDStyle = 'minimal' | 'card' | 'panel';

// Single HUD field definition
export interface HUDField {
  id: string;
  name: string;              // Display name: "HP", "Turno", "Intensidad"
  key: string;               // Key to match in [key=value] format
  type: HUDFieldType;
  
  // For number type
  min?: number;
  max?: number;
  
  // For enum type
  options?: string[];        // ["baja", "media", "alta", "extrema", "clímax"]
  
  // Default value
  defaultValue: string | number | boolean;
  
  // Display settings
  style: HUDFieldStyle;
  color?: string;            // Tailwind color: "red", "green", "blue"
  icon?: string;             // Emoji or icon name
  showLabel?: boolean;       // Show field name
  
  // For progress style
  showValue?: boolean;
  unit?: string;             // "%", "pts", etc.
}

// HUD Template - reusable configuration
export interface HUDTemplate {
  id: string;
  name: string;              // "Sistema Combate RPG", "Romance Stats"
  description?: string;
  
  // Fields
  fields: HUDField[];
  
  // Display settings
  position: HUDPosition;
  style: HUDStyle;
  opacity: number;           // 0-1
  compact: boolean;          // Compact mode
  
  // Metadata
  createdAt: string;
  updatedAt: string;
}

// Active HUD state in session (runtime, not persisted)
export interface HUDSessionState {
  activeTemplateId: string | null;
  fieldValues: Record<string, string | number | boolean>;
  lastUpdated: number;
}

// HUD trigger result
export interface HUDTriggerHit {
  templateId: string;
  fieldId: string;
  fieldName: string;
  oldValue: string | number | boolean;
  newValue: string | number | boolean;
}
