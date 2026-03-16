// ============================================
// TTS Service - Text-to-Speech generation and playback
// Handles TTS-WebUI integration with queue management
// ============================================

import type { 
  CharacterVoiceConfig, 
  TTSQueueItem, 
  VoiceInfo,
  TTSWebUIConfig,
  TextSegment,
} from './types';
import { DEFAULT_VOICE_CONFIG, DEFAULT_TTS_WEBUI_CONFIG } from './types';
import { parseTextSegments, filterSegments, cleanTextForTTS } from './text-parser';

// ============================================
// TTS Service Class
// ============================================

class TTSService {
  private config: TTSWebUIConfig = { ...DEFAULT_TTS_WEBUI_CONFIG };
  private queue: TTSQueueItem[] = [];
  private currentAudio: HTMLAudioElement | null = null;
  private isPlaying: boolean = false;
  private voicesCache: VoiceInfo[] = [];
  private lastVoicesFetch: number = 0;
  private voicesCacheTTL: number = 5 * 60 * 1000; // 5 minutes

  // Event callbacks
  private onPlaybackStart?: (item: TTSQueueItem) => void;
  private onPlaybackEnd?: (item: TTSQueueItem) => void;
  private onPlaybackError?: (item: TTSQueueItem, error: string) => void;
  private onQueueUpdate?: (queue: TTSQueueItem[]) => void;

  // ============================================
  // Configuration
  // ============================================

  setConfig(config: Partial<TTSWebUIConfig>) {
    this.config = { ...this.config, ...config };
  }

  getConfig(): TTSWebUIConfig {
    return { ...this.config };
  }

  setCallbacks(callbacks: {
    onPlaybackStart?: (item: TTSQueueItem) => void;
    onPlaybackEnd?: (item: TTSQueueItem) => void;
    onPlaybackError?: (item: TTSQueueItem, error: string) => void;
    onQueueUpdate?: (queue: TTSQueueItem[]) => void;
  }) {
    this.onPlaybackStart = callbacks.onPlaybackStart;
    this.onPlaybackEnd = callbacks.onPlaybackEnd;
    this.onPlaybackError = callbacks.onPlaybackError;
    this.onQueueUpdate = callbacks.onQueueUpdate;
  }

  // ============================================
  // Voice Management
  // ============================================

  async fetchVoices(forceRefresh: boolean = false): Promise<VoiceInfo[]> {
    const now = Date.now();
    
    // Use cache if valid
    if (!forceRefresh && this.voicesCache.length > 0 && (now - this.lastVoicesFetch) < this.voicesCacheTTL) {
      return this.voicesCache;
    }

    try {
      const baseUrl = this.config.baseUrl.replace(/\/v1$/, '').replace(/\/$/, '');
      const response = await fetch(`${baseUrl}/v1/audio/voices`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch voices: ${response.status}`);
      }

      const data = await response.json();
      
      let voices: VoiceInfo[] = [];
      if (data.voices && Array.isArray(data.voices)) {
        voices = data.voices.map((voice: { id: string; name?: string }) => ({
          id: voice.id,
          name: voice.name || voice.id.split('/').pop() || voice.id,
          path: voice.id,
          language: extractLanguage(voice.id),
        }));
      }

      this.voicesCache = voices;
      this.lastVoicesFetch = now;
      
      return voices;
    } catch (error) {
      console.error('[TTS] Failed to fetch voices:', error);
      return this.voicesCache; // Return cached voices on error
    }
  }

  getCachedVoices(): VoiceInfo[] {
    return [...this.voicesCache];
  }

  // ============================================
  // Audio Generation
  // ============================================

  async generateSpeech(
    text: string,
    voiceConfig: CharacterVoiceConfig,
    options?: {
      model?: string;
      language?: string;
      responseFormat?: 'mp3' | 'wav' | 'ogg' | 'flac';
    }
  ): Promise<{ audioBlob: Blob; format: string }> {
    const baseUrl = this.config.baseUrl.replace(/\/v1$/, '').replace(/\/$/, '');
    
    // Build request body
    const requestBody: Record<string, unknown> = {
      input: text,
      model: 'chatterbox',
      response_format: options?.responseFormat || this.config.responseFormat,
    };

    // Set voice - only if we have a valid voice ID
    // For multilingual model, voice is optional (uses synthetic voice)
    // For standard chatterbox, we need a reference voice
    const model = options?.model || this.config.model;
    
    if (voiceConfig.voiceId && 
        voiceConfig.voiceId !== 'default' && 
        voiceConfig.voiceId !== 'none') {
      requestBody.voice = voiceConfig.voiceId;
    } else if (this.config.defaultVoice && 
               this.config.defaultVoice !== 'default' && 
               this.config.defaultVoice !== 'none') {
      requestBody.voice = this.config.defaultVoice;
    }
    // If no valid voice and not multilingual, don't set voice at all
    // The server will use its default behavior

    // Build params object
    const params: Record<string, unknown> = {
      device: 'auto',
      dtype: 'bfloat16',
    };

    // Set model type (multilingual or standard)
    if (model === 'multilingual') {
      params.model_name = 'multilingual';
      params.language_id = voiceConfig.language || options?.language || this.config.language || 'es';
    }

    // Set voice parameters (use voice config or fall back to global config)
    params.exaggeration = voiceConfig.exaggeration ?? this.config.exaggeration;
    params.cfg_weight = voiceConfig.cfgWeight ?? this.config.cfgWeight;
    params.temperature = voiceConfig.temperature ?? this.config.temperature;

    requestBody.params = params;

    console.log('[TTS] Generating speech for:', text.substring(0, 50) + '...');
    console.log('[TTS] Request:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(`${baseUrl}/v1/audio/speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`TTS generation failed: ${response.status} - ${errorText}`);
    }

    const audioBlob = await response.blob();
    return { 
      audioBlob, 
      format: options?.responseFormat || this.config.responseFormat 
    };
  }

  // ============================================
  // Text Processing
  // ============================================

  processTextForDualVoice(
    text: string,
    options: {
      dialogueVoice: CharacterVoiceConfig;
      narratorVoice: CharacterVoiceConfig;
      generateDialogues?: boolean;
      generateNarrations?: boolean;
      generatePlainText?: boolean;
    }
  ): Array<{ text: string; voiceConfig: CharacterVoiceConfig }> {
    const segments = parseTextSegments(text);
    const filtered = filterSegments(segments, {
      generateDialogues: options.generateDialogues,
      generateNarrations: options.generateNarrations,
      generatePlainText: options.generatePlainText,
    });

    return filtered
      .filter(segment => segment.text.trim().length > 0)
      .map(segment => {
        const cleanedText = cleanTextForTTS(segment.text);
        
        // Select voice based on segment type
        let voiceConfig: CharacterVoiceConfig;
        switch (segment.type) {
          case 'dialogue':
            voiceConfig = options.dialogueVoice;
            break;
          case 'narrator':
            voiceConfig = options.narratorVoice;
            break;
          case 'plain':
          default:
            // For plain text, use dialogue voice by default
            voiceConfig = options.dialogueVoice;
        }

        return {
          text: cleanedText,
          voiceConfig: { ...DEFAULT_VOICE_CONFIG, ...voiceConfig },
        };
      })
      .filter(item => item.text.length > 0);
  }

  // ============================================
  // Queue Management
  // ============================================

  addToQueue(
    text: string,
    voiceConfig: CharacterVoiceConfig,
    options?: {
      characterId?: string;
      priority?: number;
    }
  ): string {
    const id = `tts-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const item: TTSQueueItem = {
      id,
      text,
      voiceConfig: { ...DEFAULT_VOICE_CONFIG, ...voiceConfig },
      characterId: options?.characterId,
      priority: options?.priority || 0,
      status: 'pending',
    };

    // Insert sorted by priority
    const insertIndex = this.queue.findIndex(i => i.priority < item.priority);
    if (insertIndex === -1) {
      this.queue.push(item);
    } else {
      this.queue.splice(insertIndex, 0, item);
    }

    this.onQueueUpdate?.(this.queue);
    
    // Start processing if not playing
    if (!this.isPlaying) {
      this.processQueue();
    }

    return id;
  }

  private async processQueue() {
    if (this.isPlaying || this.queue.length === 0) {
      return;
    }

    const item = this.queue[0];
    if (item.status !== 'pending') {
      return;
    }

    this.isPlaying = true;
    item.status = 'generating';
    this.onQueueUpdate?.(this.queue);

    try {
      const { audioBlob } = await this.generateSpeech(item.text, item.voiceConfig);
      
      item.status = 'ready';
      item.audioUrl = URL.createObjectURL(audioBlob);
      item.audioBlob = audioBlob;
      this.onQueueUpdate?.(this.queue);

      // Play audio
      await this.playItem(item);
    } catch (error) {
      item.status = 'error';
      item.error = error instanceof Error ? error.message : 'Unknown error';
      this.onPlaybackError?.(item, item.error);
      this.onQueueUpdate?.(this.queue);
    }
  }

  private async playItem(item: TTSQueueItem) {
    if (!item.audioUrl) {
      return;
    }

    item.status = 'playing';
    this.onPlaybackStart?.(item);
    this.onQueueUpdate?.(this.queue);

    this.currentAudio = new Audio(item.audioUrl);
    
    return new Promise<void>((resolve) => {
      if (!this.currentAudio) {
        resolve();
        return;
      }

      this.currentAudio.onended = () => {
        item.status = 'completed';
        this.onPlaybackEnd?.(item);
        this.cleanupCurrentItem();
        this.playNext();
        resolve();
      };

      this.currentAudio.onerror = (e) => {
        item.status = 'error';
        item.error = 'Audio playback failed';
        this.onPlaybackError?.(item, item.error);
        this.cleanupCurrentItem();
        this.playNext();
        resolve();
      };

      this.currentAudio.play().catch((error) => {
        item.status = 'error';
        item.error = error.message;
        this.onPlaybackError?.(item, item.error);
        this.cleanupCurrentItem();
        this.playNext();
        resolve();
      });
    });
  }

  private playNext() {
    // Remove completed item from queue
    if (this.queue.length > 0 && this.queue[0].status === 'completed') {
      this.queue.shift();
    }

    this.isPlaying = false;
    this.onQueueUpdate?.(this.queue);

    // Process next item
    if (this.queue.length > 0) {
      this.processQueue();
    }
  }

  private cleanupCurrentItem() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
  }

  // ============================================
  // Playback Controls
  // ============================================

  stop() {
    this.cleanupCurrentItem();
    
    // Clean up all queued items
    for (const item of this.queue) {
      if (item.audioUrl) {
        URL.revokeObjectURL(item.audioUrl);
      }
    }
    
    this.queue = [];
    this.isPlaying = false;
    this.onQueueUpdate?.(this.queue);
  }

  pause() {
    if (this.currentAudio) {
      this.currentAudio.pause();
    }
  }

  resume() {
    if (this.currentAudio) {
      this.currentAudio.play();
    }
  }

  getQueue(): TTSQueueItem[] {
    return [...this.queue];
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  removeFromQueue(itemId: string) {
    const index = this.queue.findIndex(item => item.id === itemId);
    if (index !== -1) {
      const item = this.queue[index];
      if (item.audioUrl) {
        URL.revokeObjectURL(item.audioUrl);
      }
      this.queue.splice(index, 1);
      this.onQueueUpdate?.(this.queue);
    }
  }

  clearQueue() {
    for (const item of this.queue) {
      if (item.audioUrl) {
        URL.revokeObjectURL(item.audioUrl);
      }
    }
    this.queue = [];
    this.onQueueUpdate?.(this.queue);
  }

  // ============================================
  // Utility Methods
  // ============================================

  async testConnection(): Promise<{ status: 'online' | 'offline'; error?: string }> {
    try {
      const baseUrl = this.config.baseUrl.replace(/\/v1$/, '').replace(/\/$/, '');
      const response = await fetch(`${baseUrl}/v1/audio/voices`, {
        method: 'GET',
      });

      if (response.ok) {
        return { status: 'online' };
      } else {
        return { status: 'offline', error: `Server returned ${response.status}` };
      }
    } catch (error) {
      return { 
        status: 'offline', 
        error: error instanceof Error ? error.message : 'Connection failed' 
      };
    }
  }
}

// ============================================
// Helper Functions
// ============================================

function extractLanguage(voiceId: string): string | undefined {
  // Extract language from voice path like "voices/chatterbox/es-rick.wav"
  const match = voiceId.match(/\/([a-z]{2})-/);
  return match ? match[1] : undefined;
}

// ============================================
// Export Singleton
// ============================================

export const ttsService = new TTSService();
export { TTSService };
