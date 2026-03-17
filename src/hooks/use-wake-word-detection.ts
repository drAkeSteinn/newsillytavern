/**
 * useWakeWordDetection Hook
 * 
 * React hook for wake word detection with VAD integration
 * Provides easy integration with the chat system
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { WakeWordDetector, CharacterWakeWords } from '@/lib/wake-word-detector';
import { VADProcessor, createVADProcessor } from '@/lib/vad-processor';
import type { 
  VADConfig, 
  WakeWordDetectionResult 
} from '@/types';

export interface UseWakeWordDetectionOptions {
  /** Characters with their wake words */
  characters?: CharacterWakeWords[];
  /** Global VAD configuration */
  vadConfig?: Partial<VADConfig>;
  /** Default language for speech recognition */
  language?: string;
  /** Auto-start detection on mount */
  autoStart?: boolean;
  /** Callback when wake word is detected */
  onWakeWordDetected?: (result: WakeWordDetectionResult) => void;
  /** Callback when recording should start */
  onStartRecording?: () => void;
  /** Callback when recording should stop (VAD silence) */
  onStopRecording?: () => void;
  /** Callback for transcript updates */
  onTranscript?: (transcript: string, isFinal: boolean) => void;
  /** Callback for errors */
  onError?: (error: string) => void;
}

export interface UseWakeWordDetectionReturn {
  // State
  isListening: boolean;
  isActive: boolean;
  isSupported: boolean;
  currentTranscript: string;
  audioLevel: number;
  lastDetection: WakeWordDetectionResult | null;
  error: string | null;
  permissionGranted: boolean | null;
  
  // Actions
  startDetection: () => Promise<boolean>;
  stopDetection: () => void;
  updateCharacters: (characters: CharacterWakeWords[]) => void;
  updateVADConfig: (config: Partial<VADConfig>) => void;
  requestPermission: () => Promise<boolean>;
  clearError: () => void;
}

// Check support during module load
const checkSpeechRecognitionSupport = (): boolean => {
  if (typeof window === 'undefined') return false;
  return !!(window.SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition);
};

/**
 * Hook for wake word detection with VAD
 */
export function useWakeWordDetection(
  options: UseWakeWordDetectionOptions = {}
): UseWakeWordDetectionReturn {
  const {
    characters = [],
    vadConfig,
    language = 'es-ES',
    autoStart = false,
    onWakeWordDetected,
    onStartRecording,
    onStopRecording,
    onTranscript,
    onError,
  } = options;
  
  // State - initialize with support check
  const [isListening, setIsListening] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [isSupported] = useState(checkSpeechRecognitionSupport);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [lastDetection, setLastDetection] = useState<WakeWordDetectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  
  // Refs
  const detectorRef = useRef<WakeWordDetector | null>(null);
  const vadRef = useRef<VADProcessor | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  
  // Store callbacks in refs to avoid dependency issues
  const callbacksRef = useRef({
    onWakeWordDetected,
    onStartRecording,
    onStopRecording,
    onTranscript,
    onError,
    vadConfig,
  });
  
  // Update callbacks ref when options change
  useEffect(() => {
    callbacksRef.current = {
      onWakeWordDetected,
      onStartRecording,
      onStopRecording,
      onTranscript,
      onError,
      vadConfig,
    };
  });
  
  // Handle wake word trigger - start recording with VAD
  const handleWakeWordTrigger = useCallback(async (_result: WakeWordDetectionResult) => {
    console.log('[useWakeWord] Starting recording after wake word detection');
    
    try {
      // Request microphone access for recording
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
          channelCount: 1,
        },
        video: false,
      });
      
      mediaStreamRef.current = stream;
      setPermissionGranted(true);
      
      // Create VAD processor for auto-stop
      vadRef.current = createVADProcessor(callbacksRef.current.vadConfig || {}, {
        onSilenceDetected: () => {
          console.log('[useWakeWord] VAD silence detected, stopping recording');
          callbacksRef.current.onStopRecording?.();
          vadRef.current?.stop();
        },
        onSpeechStart: () => {
          console.log('[useWakeWord] Speech started');
        },
        onSpeechEnd: () => {
          console.log('[useWakeWord] Speech ended');
        },
        onVolumeChange: (volume) => {
          setAudioLevel(volume);
        },
        onError: (err) => {
          console.error('[useWakeWord] VAD error:', err);
          setError(err);
        },
      });
      
      // Start VAD monitoring
      await vadRef.current.start(stream);
      
      // Notify recording start
      callbacksRef.current.onStartRecording?.();
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start recording';
      console.error('[useWakeWord] Failed to start recording:', errorMessage);
      
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setPermissionGranted(false);
        setError('Microphone permission denied');
      } else {
        setError(errorMessage);
      }
    }
  }, []);
  
  // Initialize detector
  useEffect(() => {
    // Skip if not supported
    if (!isSupported) {
      return;
    }
    
    // Create detector
    detectorRef.current = new WakeWordDetector({
      onWakeWordDetected: (result) => {
        console.log('[useWakeWord] Wake word detected:', result);
        setLastDetection(result);
        callbacksRef.current.onWakeWordDetected?.(result);
        handleWakeWordTrigger(result);
      },
      onListeningChange: setIsListening,
      onTranscript: (transcript, isFinal) => {
        setCurrentTranscript(transcript);
        callbacksRef.current.onTranscript?.(transcript, isFinal);
      },
      onError: (err) => {
        setError(err);
        callbacksRef.current.onError?.(err);
      },
      onPermissionChange: (granted) => {
        setPermissionGranted(granted);
      },
    });
    
    // Set initial characters
    if (characters.length > 0) {
      detectorRef.current.setCharacters(characters);
    }
    
    // Set language
    detectorRef.current.setLanguage(language);
    
    // Auto-start if enabled
    if (autoStart) {
      detectorRef.current.start();
    }
    
    // Cleanup
    return () => {
      detectorRef.current?.destroy();
      detectorRef.current = null;
      vadRef.current?.stop();
      vadRef.current = null;
      mediaStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [isSupported, handleWakeWordTrigger, autoStart, language]);
  
  // Update characters when they change
  useEffect(() => {
    if (detectorRef.current) {
      detectorRef.current.setCharacters(characters);
    }
  }, [characters]);
  
  // Start detection
  const startDetection = useCallback(async (): Promise<boolean> => {
    if (!detectorRef.current) {
      setError('Detector not initialized');
      return false;
    }
    
    setError(null);
    const success = await detectorRef.current.start();
    setIsActive(success);
    return success;
  }, []);
  
  // Stop detection
  const stopDetection = useCallback(() => {
    detectorRef.current?.stop();
    vadRef.current?.stop();
    mediaStreamRef.current?.getTracks().forEach(t => t.stop());
    setIsActive(false);
    setIsListening(false);
    setAudioLevel(0);
  }, []);
  
  // Update characters
  const updateCharacters = useCallback((newCharacters: CharacterWakeWords[]) => {
    detectorRef.current?.setCharacters(newCharacters);
  }, []);
  
  // Update VAD config
  const updateVADConfig = useCallback((config: Partial<VADConfig>) => {
    vadRef.current?.updateConfig(config);
  }, []);
  
  // Request permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      setPermissionGranted(true);
      setError(null);
      return true;
    } catch {
      setPermissionGranted(false);
      setError('Microphone permission denied');
      return false;
    }
  }, []);
  
  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);
  
  return {
    isListening,
    isActive,
    isSupported,
    currentTranscript,
    audioLevel,
    lastDetection,
    error,
    permissionGranted,
    startDetection,
    stopDetection,
    updateCharacters,
    updateVADConfig,
    requestPermission,
    clearError,
  };
}

/**
 * Hook for just VAD (Voice Activity Detection)
 */
export function useVAD(
  config: Partial<VADConfig> = {},
  callbacks: {
    onSilenceDetected?: () => void;
    onSpeechStart?: () => void;
    onSpeechEnd?: () => void;
    onVolumeChange?: (volume: number) => void;
  } = {}
) {
  const [audioLevel, setAudioLevel] = useState(0);
  const [isSpeechDetected, setIsSpeechDetected] = useState(false);
  const [isActive, setIsActive] = useState(false);
  
  const vadRef = useRef<VADProcessor | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Store callbacks in ref
  const callbacksRef = useRef(callbacks);
  useEffect(() => {
    callbacksRef.current = callbacks;
  });
  
  const startVAD = useCallback(async (mediaStream?: MediaStream): Promise<boolean> => {
    try {
      let stream = mediaStream;
      
      if (!stream) {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 16000,
            channelCount: 1,
          },
          video: false,
        });
        streamRef.current = stream;
      }
      
      vadRef.current = createVADProcessor(config, {
        onSilenceDetected: () => {
          setIsSpeechDetected(false);
          callbacksRef.current.onSilenceDetected?.();
        },
        onSpeechStart: () => {
          setIsSpeechDetected(true);
          callbacksRef.current.onSpeechStart?.();
        },
        onSpeechEnd: () => {
          setIsSpeechDetected(false);
          callbacksRef.current.onSpeechEnd?.();
        },
        onVolumeChange: (volume) => {
          setAudioLevel(volume);
          callbacksRef.current.onVolumeChange?.(volume);
        },
        onError: console.error,
      });
      
      await vadRef.current.start(stream);
      setIsActive(true);
      return true;
    } catch (err) {
      console.error('[useVAD] Failed to start:', err);
      return false;
    }
  }, [config]);
  
  const stopVAD = useCallback(() => {
    vadRef.current?.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    setIsActive(false);
    setIsSpeechDetected(false);
    setAudioLevel(0);
  }, []);
  
  useEffect(() => {
    return () => {
      stopVAD();
    };
  }, [stopVAD]);
  
  return {
    audioLevel,
    isSpeechDetected,
    isActive,
    startVAD,
    stopVAD,
  };
}
