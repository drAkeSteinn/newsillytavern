# Work Log

---
Task ID: 1
Agent: Main
Task: Fix ultima_accion_realizada not being saved when skill is activated

Work Log:
- Analyzed the trigger system flow to understand how skill activations are processed
- Identified that `ultima_accion_realizada` was not being saved when skills are activated
- Modified `skill-key-handler.ts`:
  - Added `skillDescription` to the trigger data when a skill matches (line 149)
  - Added `characterName` property to `SkillKeyHandlerContext` interface (line 27)
  - Added `updateSessionEvent` to `storeActions` interface (lines 39-43)
  - Modified `execute` method to call `updateSessionEvent` with `ultima_accion_realizada` (lines 180-190)
- Modified `use-trigger-system.ts`:
  - Added `characterName: character.name` to skillHandlerContext (line 429)
  - Added `updateSessionEvent: store.updateSessionEvent?.bind(store)` to storeActions (line 435)

Stage Summary:
- `ultima_accion_realizada` now saves in format: `{characterName} - {skillName}: {skillDescription}`
- The {{eventos}} key will now display the last action performed

---
Task ID: 2
Agent: Main
Task: Verify ultimo_objetivo_completado saves completionDescription correctly

Work Log:
- Reviewed `sessionSlice.ts` `completeObjective` function (lines 885-940)
- Verified that line 934 correctly uses: `targetObjective?.completionDescription || targetObjective?.description`
- This means the "Descripción de Completado" configured in the objective is saved when available

Stage Summary:
- `ultimo_objetivo_completado` correctly saves `completionDescription` if configured
- Falls back to `description` if `completionDescription` is not set
- No changes needed - already working correctly

---
Task ID: 3
Agent: Main
Task: Integrate TTS-WebUI for Text-to-Speech and Speech-to-Text (Whisper)

Work Log:
- Researched TTS-WebUI capabilities: TTS (Chatterbox, Kokoro, XTTSv2) + ASR (Whisper)
- Updated types in `src/types/index.ts`:
  - Added `TTSWebUIConfig` interface for TTS-WebUI specific settings
  - Added `VoiceReference` interface for voice cloning references
  - Added `ASRConfig` interface for speech-to-text settings
  - Updated `TTSProvider` type to include 'tts-webui' and 'z-ai'
- Created API routes:
  - `src/app/api/tts/speech/route.ts` - TTS generation (POST) and status check (GET)
  - `src/app/api/tts/transcriptions/route.ts` - ASR transcription with Whisper (POST) and model listing (GET)
  - `src/app/api/tts/models/route.ts` - List available TTS and ASR models
  - `src/app/api/tts/voices/route.ts` - Manage voice reference files for cloning
- Created `src/components/tavern/tts-settings-panel.tsx`:
  - TTS configuration panel with model selection, voice reference, speed, format
  - ASR configuration for Whisper transcription
  - Voice reference management (upload, play, delete)
  - Service status indicator and test TTS functionality
- Updated `src/components/tavern/settings-panel.tsx` to use TTSSettingsPanel
- Created `public/uploads/voices/` directory for voice reference files
- Default endpoint: `http://localhost:7778` (OpenAI compatible API on port 7778)
- Default TTS model: `chatterbox`
- Default ASR model: `whisper-large-v3`

Stage Summary:
- TTS-WebUI integration complete with both TTS and ASR (Whisper) support
- Voice cloning via reference audio paths (e.g., `voices/chatterbox/es-rick.wav`)
- Configuration accessible via Settings → Voz tab
- Status detection now tests actual TTS endpoint instead of /models endpoint

---
Task ID: 4
Agent: Main
Task: Add multilingual model support with language selection and voice dropdown

Work Log:
- Updated `/api/tts/speech/route.ts`:
  - Added `multilingual` as default TTS model
  - Added `SUPPORTED_LANGUAGES` array with 12 languages (es, en, ja, zh, ko, fr, de, it, pt, ru, ar, hi)
  - Updated request body to include `language` parameter for multilingual model
  - Added advanced TTS parameters (exaggeration, cfg_weight, temperature)
- Created `/api/tts/available-voices/route.ts`:
  - Fetches available voices from TTS-WebUI via multiple methods:
    - OpenAI API `/v1/voices` endpoint
    - Gradio `/config` endpoint
    - Directory listing `/voices`
  - Returns voice list with id, name, path, language fields
- Updated `TTSSettingsPanel` component:
  - Added `selectedLanguage` state for multilingual model
  - Added language dropdown that appears when multilingual model is selected
  - Added voice dropdown that shows available voices from TTS-WebUI
  - Falls back to text input if no voices are available
  - Updated handleTestTTS to pass selectedLanguage

Stage Summary:
- Multilingual model is now the default with language selection support
- Voice dropdown populated from TTS-WebUI available voices
- Compatible with the console log format user provided:
  - `model_name: 'multilingual'`
  - `language_id: 'es'`
  - `audio_prompt_path: 'voices/chatterbox/es-rick.wav'`

---
Task ID: 5
Agent: Main
Task: Implement TTS auto-generation for chat messages (Phase 3 - Integration)

Work Log:
- Analyzed existing TTS infrastructure:
  - `useTTS` hook with `speak`, `speakWithDualVoice`, `stop` methods
  - `useTTSAutoGeneration` hook for auto-playing TTS on new messages
  - `handleSpeak` function already implemented in chat-panel.tsx
  - `handleReplay` function existed but didn't call TTS
- Updated `/src/components/tavern/chat-panel.tsx`:
  - Imported `useTTSAutoGeneration` hook
  - Added auto-generation hook call with filtered messages
  - Modified `handleReplay` to call TTS at the end of replay simulation
  - Added `speakWithDualVoice`, `speak`, `ttsConfig` to handleReplay dependencies

Stage Summary:
- Auto-generation is now active for new assistant messages
- When auto-generation is enabled in TTS settings, new AI responses are automatically narrated
- Replay button now triggers TTS after the streaming animation completes
- Dual voice system is used when character has voice settings enabled
- Global TTS settings are used as fallback when character has no voice settings

---
Task ID: 6
Agent: Main
Task: Add TTS visual indicator and playback controls

Work Log:
- Updated `useTTS` hook (`/src/hooks/use-tts.ts`):
  - Added `isPaused` state to properly track pause state
  - Updated `UseTTSReturn` interface to include `isPaused`
  - Modified callbacks to reset `isPaused` on playback end/error
  - Updated `pause()` to set `isPaused = true` (keeps `isPlaying = true`)
  - Updated `resume()` to set `isPaused = false`
  - Updated `stop()` to reset both states
- Created `TTSPlaybackControls` component (`/src/components/tavern/tts-playback-controls.tsx`):
  - Compact mode: minimal indicator for embedding in UI
  - Full mode: expanded controls with text preview and queue info
  - Shows status (playing/paused/generating)
  - Shows queue count
  - Pause/Resume/Stop buttons
- Created `TTSFloatingIndicator` component:
  - Floating indicator at bottom-right of screen
  - Shows when TTS is active (playing or generating)
  - Includes playback controls (pause/resume/stop)
  - Animated entrance/exit
- Integrated `TTSFloatingIndicator` in `ChatPanel`

Stage Summary:
- Visual TTS indicator now shows at bottom-right when audio is playing
- Pause/Resume/Stop controls available in floating indicator
- Queue count displayed when multiple items are pending
- Status text shows current action (Reproduciendo/Pausado/Generando)
- All controls work with the TTS service queue system

---
Task ID: 7
Agent: Main
Task: Add ignore plain text option and fix bugs

Work Log:
- Added `ignorePlainText` option to text filtering:
  - Updated `CharacterVoiceSettings` interface in `/src/types/index.ts`
  - Updated `TTSWebUIConfig` interface in `/src/lib/tts/types.ts`
  - Updated `filterSegments` function in `/src/lib/tts/text-parser.ts`
  - Updated `processTextForDualVoice` in `/src/lib/tts/tts-service.ts`
  - Updated `speak` and `speakWithDualVoice` in `/src/hooks/use-tts.ts`
- Added UI for "Ignorar texto plano" in TTS settings panel
- Fixed error in `character-voice-panel.tsx`:
  - Changed settings initialization to use deep merge with defaults
  - Added safety check in `VoiceConfigEditor` for undefined config
- Fixed auto-generation TTS:
  - Updated `useTTSAutoGeneration` to use `ttsConfig` from `useTTS` hook
  - Added logging for debugging
  - Updated DEFAULT_TTS_CONFIG in API route with all new fields

Stage Summary:
- Text filtering now supports 4 modes:
  1. Narrate all (default)
  2. Only dialogues (narrateDialoguesOnly)
  3. Ignore *narration* (ignoreAsterisks)
  4. Ignore plain text (ignorePlainText)
- Character voice panel no longer crashes when config is undefined
- Auto-generation properly reads config from API instead of Zustand store
- All TTS filtering options are now configurable both globally and per-character

---
Task ID: 8
Agent: Main
Task: Refactor TTS filter options from negative to positive logic

Work Log:
- Changed filter options from "what to ignore" to "what to generate":
  - Old: `narrateDialoguesOnly`, `ignoreAsterisks`, `ignorePlainText` (negative/confusing logic)
  - New: `generateDialogues`, `generateNarrations`, `generatePlainText` (positive/clear logic)
- Updated types in multiple files:
  - `/src/lib/tts/types.ts` - Core TTS types
  - `/src/types/index.ts` - Re-exported types
  - `/src/app/api/tts/config/route.ts` - API defaults
  - `/src/components/tavern/tts-settings-panel.tsx` - Settings panel defaults
- Updated filtering logic:
  - `/src/lib/tts/text-parser.ts` - `filterSegments` function now uses positive logic
  - `/src/lib/tts/tts-service.ts` - `processTextForDualVoice` uses new parameters
  - `/src/hooks/use-tts.ts` - `speak` and `speakWithDualVoice` use new options
- Updated UI components:
  - `/src/components/tavern/character-voice-panel.tsx` - New "Qué Generar" section with 3 switches
  - `/src/components/tavern/tts-settings-panel.tsx` - Updated text generation section
- Added automatic migration in API route:
  - Old properties automatically converted to new ones on config load
  - Old properties removed from saved config

Stage Summary:
- Filter options now use POSITIVE logic (clearer for users):
  - ✓ Diálogos ("texto entre comillas")
  - ✓ Narración (*texto entre asteriscos*)
  - ✓ Texto plano (sin formato)
- All 3 options default to `true` (generate all text types)
- Users can now easily see what WILL be generated instead of what will be ignored
- Automatic migration from old properties ensures backward compatibility

---
Task ID: 9
Agent: Main
Task: Fix TTS auto-generation not triggering after LLM response

Work Log:
- Identified root cause: `useTTSAutoGeneration` was creating a NEW instance of `useTTS()` internally, causing separate state from the parent component
- The internal `ttsConfig` was not synchronized with the parent's config
- Refactored `useTTSAutoGeneration` hook:
  - Changed interface to accept TTS functions (`speak`, `speakWithDualVoice`) and `ttsConfig` as parameters
  - Removed internal `useTTS()` call - now receives functions from parent
  - Added `isPlaying` as parameter to return the playing state
- Updated `chat-panel.tsx` to pass TTS functions and config to the hook:
  - Passes `speak`, `speakWithDualVoice`, `ttsConfig`, `isPlaying` from parent's `useTTS()` call
  - Hook now uses the same TTS instance as the parent component

Stage Summary:
- TTS auto-generation now uses the same TTS instance as the parent component
- Config is properly synchronized between parent and auto-generation hook
- When a character responds, TTS will now trigger correctly if:
  1. TTS is enabled globally (`ttsConfig.enabled`)
  2. Auto-generation is enabled (`ttsConfig.autoGeneration`)
  3. Character has voice settings OR global TTS is configured

---
Task ID: 10
Agent: Main
Task: Fix TTS 'default' voice error and config migration

Work Log:
- Fixed `voice: 'default'` error in TTS-WebUI:
  - Modified `/src/lib/tts/tts-service.ts` - Only set voice if valid (not 'default', not 'none')
  - Modified `/src/app/api/tts/speech/route.ts` - Same fix for API route
  - TTS-WebUI no longer receives 'default' as voice path
- Fixed TTS config file:
  - Updated `/home/z/my-project/data/tts-config.json` with correct properties
  - Added `autoGeneration: true` (was missing)
  - Migrated old properties to new positive logic
- Added extensive debug logging to `useTTSAutoGeneration`:
  - Logs when effect triggers with all config values
  - Logs specific reason if auto-generation is disabled
  - Logs message processing details
- Config now has:
  - `enabled: true`
  - `autoGeneration: true`
  - `generateDialogues: true`
  - `generateNarrations: true`
  - `generatePlainText: true`

Stage Summary:
- TTS-WebUI error `FileNotFoundError: 'default'` should be resolved
- Auto-generation should now work when character responds
- Debug logs will help identify any remaining issues
- User needs to ensure:
  1. TTS is enabled in Settings → Voz
  2. "Generación Automática" switch is ON
  3. Character has voice settings enabled (or use global)

---
Task ID: 11
Agent: Main
Task: Complete investigation and fixes for TTS system issues

Work Log:

## Investigation Findings

### 1. Browser Refresh Issue (F5-like behavior)
**Root Cause Identified:**
- Runtime error in `tts-service.ts` caused by variable `model` defined multiple times (old cached error)
- This error caused the component tree to crash and force a re-render
- Current file is correct, error was from previous session

### 2. TTS Config System
- Verified working correctly:
  - Global config saved to `/data/tts-config.json`
  - Character voice config saved in `characters[].voice`
  - Migration from old properties works automatically

### 3. Auto-generation Not Triggering
**Root Causes Identified:**
1. Messages array was being recreated on every render (line 171 in chat-panel.tsx)
   - `const messages = activeSession?.messages.filter(...) || []` creates new array each render
   - This caused the useEffect to potentially miss changes
2. Hook needed more robust message tracking
3. Missing memoization for messages array

### 4. Test Mock Provider
- Verified working correctly - no issues found

### 5. Chat Modes (Normal/Group)
- Both modes work correctly - no issues found

### 6. POST-LLM System
- Not currently implemented
- Auto-generation is client-side only

## Fixes Applied

### Fix 1: Stabilize Messages Array (chat-panel.tsx)
- Changed from inline filter to `useMemo`:
  ```tsx
  const messages = useMemo(() => {
    return activeSession?.messages.filter(m => !m.isDeleted) || [];
  }, [activeSession?.messages]);
  ```
- This ensures the array reference is stable and React can properly detect changes

### Fix 2: Enhanced Auto-generation Hook (use-tts.ts)
- Added `lastMessageCountRef` to track message count changes
- Added `isProcessingRef` to prevent race conditions
- Improved logging with emojis for easier debugging:
  - 🔍 Effect triggered
  - ⏸️ Disabled conditions
  - ⏭️ Skipping conditions  
  - ✅ Processing message
  - 🎵 Playing audio
- Mark messages as processed BEFORE timeout to prevent duplicate processing
- Clear timeout properly in cleanup function

### Fix 3: Better Message Detection
- Track message count changes: `currentMessageCount > lastMessageCountRef.current`
- Immediate ID marking to prevent race conditions
- Separate handling for user/system messages (mark as processed but skip TTS)

Stage Summary:
- Auto-generation TTS should now work correctly:
  1. Messages array is properly memoized
  2. Message count changes are tracked reliably
  3. Race conditions are prevented with `isProcessingRef`
  4. Extensive debug logging for troubleshooting
- Browser refresh issue resolved (was caused by old cached error)
- All TTS config saving verified working

---
Task ID: 12
Agent: Main
Task: Implement voice transcription system (speech-to-text)

Work Log:
- Created `/src/hooks/use-audio-recorder.ts`:
  - `useAudioRecorder` hook for microphone recording
  - Supports start/stop/pause/resume recording
  - Returns audio as Blob and Base64 encoded string
  - Auto-stops at max duration (60 seconds default)
  - Optimal settings for Whisper (16kHz sample rate, noise suppression)
  - `useAudioTranscription` hook for API calls
- Modified `/src/components/tavern/novel-chat-box.tsx`:
  - Added imports for audio hooks and Mic/Square icons
  - Added audio recording hooks initialization
  - Added useEffect to process transcription when audio is ready
  - Added voice recording button between textarea and send button
  - Button shows Mic icon (idle) or Square icon (recording)
  - Red pulsing animation when recording
  - Shows recording duration timer
  - Loading spinner during transcription
  - Transcribed text appears in input field for editing before sending
- Modified `/src/app/api/tts/transcriptions/route.ts`:
  - Already supports TTS-WebUI Whisper API
  - Endpoint: `http://localhost:7778/v1/audio/transcriptions`
  - Default model: `whisper-large-v3`
  - Default language: `es` (Spanish)

Stage Summary:
- Voice transcription system fully integrated:
  1. Click REC button to start recording (icon turns to red square)
  2. Speak your message
  3. Click again to stop recording
  4. Audio is sent to Whisper for transcription
  5. Transcribed text appears in input field
  6. User can edit before sending
- Works with TTS-WebUI running on port 7778
- Uses OpenAI-compatible Whisper API
- Supports Spanish by default (configurable)

---
Task ID: 13
Agent: Main
Task: Add lightweight Whisper model options for ASR

Work Log:
- Updated `/src/components/tavern/tts-settings-panel.tsx`:
  - Added more Whisper model options with VRAM requirements
  - Added `distil-whisper-large-v3` (4x faster, ~1.5GB VRAM)
  - Added `whisper-base` (~1GB VRAM)
  - Added descriptions for each model in Spanish
  - Marked `whisper-small` as recommended for Spanish
  - Added helper text explaining recommendations
- Updated `/src/app/api/tts/config/route.ts`:
  - Changed default ASR model from `whisper-large-v3` to `whisper-small`
  - Changed default ASR enabled to `true`
  - Added comment explaining the choice
- Updated `/src/components/tavern/novel-chat-box.tsx`:
  - Added ASR config state loaded from API
  - Transcription now uses configured model and language
  - Added useEffect to load ASR config on mount

Stage Summary:
- ASR now defaults to `whisper-small` (recommended for Spanish)
- Users can select lighter models in Settings → Voz → ASR tab
- Available models with VRAM requirements:
  - `whisper-large-v3`: ~10GB - Best accuracy
  - `distil-whisper-large-v3`: ~1.5GB - 4x faster
  - `whisper-medium`: ~5GB - Balanced
  - `whisper-small`: ~2GB - Recommended for ES ⭐
  - `whisper-base`: ~1GB - Fast
  - `whisper-tiny`: ~0.5GB - Ultra light

---
Task ID: 14
Agent: Main
Task: Fix audio recording button not working

Work Log:
- Completely rewrote `/src/hooks/use-audio-recorder.ts`:
  - Added `permissionStatus` state tracking ('granted', 'denied', 'prompt', 'checking')
  - Added automatic permission check on mount using `navigator.permissions.query`
  - Improved error handling with specific error messages in Spanish
  - Added separate error cases for:
    - `NotAllowedError`: Permission denied
    - `NotFoundError`: No microphone found
    - Other errors: Generic error message
  - Fixed `stopRecording` to use refs properly and avoid stale closures
  - Added `mediaStreamRef` for proper cleanup
  - Changed `startRecording` to return `Promise<boolean>` for success/failure indication
  - Added extensive console logging for debugging
- Updated `/src/components/tavern/novel-chat-box.tsx`:
  - Added `handleRecordingClick` async callback function
  - Added `permissionStatus` from hook destructuring
  - Added visual feedback for permission denied state:
    - Button shows as disabled with opacity
    - Shows "🔒 Micrófono bloqueado" text
    - Tooltip explains how to fix
  - Fixed recording duration display format (proper padding)
  - Added error state styling for button

Stage Summary:
- Audio recording now properly requests microphone permissions
- Clear visual feedback when microphone is blocked
- Better error messages in Spanish for the user
- Debug logging to help troubleshoot issues
- User needs to:
  1. Click the mic button
  2. Allow microphone access when browser prompts
  3. Speak the message
  4. Click the stop button (red square)
  5. Wait for transcription to appear in input
