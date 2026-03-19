# TavernFlow Work Log

---
Task ID: 1
Agent: Main Agent
Task: Clone repository and sync files

Work Log:
- Cloned https://github.com/drAkeSteinn/newsillytavern to my-project-temp
- Synced files to my-project using rsync
- Installed dependencies with bun install

Stage Summary:
- Project synced successfully
- Dependencies installed (827 packages)
- Ready for development

---
Task ID: 2
Agent: Main Agent
Task: Add KWS types to types/index.ts

Work Log:
- Added WakeWordConfig interface with fields: enabled, wakeWords, sensitivity, cooldownMs, language
- Added VADConfig interface with fields: enabled, silenceThreshold, silenceDurationMs, minRecordingMs, maxRecordingMs
- Added WakeWordDetectionResult interface
- Added DEFAULT_WAKE_WORD_CONFIG and DEFAULT_VAD_CONFIG constants

Stage Summary:
- KWS types defined in types/index.ts (lines 822-873)
- Types exported and ready for use

---
Task ID: 3
Agent: Main Agent
Task: Add KWS tab to TTSSettingsPanel

Work Log:
- Added Ear, Activity, Radio icons to imports
- Added WakeWordConfig and VADConfig type imports
- Created DEFAULT_KWS_CONFIG and DEFAULT_VAD_CONFIG constants
- Added kwsConfig and vadConfig useState hooks
- Created updateKwsConfig and updateVadConfig functions
- Modified TabsList from grid-cols-3 to grid-cols-4
- Added KWS TabsTrigger with Ear icon
- Added complete KWS TabsContent with:
  - KWS Info Banner (purple theme)
  - KWS Global Configuration Card
  - VAD Configuration Card
  - "How it works" explanation Card
- Updated loadSavedConfig and saveConfig to handle kws/vad config

Stage Summary:
- KWS tab fully implemented in Settings → Voz → KWS
- Users can configure:
  - Enable/disable KWS global
  - Language for speech recognition
  - Sensitivity (low/medium/high)
  - Cooldown between detections
  - VAD settings (silence threshold, duration, min/max recording time)

---
Task ID: 4
Agent: Main Agent
Task: Add KWS indicator to NovelChatBox

Work Log:
- Added Ear and Radio icons to imports
- Added KWS state variables: kwsEnabled, kwsListening, kwsTranscript
- Modified loadAsrConfig to also load KWS config from API
- Added KWS Toggle Button next to manual recording button
- Added KWS Status Indicator showing "KWS" or "..."
- Added KWS Transcript Preview

Stage Summary:
- Chat now has KWS toggle button (Ear icon)
- Button shows purple when KWS active, green when listening
- Status text shows "KWS" (waiting) or "..." (listening)
- Transcript preview shows what's being recognized

---

## Summary of KWS Implementation

### Where to Configure KWS:
**Settings → Voz → KWS Tab**

1. **Configuración Global KWS:**
   - Toggle para activar/desactivar
   - Selector de idioma (Español, Inglés, Japonés, etc.)
   - Sensibilidad (Baja/Media/Alta)
   - Tiempo de enfriamiento entre detecciones

2. **Configuración VAD:**
   - Auto-detener por silencio
   - Umbral de silencio (10-60%)
   - Duración de silencio para detener (500-3000ms)
   - Tiempo mínimo de grabación (200-2000ms)
   - Tiempo máximo de grabación (10-60s)

### How to Use KWS:
1. Open Settings → Voz → KWS
2. Enable "Habilitar KWS Global"
3. In the chat, click the **Ear button** (next to Mic button)
4. The button turns **purple** when KWS is active
5. Say the character's name to trigger recording
6. The button turns **green** when listening to your message

### Visual Indicators in Chat:
- **Mic button (outline)**: Manual recording mode
- **Ear button (outline)**: KWS inactive
- **Ear button (purple)**: KWS active, waiting for wake word
- **Radio icon (green, pulsing)**: KWS listening/recording
- **"KWS" text**: KWS active, waiting
- **"..." text**: KWS is listening

### Architecture:
- **KWS runs 100% in browser** using Web Speech API
- **VAD uses Web Audio API** for silence detection
- **Whisper runs on server** (port 7778) for transcription
- Config is saved via `/api/tts/config` endpoint

---
Task ID: 5
Agent: Main Agent
Task: Implement Sprite Timeline Editor with filesystem-based collections

Work Log:
- Updated SpriteTimelineEditor component to load collections from filesystem folders
- Connected to existing `/api/sprites/collections` endpoint to get sprite folders
- Collections are loaded from `public/sprites/` directory (Moon, Prisionero, custom, etc.)
- Each collection's sprites are converted to TimelineSprite format
- Implemented local state management for timeline collections
- Added file upload functionality to upload sprites to existing collections
- Added sprite deletion with confirmation
- Implemented track and keyframe management in the timeline editor
- Added playback controls with play/pause/stop
- Added timeline ruler with time markers
- Added sound keyframe properties panel with volume and play/stop controls
- Fixed UI to properly display collections, sprites, tracks, and keyframes
- Added zoom in/out and snap controls

Stage Summary:
- Sprite Timeline Editor is fully functional in Settings → Sprite Timeline tab
- Collections are loaded from filesystem folders (`public/sprites/Moon`, `public/sprites/Prisionero`, etc.)
- Users can:
  - Browse existing sprite collections
  - Upload new sprites to collections
  - Delete sprites from collections
  - Edit sprite properties (name, trigger keys, trigger settings)
  - Add sound tracks to sprite timelines
  - Add keyframes at specific times by clicking on the track
  - Edit keyframe properties (time, sound, volume)
  - Delete keyframes and tracks
  - Preview timeline with playback controls
  - Zoom in/out of timeline
  - Enable/disable snap to grid

### Architecture:
- **Collections**: Loaded from `public/sprites/` folders via `/api/sprites/collections`
- **State Management**: Local React state + Zustand store for UI state
- **Timeline Data**: Stored per-sprite with tracks and keyframes
- **Sound Integration**: Uses existing sound collections from `/api/sounds/collections`
- **File Upload**: Uses existing `/api/upload` endpoint

### UI Layout:
- **Left Panel**: Collections list + Sprites grid
- **Center**: Timeline with playback controls, ruler, and tracks
- **Right Panel**: Properties panel (sprite or keyframe properties)

---
Task ID: 6
Agent: Main Agent
Task: Fix Sprite Timeline Editor issues

Work Log:
- Removed trigger keys from sprite properties panel (collections are just for organizing sprites, not for triggers)
- Fixed sound collections loading - now properly fetches from /api/sounds/collections
- Fixed video hover preview error by using safe play/pause handlers with try/catch
- Added video refs map to properly track video elements
- Added empty state message when no sound collections are available
- Added info panel explaining how to use the timeline editor
- Added track and keyframe count to sprite info

Stage Summary:
- Fixed all three issues reported:
  1. Removed trigger keys - collections are just for organizing sprites with sounds/effects
  2. Sound collections (glohg, gluck) now properly display in the keyframe sound selector
  3. Fixed video play/pause interruption error with safe handlers

### Sound Collections Integration:
- Sound collections are loaded from `public/sounds/` directory
- Collections like "glohg" and "gluck" appear in the sound selector dropdown
- Each sound file shows as a selectable option under its collection name

---
Task ID: 7
Agent: Main Agent
Task: Reorganize Sprite Timeline Editor with tabs and draggable sounds

Work Log:
- Reorganized right panel with two tabs: "Propiedades" and "Recursos"
- Added horizontal scroll to timeline for proper zoom navigation
- Implemented drag and drop functionality for sound triggers
- Sound triggers are now loaded from the store (soundTriggers)
- Dragging a sound trigger to a track creates a keyframe with trigger reference
- Keyframes show the trigger name and have a purple color when using triggers
- Added visual indicators for trigger play mode (random/cyclic) and collection
- Removed individual sound file selection in favor of trigger-based sounds
- Fixed timeline scroll area to work properly with zoom

Stage Summary:
- Right panel now has two organized tabs:
  - **Propiedades**: Sprite and keyframe properties
  - **Recursos**: Draggable sound triggers from Settings → Sounds
- Timeline has proper horizontal scrollbar for navigation
- Sound triggers can be dragged to tracks to create keyframes
- Triggers retain their play mode (random/cyclic) and collection settings

### How to Use:
1. **Add a track** using the "Añadir Track" button
2. **Go to "Recursos" tab** to see available sound triggers
3. **Drag a trigger** (e.g., "glohg" or "gluck") onto a track
4. The trigger creates a keyframe that references the trigger's collection
5. When played, it will use the trigger's play mode (random/cyclic)

### UI Improvements:
- Track headers are now sticky on the left side when scrolling horizontally
- Keyframes with triggers show purple color and trigger name
- Trigger cards show play mode icon (shuffle/repeat) and collection name
- Empty states provide helpful guidance

---
Task ID: 8
Agent: Main Agent
Task: Add sprite preview, scrollable timeline, and clickable playhead

Work Log:
- Added sprite preview area in the center panel showing the current frame
- Preview updates when seeking through the timeline
- Added proper horizontal scrollbar to the timeline for navigation
- Made the timeline ruler clickable to seek to any position
- Clicking on the timeline ruler moves the playhead and updates preview
- For video sprites, the preview seeks to the corresponding frame
- Track headers are sticky when scrolling horizontally
- Added time overlay on the preview showing current time
- Improved the playback controls layout with preview on the left

Stage Summary:
- **Sprite Preview**: Shows current frame in the center panel
- **Scrollable Timeline**: Horizontal scrollbar for navigating long timelines
- **Clickable Ruler**: Click anywhere on the ruler to seek to that position
- **Seeking**: Updates both the playhead position and sprite preview

### How the Preview Works:
1. For video sprites (webm/mp4): Seeks to the corresponding frame
2. For animated images (gif): Shows the static image
3. For static images: Shows the image with time overlay
4. Click on ruler → Playhead moves → Preview updates to that frame

### Timeline Navigation:
- Use mouse wheel or scrollbar to scroll horizontally
- Zoom in/out buttons change the timeline scale
- Track headers stay fixed on the left while scrolling
- Timeline ruler shows seconds with time markers

---
Task ID: 9
Agent: Main Agent
Task: Reorganize sprite system structure - Add Sprites tab to character editor

Work Log:
- Cleaned up legacy spriteLibraries references from store/index.ts and settings-panel.tsx
- Created new SpriteGeneralPanel component with two tabs:
  - **Colecciones**: Manage sprite collections (create, rename, delete, upload sprites)
  - **Timeline**: Full sprite timeline editor with keyframes
- Renamed "Sprite Timeline" tab to "Sprites" in Settings Panel
- Added "Sprites" tab to Character Editor with SpriteManager component
- Fixed grid columns from 7 to 8 for the new tab
- Improved error handling in CharacterVoicePanel for TTS service unavailability

Stage Summary:
- **Character Editor Sprites Tab**: Now shows Sprite Packs / Estados / Triggers
- **Settings Sprites Tab**: Now shows Colecciones / Timeline
- Proper separation of concerns:
  - Character-specific sprite configuration (packs, states, triggers) → Character Editor
  - Global sprite collection management → Settings Panel

### Structure:
```
Character Editor:
└─ Sprites Tab
   ├─ Sprite Packs (create character-specific sprite packs)
   ├─ Estados (configure idle/talk/thinking states)
   └─ Triggers (create triggers with keys, fallback, chains)

Settings Panel:
└─ Sprites Tab
   ├─ Colecciones (manage sprite files and folders)
   └─ Timeline (edit sprite animations with sound keyframes)
```

### Fixes:
- Added timeout and proper error handling for TTS voice loading
- No more console errors when TTS service is unavailable

---
Task ID: 10
Agent: Main Agent
Task: Fix sprite trigger activation with Mock provider and summary generation error

Work Log:
- Analyzed why sprites weren't activating with the Mock provider during LLM response
- Identified issue: HUD token extraction was returning only the key part (`sprite`) instead of the full key:value (`sprite:alegre`)
- Fixed `parseHudKeyValue()` in token-detector.ts to preserve full key:value format as token
- Added `test-mock` provider support to `generateResponse()` in generation.ts for non-streaming operations
- Summary generation now works with Mock provider instead of failing with URL parse error

Stage Summary:
- **HUD Token Fix**: `[sprite:alegre]` now creates token `spritealegre` (normalized) with metadata `{hudKey: "sprite", hudValue: "alegre"}`
- **Trigger Matching**: Both token and keyword normalize to `spritealegre`, enabling proper matches
- **Summary Generation**: Mock provider now returns a mock summary response instead of failing

### Changes Made:
1. **token-detector.ts**:
   - `parseHudKeyValue()` now returns full `key:value` as token for HUD tokens
   - Preserves metadata with separate hudKey and hudValue for special handling

2. **generation.ts**:
   - Added `case 'test-mock'` to handle Mock provider in non-streaming mode
   - Returns a mock summary response for testing without real LLM

### How Sprite Triggers Work Now:
1. LLM generates `[sprite:alegre]` in response
2. TokenDetector extracts HUD token with:
   - token: `spritealegre` (normalized, colon removed)
   - original: `sprite:alegre`
   - metadata: `{hudKey: "sprite", hudValue: "alegre"}`
3. SpriteHandler's `tokenMatchesKeyword()` normalizes trigger key `sprite:alegre` → `spritealegre`
4. Normalized token matches normalized keyword → trigger fires
5. Sprite changes to the matching sprite

---
Task ID: 11
Agent: Main Agent
Task: Add test button for sprite triggers and verify priority system

Work Log:
- Added test button to TriggerCollectionEditor component
- Button applies the trigger sprite directly to the character in the UI
- Verified sprite priority system is correct:
  1. Trigger sprite (highest priority) - from `triggerSpriteUrl` in store
  2. State collections (talk/thinking/idle) - from `getSpriteUrl()`
  3. Avatar (lowest priority) - fallback
- Test button shows "Aplicado" confirmation when clicked
- Button is disabled if pack has no sprites

Stage Summary:
- **Test Button**: Added green "Test" button to each trigger collection
- **Priority Verified**: Trigger sprites correctly override idle/talk/thinking states
- **Visual Feedback**: Button changes to "Aplicado" with checkmark when triggered

### Changes Made:
1. **trigger-collection-editor.tsx**:
   - Added `useTavernStore` import for accessing sprite state actions
   - Added `TestTube` and `CheckCircle` icons
   - Added `testingCollectionId` state for visual feedback
   - Added `handleTestTrigger()` function that:
     - Gets sprite based on collection behavior (principal/random/list)
     - Calls `applyTriggerForCharacter()` to apply the sprite
     - Optionally schedules fallback timer
   - Test button shows green when not testing, shows "Aplicado" with checkmark when applied

2. **Priority System Confirmed** (character-sprite.tsx):
   - `charSpriteState.triggerSpriteUrl` is checked FIRST (line 273-274)
   - If trigger URL exists, it's used directly
   - Only if no trigger URL, the state-based sprite is fetched
   - This ensures triggers always have priority over idle/talk/thinking

---
Task ID: 12
Agent: Main Agent
Task: Fix fallback system to correctly handle all fallback modes

Work Log:
- Identified issue: `idle_collection` mode wasn't scheduling fallback because `fallbackSpriteUrl` was null
- Fixed all locations where fallback is scheduled to use `returnToMode='clear'` for `idle_collection`
- Updated 4 files with consistent fallback handling

Stage Summary:
- **Fallback Modes Now Work Correctly**:
  - `idle_collection`: Uses `returnToMode='clear'` → clears trigger sprite, lets State Collections V2 determine what to show
  - `custom_sprite`: Uses `returnToMode='idle'` → applies the configured custom sprite
  - `collection_default`: Uses `returnToMode='idle'` → applies the collection's principal sprite

### Changes Made:
1. **trigger-collection-editor.tsx** (Test button):
   - Now schedules fallback for ALL modes when `fallbackDelayMs > 0`
   - Uses `returnToMode='clear'` for `idle_collection` mode
   - Added logging for fallback scheduling

2. **sprite-handler.ts** (`executeTriggerCollectionResult`):
   - Uses `returnToMode='clear'` for `idle_collection` mode
   - Always schedules fallback when delay > 0, regardless of sprite URL availability

3. **unified-trigger-executor.ts**:
   - Same fix: `returnToMode='clear'` for `idle_collection`
   - Consistent fallback scheduling behavior

4. **spriteSlice.ts** (`processNextTriggerInQueue`):
   - Updated to handle `idle_collection` mode correctly
   - Uses `returnToMode='clear'` for this mode
   - Properly determines return mode based on trigger's `fallbackMode`

### How Fallback Works Now:
1. **Trigger Activates**: `applyTriggerForCharacter()` sets `triggerSpriteUrl`
2. **Fallback Scheduled**: `scheduleReturnToIdleForCharacter()` sets timer
3. **During Timer**: Trigger sprite shows (highest priority), states don't interfere
4. **Timer Fires**:
   - `clear` mode: Clears `triggerSpriteUrl`, normal state logic takes over
   - `idle` mode: Sets `triggerSpriteUrl` to return sprite

### Priority System Verified:
- `startGenerationForCharacter()`: Keeps trigger sprite if active
- `endGenerationForCharacter()`: Keeps trigger sprite if active
- `character-sprite.tsx`: Checks `triggerSpriteUrl` first, before state sprites
- State changes (talk/thinking/idle) don't affect active trigger sprites

---
Task ID: 13
Agent: Main Agent
Task: Integrate Timeline Sprite Sounds with trigger activation

Work Log:
- Created `useTimelineSpriteSounds` hook in `/src/hooks/use-timeline-sprite-sounds.ts`
- Hook monitors `characterSpriteStates` for sprite URL changes
- When a sprite is activated, it searches timeline collections for matching sprite
- Plays sounds from the sprite's timeline sound tracks
- Supports loop mode for persistent sprites
- Added integration to ChatPanel component

Stage Summary:
- **Timeline Sounds Integration Complete**:
  - When a sprite with timeline sounds is activated, sounds play automatically
  - Supports sound triggers (from Sound Triggers panel)
  - Supports direct sound URLs
  - Supports sound collection references
  - Loop mode: If sprite timeline has `loop: true`, sounds repeat

### Architecture:
```
Sprite Activated (via trigger)
    ↓
useTimelineSpriteSounds hook detects spriteUrl change
    ↓
Find sprite in timelineCollections by URL
    ↓
Check if sprite has sound tracks
    ↓
Start timeline playback:
  - Create ActiveTimelineSound
  - Play sounds at keyframe times
  - Loop if configured
```

### Files Created/Modified:
1. **`/src/hooks/use-timeline-sprite-sounds.ts`** (NEW):
   - `useTimelineSpriteSounds()`: Main hook for ChatPanel
   - `playTimelineSoundsForSprite()`: Standalone function for manual use
   - `stopAllTimelineSounds()`: Stop all active timeline sounds
   - Audio cache for preloading sounds

2. **`/src/components/tavern/chat-panel.tsx`**:
   - Added import for `useTimelineSpriteSounds`
   - Hook called after background triggers hook

3. **`/src/lib/timeline-sound-player.ts`** (NEW):
   - Lower-level timeline sound playback utilities
   - Can be used for standalone timeline sound control
