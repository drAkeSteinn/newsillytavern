// ============================================
// useTTS Hook - TTS integration for chat
// Handles TTS playback, auto-generation, and voice settings
// Optimized to prevent unnecessary re-renders
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
  isConnected: boolean;
  connectionError: string | null;
  
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
  checkConnection: () => Promise<boolean>;
}

export function useTTS(options: UseTTSOptions = {}): UseTTSReturn {
  const { autoPlayOnNewMessage = true } = options;
  
  // Local state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentQueue, setCurrentQueue] = useState<TTSQueueItem[]>([]);
  const [ttsConfig, setTtsConfig] = useState<TTSWebUIConfig | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  // Refs
  const lastMessageIdRef = useRef<string>('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const connectionCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializedRef = useRef(false);

  // Check TTS connection status
  const checkConnection = useCallback(async (): Promise<boolean> => {
    if (!ttsConfig?.enabled) {
      return false;
    }

    try {
      const result = await ttsService.testConnection();
      const connected = result.status === 'online';
      setIsConnected(connected);
      setConnectionError(connected ? null : result.error || 'Connection failed');
      return connected;
    } catch (error) {
      setIsConnected(false);
      setConnectionError(error instanceof Error ? error.message : 'Connection failed');
      return false;
    }
  }, [ttsConfig?.enabled]);

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

  // Set up TTS service callbacks - only once
  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    ttsService.setCallbacks({
      onPlaybackStart: () => {
        setIsPlaying(true);
        setIsPaused(false);
      },
      onPlaybackEnd: () => {
        setIsPlaying(ttsService.getIsPlaying());
        setIsPaused(false);
        // Update queue only when playback ends
        const queue = ttsService.getQueue();
        setCurrentQueue([...queue]);
      },
      onPlaybackError: (item, error) => {
        console.error('[useTTS] Playback error:', error);
        setIsPlaying(false);
        setIsPaused(false);
      },
      onQueueUpdate: (queue) => {
        // Don't update on every queue change to prevent re-renders
        // Only update if queue length changes significantly
        if (Math.abs(queue.length - currentQueue.length) > 0) {
          setCurrentQueue([...queue]);
        }
      },
    });
  }, []); // Empty deps - only run once

  // Check connection when config loads
  useEffect(() => {
    if (!ttsConfig?.enabled) return;
    
    checkConnection();
    connectionCheckIntervalRef.current = setInterval(checkConnection, 30000);
    
    return () => {
      if (connectionCheckIntervalRef.current) {
        clearInterval(connectionCheckIntervalRef.current);
      }
    };
  }, [ttsConfig?.enabled, checkConnection]);

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

    // Check connection before speaking
    const connected = await checkConnection();
    if (!connected) {
      console.warn('[useTTS] TTS service is not connected, skipping speech');
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
  }, [ttsConfig, checkConnection]);

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

    // Check connection before speaking
    const connected = await checkConnection();
    if (!connected) {
      console.warn('[useTTS] TTS service is not connected, skipping speech');
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
  }, [ttsConfig, checkConnection]);

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
    isConnected,
    connectionError,
    speak,
    speakWithDualVoice,
    stop,
    pause,
    resume,
    loadConfig,
    loadVoices,
    checkConnection,
  };
}

// ============================================
// useTTSAutoGeneration Hook
// Automatically plays TTS for new messages
// ============================================

interface UseTTSAutoGenerationOptions {
  enabled?: boolean;
  delay?: number;
  speak?: (text: string, voiceSettings?: CharacterVoiceSettings | null, characterId?: string) => Promise<void>;
  speakWithDualVoice?: (text: string, voiceSettings: CharacterVoiceSettings, characterId?: string) => Promise<void>;
  ttsConfig: TTSWebUIConfig | null;
  isPlaying?: boolean;
  isConnected?: boolean;
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
    isPlaying,
    isConnected
  } = options;
  
  const lastProcessedIdRef = useRef<string>('');
  const lastMessageCountRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingRef = useRef<boolean>(false);
  
  const characters = useTavernStore((state) => state.characters);

  useEffect(() => {
    const currentMessageCount = messages.length;
    const lastMessage = messages[messages.length - 1];
    
    // Clear any pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Check all conditions
    if (!enabled) return;
    if (!ttsConfig?.enabled) return;
    if (!ttsConfig?.autoGeneration) return;
    if (!speak || !speakWithDualVoice) return;
    if (!isConnected) {
      console.log('[useTTSAutoGeneration] ⏸️ TTS not connected');
      return;
    }

    // Check if message count increased (new message added)
    const isNewMessage = currentMessageCount > lastMessageCountRef.current;
    lastMessageCountRef.current = currentMessageCount;
    
    if (!lastMessage) return;

    // Skip if already processed
    if (lastMessage.id === lastProcessedIdRef.current) return;
    
    // Skip if is user or system message
    if (lastMessage.role === 'user' || lastMessage.role === 'system') {
      lastProcessedIdRef.current = lastMessage.id;
      return;
    }
    
    // Skip if we're currently processing (prevent race conditions)
    if (isProcessingRef.current) return;

    // Mark as processed immediately to prevent duplicate processing
    lastProcessedIdRef.current = lastMessage.id;
    isProcessingRef.current = true;

    // Get character voice settings
    const character = characters.find(c => c.id === lastMessage.characterId);
    const voiceSettings = character?.voice;

    console.log('[useTTSAutoGeneration] ✅ Processing message for TTS:', {
      messageId: lastMessage.id,
      characterName: character?.name,
      hasVoiceSettings: !!voiceSettings,
      voiceEnabled: voiceSettings?.enabled,
    });

    // Delay before playing to allow message to fully render
    timeoutRef.current = setTimeout(() => {
      isProcessingRef.current = false;
      
      if (voiceSettings?.enabled) {
        speakWithDualVoice(lastMessage.content, voiceSettings, lastMessage.characterId);
      } else {
        speak(lastMessage.content, null, lastMessage.characterId);
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
    isConnected,
  ]);

  return { isPlaying: isPlaying ?? false };
}
