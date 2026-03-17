// ============================================
// Character Voice Panel - Dual Voice Configuration
// Configures dialogue voice and narrator voice separately
// ============================================

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Volume2,
  Mic,
  RefreshCw,
  HelpCircle,
  MessageSquare,
  BookOpen,
  Settings,
  Check,
  Loader2,
  AlertCircle,
  Ear,
  Plus,
  X,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { 
  CharacterVoiceSettings, 
  CharacterVoiceConfig, 
  VoiceInfo,
  TTSWebUIConfig,
  WakeWordConfig,
} from '@/types';
import { 
  DEFAULT_CHARACTER_VOICE_SETTINGS, 
  DEFAULT_VOICE_CONFIG,
  DEFAULT_WAKE_WORD_CONFIG,
} from '@/types';

// Supported languages for multilingual model
const SUPPORTED_LANGUAGES = [
  { code: 'es', name: 'Español' },
  { code: 'en', name: 'English' },
  { code: 'ja', name: 'Japanese' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ko', name: 'Korean' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
];

interface CharacterVoicePanelProps {
  voiceSettings: CharacterVoiceSettings | null;
  onChange: (settings: CharacterVoiceSettings) => void;
  globalConfig?: TTSWebUIConfig | null;
  wakeWordConfig?: WakeWordConfig | null;
  onWakeWordChange?: (config: WakeWordConfig) => void;
  characterName?: string;
}

export function CharacterVoicePanel({ 
  voiceSettings, 
  onChange,
  globalConfig,
  wakeWordConfig,
  onWakeWordChange,
  characterName = 'Personaje',
}: CharacterVoicePanelProps) {
  const [availableVoices, setAvailableVoices] = useState<VoiceInfo[]>([]);
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const [activeSection, setActiveSection] = useState<'dialogue' | 'narrator'>('dialogue');

  // Initialize settings if null, ensuring all nested objects exist
  const settings: CharacterVoiceSettings = {
    ...DEFAULT_CHARACTER_VOICE_SETTINGS,
    ...voiceSettings,
    dialogueVoice: {
      ...DEFAULT_VOICE_CONFIG,
      ...voiceSettings?.dialogueVoice,
    },
    narratorVoice: {
      ...DEFAULT_VOICE_CONFIG,
      ...voiceSettings?.narratorVoice,
    },
  };

  // Load voices from TTS-WebUI
  const loadVoices = useCallback(async () => {
    const baseUrl = globalConfig?.baseUrl || 'http://localhost:7778';
    setIsLoadingVoices(true);

    try {
      const response = await fetch(`${baseUrl}/v1/audio/voices`);
      if (response.ok) {
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
        
        setAvailableVoices(voices);
      }
    } catch (error) {
      console.error('[TTS] Failed to load voices:', error);
    } finally {
      setIsLoadingVoices(false);
    }
  }, [globalConfig?.baseUrl]);

  // Load voices on mount
  useEffect(() => {
    loadVoices();
  }, [loadVoices]);

  // Update settings helper
  const updateSettings = (updates: Partial<CharacterVoiceSettings>) => {
    onChange({ ...settings, ...updates });
  };

  // Update voice config helper
  const updateVoiceConfig = (
    type: 'dialogueVoice' | 'narratorVoice',
    updates: Partial<CharacterVoiceConfig>
  ) => {
    onChange({
      ...settings,
      [type]: {
        ...settings[type],
        ...updates,
      },
    });
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Voice Toggle */}
        <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/40">
          <div className="flex items-center gap-2">
            <Mic className="w-4 h-4 text-pink-500" />
            <span className="text-sm font-medium">Activar Voz para este Personaje</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>Cuando está activado, las respuestas del personaje se reproducirán como audio.</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <Switch
            checked={settings.enabled}
            onCheckedChange={(checked) => updateSettings({ enabled: checked })}
          />
        </div>

        {settings.enabled && (
          <>
            {/* Text Generation Options */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Qué Generar
                </CardTitle>
                <CardDescription>
                  Selecciona qué tipos de texto convertir a voz
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-blue-500" />
                    <Label className="text-xs">Diálogos ("texto entre comillas")</Label>
                  </div>
                  <Switch
                    checked={settings.generateDialogues ?? true}
                    onCheckedChange={(checked) => updateSettings({ generateDialogues: checked })}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-purple-500" />
                    <Label className="text-xs">Narración (*texto entre asteriscos*)</Label>
                  </div>
                  <Switch
                    checked={settings.generateNarrations ?? true}
                    onCheckedChange={(checked) => updateSettings({ generateNarrations: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-orange-500" />
                    <Label className="text-xs">Texto plano (sin formato)</Label>
                  </div>
                  <Switch
                    checked={settings.generatePlainText ?? true}
                    onCheckedChange={(checked) => updateSettings({ generatePlainText: checked })}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Dual Voice Configuration */}
            <div className="grid grid-cols-2 gap-3">
              {/* Dialogue Voice */}
              <Card className={cn(
                "cursor-pointer transition-all",
                activeSection === 'dialogue' && "ring-2 ring-pink-500/50"
              )}>
                <CardHeader 
                  className="pb-2 cursor-pointer"
                  onClick={() => setActiveSection('dialogue')}
                >
                  <CardTitle className="text-sm flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-blue-500" />
                    Voz de Diálogo
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Texto entre "comillas"
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <VoiceConfigEditor
                    config={settings.dialogueVoice}
                    onChange={(updates) => updateVoiceConfig('dialogueVoice', updates)}
                    voices={availableVoices}
                    isLoadingVoices={isLoadingVoices}
                    onRefreshVoices={loadVoices}
                    globalLanguage={globalConfig?.language}
                  />
                </CardContent>
              </Card>

              {/* Narrator Voice */}
              <Card className={cn(
                "cursor-pointer transition-all",
                activeSection === 'narrator' && "ring-2 ring-purple-500/50"
              )}>
                <CardHeader 
                  className="pb-2 cursor-pointer"
                  onClick={() => setActiveSection('narrator')}
                >
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-purple-500" />
                    Voz del Narrador
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Texto entre *asteriscos*
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <VoiceConfigEditor
                    config={settings.narratorVoice}
                    onChange={(updates) => updateVoiceConfig('narratorVoice', updates)}
                    voices={availableVoices}
                    isLoadingVoices={isLoadingVoices}
                    onRefreshVoices={loadVoices}
                    globalLanguage={globalConfig?.language}
                  />
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* Wake Word Configuration */}
        <WakeWordConfigSection
          config={wakeWordConfig}
          onChange={onWakeWordChange}
          characterName={characterName}
        />

        {!settings.enabled && (
          <div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-lg border border-border/40">
            <Mic className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium">Voz desactivada</p>
            <p className="text-xs mt-1">Activa el sistema para configurar texto-a-voz.</p>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

// ============================================
// Voice Config Editor Component
// ============================================

interface VoiceConfigEditorProps {
  config: CharacterVoiceConfig;
  onChange: (updates: Partial<CharacterVoiceConfig>) => void;
  voices: VoiceInfo[];
  isLoadingVoices: boolean;
  onRefreshVoices: () => void;
  globalLanguage?: string;
}

function VoiceConfigEditor({
  config,
  onChange,
  voices,
  isLoadingVoices,
  onRefreshVoices,
  globalLanguage,
}: VoiceConfigEditorProps) {
  if (!config) {
    return (
      <div className="text-xs text-muted-foreground p-2">
        Configuración no disponible
      </div>
    );
  }

  const configLanguage = config.language;
  const filteredVoices = configLanguage
    ? voices.filter(v => v.language === configLanguage)
    : voices;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs">Habilitar</Label>
        <Switch
          checked={config.enabled}
          onCheckedChange={(checked) => onChange({ enabled: checked })}
        />
      </div>

      {config.enabled && (
        <>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Voz</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 text-[10px] px-1"
                onClick={onRefreshVoices}
                disabled={isLoadingVoices}
              >
                {isLoadingVoices ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <RefreshCw className="w-3 h-3" />
                )}
              </Button>
            </div>
            <Select
              value={config.voiceId || 'default'}
              onValueChange={(value) => onChange({ voiceId: value })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Seleccionar voz" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Por defecto (global)</SelectItem>
                {filteredVoices.map((voice) => (
                  <SelectItem key={voice.id} value={voice.id}>
                    {voice.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Idioma</Label>
            <Select
              value={config.language || globalLanguage || 'es'}
              onValueChange={(value) => onChange({ language: value })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between">
              <Label className="text-xs">Exageración</Label>
              <span className="text-[10px] text-muted-foreground">
                {config.exaggeration?.toFixed(2) || '0.50'}
              </span>
            </div>
            <Slider
              value={[config.exaggeration ?? 0.5]}
              min={0}
              max={1}
              step={0.05}
              onValueChange={([value]) => onChange({ exaggeration: value })}
              className="py-1"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between">
              <Label className="text-xs">Velocidad</Label>
              <span className="text-[10px] text-muted-foreground">
                {config.speed?.toFixed(1) || '1.0'}x
              </span>
            </div>
            <Slider
              value={[config.speed ?? 1.0]}
              min={0.5}
              max={2}
              step={0.1}
              onValueChange={([value]) => onChange({ speed: value })}
              className="py-1"
            />
          </div>
        </>
      )}
    </div>
  );
}

// ============================================
// Wake Word Configuration Section
// ============================================

interface WakeWordConfigSectionProps {
  config?: WakeWordConfig | null;
  onChange?: (config: WakeWordConfig) => void;
  characterName: string;
}

// Hook to check if SpeechRecognition is supported (client-side only)
function useSpeechRecognitionSupport() {
  return useMemo(() => {
    if (typeof window === 'undefined') return false;
    return !!(window.SpeechRecognition || (window as any).webkitSpeechRecognition);
  }, []);
}

function WakeWordConfigSection({ 
  config, 
  onChange,
  characterName 
}: WakeWordConfigSectionProps) {
  const [newWakeWord, setNewWakeWord] = useState('');
  const isSupported = useSpeechRecognitionSupport();

  const wakeConfig: WakeWordConfig = {
    ...DEFAULT_WAKE_WORD_CONFIG,
    ...config,
  };

  const updateConfig = (updates: Partial<WakeWordConfig>) => {
    onChange?.({ ...wakeConfig, ...updates });
  };

  const addWakeWord = () => {
    const word = newWakeWord.trim().toLowerCase();
    if (!word || wakeConfig.wakeWords.includes(word)) {
      setNewWakeWord('');
      return;
    }
    updateConfig({ wakeWords: [...wakeConfig.wakeWords, word] });
    setNewWakeWord('');
  };

  const removeWakeWord = (word: string) => {
    updateConfig({ wakeWords: wakeConfig.wakeWords.filter(w => w !== word) });
  };

  const suggestedWakeWords = [
    characterName.toLowerCase(),
    `hey ${characterName.toLowerCase()}`,
    `oye ${characterName.toLowerCase()}`,
  ].filter(w => !wakeConfig.wakeWords.includes(w));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Ear className="w-4 h-4 text-green-500" />
          Activación por Voz
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>
                Activa la escucha continua. Cuando digas una de las palabras configuradas, 
                la grabación comenzará automáticamente.
              </p>
            </TooltipContent>
          </Tooltip>
        </CardTitle>
        <CardDescription>
          Di el nombre del personaje para activar la grabación
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!isSupported && (
          <div className="text-xs bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 p-2 rounded border border-yellow-500/20">
            Tu navegador no soporta Speech Recognition. Usa Chrome o Edge.
          </div>
        )}

        <div className="flex items-center justify-between">
          <Label className="text-xs">Activar detección</Label>
          <Switch
            checked={wakeConfig.enabled}
            onCheckedChange={(checked) => updateConfig({ enabled: checked })}
            disabled={!isSupported}
          />
        </div>

        {wakeConfig.enabled && isSupported && (
          <>
            <div className="space-y-2">
              <Label className="text-xs">Palabras de Activación</Label>
              
              <div className="flex flex-wrap gap-1">
                {wakeConfig.wakeWords.map((word) => (
                  <div
                    key={word}
                    className="flex items-center gap-1 bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs"
                  >
                    <span>{word}</span>
                    <button
                      onClick={() => removeWakeWord(word)}
                      className="hover:bg-primary/20 rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {wakeConfig.wakeWords.length === 0 && (
                  <span className="text-xs text-muted-foreground">
                    Sin palabras configuradas
                  </span>
                )}
              </div>

              <div className="flex gap-1">
                <Input
                  value={newWakeWord}
                  onChange={(e) => setNewWakeWord(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addWakeWord()}
                  placeholder="Nueva palabra..."
                  className="h-7 text-xs flex-1"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={addWakeWord}
                  disabled={!newWakeWord.trim()}
                  className="h-7 px-2"
                >
                  <Plus className="w-3 h-3" />
                </Button>
              </div>

              {suggestedWakeWords.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground">Sugerencias:</p>
                  <div className="flex flex-wrap gap-1">
                    {suggestedWakeWords.slice(0, 3).map((word) => (
                      <button
                        key={word}
                        onClick={() => updateConfig({ wakeWords: [...wakeConfig.wakeWords, word] })}
                        className="flex items-center gap-1 bg-muted hover:bg-muted/80 px-2 py-0.5 rounded text-xs transition-colors"
                      >
                        <Sparkles className="w-2 h-2" />
                        {word}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Idioma de Reconocimiento</Label>
              <Select
                value={wakeConfig.language || 'es-ES'}
                onValueChange={(value) => updateConfig({ language: value })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="es-ES">Español (España)</SelectItem>
                  <SelectItem value="es-MX">Español (México)</SelectItem>
                  <SelectItem value="en-US">English (US)</SelectItem>
                  <SelectItem value="en-GB">English (UK)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="text-xs bg-muted/50 p-2 rounded border">
              <p className="font-medium text-muted-foreground mb-1">Cómo funciona:</p>
              <ol className="text-[10px] text-muted-foreground space-y-0.5 list-decimal list-inside">
                <li>El navegador escucha continuamente en segundo plano</li>
                <li>Cuando detecta "{wakeConfig.wakeWords[0] || 'la palabra'}", inicia la grabación</li>
                <li>La grabación se detiene automáticamente al detectar silencio</li>
                <li>El audio se envía a Whisper para transcripción</li>
              </ol>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// Helper Functions
// ============================================

function extractLanguage(voiceId: string): string | undefined {
  const match = voiceId.match(/\/([a-z]{2})-/);
  return match ? match[1] : undefined;
}
