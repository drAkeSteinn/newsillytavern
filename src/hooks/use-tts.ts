// ============================================
// useTTS Hook - TTS integration for chat
// Handles TTS playback, auto-generation, and voice settings
// ============================================

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTavernStore } from '@/store/tavern-store';
import { 
  ttsService,
  parseTextSegments,
  filterSegments,
  cleanTextForTTS,
} from '@/lib/tts';
import type { 
  CharacterVoiceSettings, 
  CharacterVoiceConfig, 
  TTSWebUIConfig,
  TTSQueueItem,
} from '@/types';
import { DEFAULT_TTS_WEBUI_CONFIG } from '@/lib/tts/types';

interface UseTTSOptions {
  autoPlayOnNewMessage?: boolean;
}

interface UseTTSReturn {
  // State
  isPlaying: boolean;
  isPaused: boolean;
  currentQueue: TTSQueueItem[];
  ttsConfig: TTSWebUIConfig | null;
  isLoadingConfig: boolean;
  
  // Actions
  speak: (
    text: string, 
    voiceSettings?: CharacterVoiceSettings | null,
    characterId?: string
  ) => Promise<void>;
  speakWithDualVoice: (
    text: string,
    voiceSettings: CharacterVoiceSettings,
    characterId?: string
  ) => Promise<void>;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  
  // Config
  loadConfig: () => Promise<void>;
  loadVoices: () => Promise<void>;
}

export function useTTS(options: UseTTSOptions = {}): UseTTSReturn {
  const { autoPlayOnNewMessage = true } = options;
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentQueue, setCurrentQueue] = useState<TTSQueueItem[]>([]);
  const [ttsConfig, setTtsConfig] = useState<TTSWebUIConfig | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  
  // Refs
  const lastMessageIdRef = useRef<string>('');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load TTS config from API
  const loadConfig = useCallback(async () => {
    setIsLoadingConfig(true);
    try {
      const response = await fetch('/api/tts/config');
      const data = await response.json();
      if (data.success && data.config?.tts) {
        const config = {
          ...DEFAULT_TTS_WEBUI_CONFIG,
          ...data.config.tts,
        };
        setTtsConfig(config);
        ttsService.setConfig(config);
      } else {
        setTtsConfig(DEFAULT_TTS_WEBUI_CONFIG);
        ttsService.setConfig(DEFAULT_TTS_WEBUI_CONFIG);
      }
    } catch (error) {
      console.error('[useTTS] Failed to load config:', error);
      setTtsConfig(DEFAULT_TTS_WEBUI_CONFIG);
    } finally {
      setIsLoadingConfig(false);
    }
  }, []);

  // Load config on mount
  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Set up TTS service callbacks
  useEffect(() => {
    ttsService.setCallbacks({
      onPlaybackStart: (item) => {
        setIsPlaying(true);
        setIsPaused(false);
      },
      onPlaybackEnd: (item) => {
        setIsPlaying(ttsService.getIsPlaying());
        setIsPaused(false);
        setCurrentQueue(ttsService.getQueue());
      },
      onPlaybackError: (item, error) => {
        console.error('[useTTS] Playback error:', error);
        setIsPlaying(ttsService.getIsPlaying());
        setIsPaused(false);
      },
      onQueueUpdate: (queue) => {
        setCurrentQueue([...queue]);
      },
    });
  }, []);

  // Speak text with single voice (simple mode)
  const speak = useCallback(async (
    text: string,
    voiceSettings?: CharacterVoiceSettings | null,
    characterId?: string
  ) => {
    if (!ttsConfig?.enabled) {
      console.log('[useTTS] TTS is disabled');
      return;
    }

    // Use voice settings or fall back to global config
    const voiceConfig: CharacterVoiceConfig = voiceSettings?.dialogueVoice || {
      enabled: true,
      voiceId: ttsConfig.defaultVoice || 'default',
      exaggeration: ttsConfig.exaggeration,
      cfgWeight: ttsConfig.cfgWeight,
      temperature: ttsConfig.temperature,
      speed: ttsConfig.speed,
      language: ttsConfig.language,
    };

    // Process text based on generation options (positive logic)
    const filterOpts = {
      generateDialogues: voiceSettings?.generateDialogues ?? ttsConfig.generateDialogues ?? true,
      generateNarrations: voiceSettings?.generateNarrations ?? ttsConfig.generateNarrations ?? true,
      generatePlainText: voiceSettings?.generatePlainText ?? ttsConfig.generatePlainText ?? true,
    };

    const segments = parseTextSegments(text);
    const filtered = filterSegments(segments, filterOpts);

    // Clean and join text
    const cleanText = filtered
      .map(s => cleanTextForTTS(s.text))
      .filter(t => t.length > 0)
      .join(' ');

    if (!cleanText) {
      console.log('[useTTS] No text to speak after filtering');
      return;
    }

    // Add to queue
    ttsService.addToQueue(cleanText, voiceConfig, { characterId });
  }, [ttsConfig]);

  // Speak with dual voice (dialogue + narrator)
  const speakWithDualVoice = useCallback(async (
    text: string,
    voiceSettings: CharacterVoiceSettings,
    characterId?: string
  ) => {
    if (!ttsConfig?.enabled) {
      console.log('[useTTS] TTS is disabled');
      return;
    }

    if (!voiceSettings.enabled) {
      console.log('[useTTS] Voice disabled for this character');
      return;
    }

    // Process text with dual voice settings
    const segments = ttsService.processTextForDualVoice(text, {
      dialogueVoice: voiceSettings.dialogueVoice,
      narratorVoice: voiceSettings.narratorVoice,
      generateDialogues: voiceSettings.generateDialogues,
      generateNarrations: voiceSettings.generateNarrations,
      generatePlainText: voiceSettings.generatePlainText,
    });

    if (segments.length === 0) {
      console.log('[useTTS] No text segments to speak');
      return;
    }

    // Add each segment to the queue
    for (const segment of segments) {
      if (segment.voiceConfig.enabled) {
        ttsService.addToQueue(segment.text, segment.voiceConfig, { characterId });
      }
    }
  }, [ttsConfig]);

  // Stop playback
  const stop = useCallback(() => {
    ttsService.stop();
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentQueue([]);
  }, []);

  // Pause playback
  const pause = useCallback(() => {
    ttsService.pause();
    setIsPaused(true);
  }, []);

  // Resume playback
  const resume = useCallback(() => {
    ttsService.resume();
    setIsPaused(false);
  }, []);

  // Load voices
  const loadVoices = useCallback(async () => {
    await ttsService.fetchVoices(true);
  }, []);

  return {
    isPlaying,
    isPaused,
    currentQueue,
    ttsConfig,
    isLoadingConfig,
    speak,
    speakWithDualVoice,
    stop,
    pause,
    resume,
    loadConfig,
    loadVoices,
  };
}

// ============================================
// useTTSAutoGeneration Hook
// Automatically plays TTS for new messages
// ============================================

interface UseTTSAutoGenerationOptions {
  enabled?: boolean;
  delay?: number;
  // Pass TTS functions and config from parent to avoid creating new instances
  speak?: (text: string, voiceSettings?: CharacterVoiceSettings | null, characterId?: string) => Promise<void>;
  speakWithDualVoice?: (text: string, voiceSettings: CharacterVoiceSettings, characterId?: string) => Promise<void>;
  ttsConfig: TTSWebUIConfig | null;
  isPlaying?: boolean;
}

export function useTTSAutoGeneration(
  messages: Array<{ id: string; role: string; content: string; characterId?: string }>,
  options: UseTTSAutoGenerationOptions
) {
  const { 
    enabled = true, 
    delay = 500,
    speak,
    speakWithDualVoice,
    ttsConfig,
    isPlaying
  } = options;
  
  const lastProcessedIdRef = useRef<string>('');
  const lastMessageCountRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingRef = useRef<boolean>(false);
  
  const characters = useTavernStore((state) => state.characters);

  useEffect(() => {
    // Debug: Log when effect runs with detailed info
    const currentMessageCount = messages.length;
    const lastMessage = messages[messages.length - 1];
    
    console.log('[useTTSAutoGeneration] 🔍 Effect triggered', {
      messageCount: currentMessageCount,
      previousCount: lastMessageCountRef.current,
      countChanged: currentMessageCount !== lastMessageCountRef.current,
      lastMessageId: lastMessage?.id,
      lastMessageRole: lastMessage?.role,
      lastProcessedId: lastProcessedIdRef.current,
      isProcessing: isProcessingRef.current,
      enabled,
      ttsEnabled: ttsConfig?.enabled,
      autoGeneration: ttsConfig?.autoGeneration,
      hasSpeak: !!speak,
      hasSpeakWithDualVoice: !!speakWithDualVoice,
    });
    
    // Clear any pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Check if auto-generation is enabled and functions are available
    if (!enabled) {
      console.log('[useTTSAutoGeneration] ⏸️ Disabled: enabled=false');
      return;
    }
    if (!ttsConfig?.enabled) {
      console.log('[useTTSAutoGeneration] ⏸️ Disabled: ttsConfig.enabled=false');
      return;
    }
    if (!ttsConfig?.autoGeneration) {
      console.log('[useTTSAutoGeneration] ⏸️ Disabled: ttsConfig.autoGeneration=false');
      return;
    }
    if (!speak || !speakWithDualVoice) {
      console.log('[useTTSAutoGeneration] ⏸️ Disabled: missing speak functions');
      return;
    }

    // Check if message count increased (new message added)
    const isNewMessage = currentMessageCount > lastMessageCountRef.current;
    
    // Update the count reference for next comparison
    lastMessageCountRef.current = currentMessageCount;
    
    // Find the last message
    if (!lastMessage) {
      console.log('[useTTSAutoGeneration] ⏸️ No messages');
      return;
    }

    // Skip if already processed
    if (lastMessage.id === lastProcessedIdRef.current) {
      console.log('[useTTSAutoGeneration] ⏭️ Skipping: already processed', {
        messageId: lastMessage.id,
      });
      return;
    }
    
    // Skip if is user or system message
    if (lastMessage.role === 'user' || lastMessage.role === 'system') {
      console.log('[useTTSAutoGeneration] ⏭️ Skipping: user/system message', {
        role: lastMessage.role,
      });
      // Still mark as processed so we don't check it again
      lastProcessedIdRef.current = lastMessage.id;
      return;
    }
    
    // Skip if we're currently processing (prevent race conditions)
    if (isProcessingRef.current) {
      console.log('[useTTSAutoGeneration] ⏭️ Skipping: already processing');
      return;
    }

    // Mark as processed immediately to prevent duplicate processing
    lastProcessedIdRef.current = lastMessage.id;
    isProcessingRef.current = true;

    // Get character voice settings
    const character = characters.find(c => c.id === lastMessage.characterId);
    const voiceSettings = character?.voice;

    console.log('[useTTSAutoGeneration] ✅ Processing message for TTS:', {
      messageId: lastMessage.id,
      role: lastMessage.role,
      characterId: lastMessage.characterId,
      characterName: character?.name,
      hasVoiceSettings: !!voiceSettings,
      voiceEnabled: voiceSettings?.enabled,
      contentPreview: lastMessage.content.substring(0, 50) + '...',
      isNewMessage,
    });

    // Delay before playing to allow message to fully render
    timeoutRef.current = setTimeout(() => {
      isProcessingRef.current = false;
      
      if (voiceSettings?.enabled) {
        console.log('[useTTSAutoGeneration] 🎵 Using dual voice system');
        // Use dual voice system
        speakWithDualVoice(
          lastMessage.content,
          voiceSettings,
          lastMessage.characterId
        );
      } else {
        console.log('[useTTSAutoGeneration] 🎵 Using global TTS settings');
        // Use global TTS settings
        speak(
          lastMessage.content,
          null,
          lastMessage.characterId
        );
      }
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      isProcessingRef.current = false;
    };
  }, [
    messages,
    enabled,
    delay,
    ttsConfig,
    characters,
    speak,
    speakWithDualVoice,
  ]);

  return { isPlaying: isPlaying ?? false };
}
