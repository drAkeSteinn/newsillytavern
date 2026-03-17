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
