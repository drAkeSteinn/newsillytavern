'use client';

import { useTavernStore } from '@/store/tavern-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Settings, 
  Bot, 
  Palette, 
  Volume2, 
  Keyboard,
  Database,
  Plus,
  Check,
  Trash2,
  ExternalLink,
  Music,
  Image as ImageIcon,
  MessageSquare,
  GripVertical,
  User,
  BookOpen,
  Download,
  Upload,
  Layers,
  Cloud,
  Brain,
  Target,
  Package,
  FileJson,
  Settings2,
  AlertCircle,
  CheckCircle,
  Info,
  HelpCircle,
  Cpu,
  Sliders,
  Zap,
  Sparkles
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { LLMProvider, AppSettings } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { SoundTriggersSettings } from './sound-triggers-settings';
import { BackgroundTriggersSettings } from './background-triggers-settings';
import { PersonaPanel } from './persona-panel';
import { LorebookPanel } from './lorebook-panel';
import { HUDManager } from '@/components/settings/hud-manager';
import { AtmosphereSettings } from '@/components/atmosphere';
import { MemorySettingsPanel } from '@/components/memory';
import { QuestSettingsPanel } from '@/components/quests';
import { DialogueSettingsPanel } from '@/components/dialogue';
import { InventoryPanel } from '@/components/inventory';

const LLM_PROVIDERS: { value: LLMProvider; label: string; defaultEndpoint: string; needsEndpoint: boolean; description: string }[] = [
  { value: 'z-ai', label: 'Z.ai Chat', defaultEndpoint: '', needsEndpoint: false, description: 'SDK integrado, sin configuración' },
  { value: 'text-generation-webui', label: 'Text Generation WebUI', defaultEndpoint: 'http://localhost:5000', needsEndpoint: true, description: 'API en puerto 5000 (iniciar con --api)' },
  { value: 'ollama', label: 'Ollama', defaultEndpoint: 'http://localhost:11434', needsEndpoint: true, description: 'Servidor Ollama local' },
  { value: 'koboldcpp', label: 'KoboldCPP', defaultEndpoint: 'http://localhost:5001', needsEndpoint: true, description: 'Servidor KoboldCPP' },
  { value: 'vllm', label: 'vLLM', defaultEndpoint: 'http://localhost:8000', needsEndpoint: true, description: 'Servidor vLLM' },
  { value: 'openai', label: 'OpenAI', defaultEndpoint: 'https://api.openai.com/v1', needsEndpoint: true, description: 'API de OpenAI' },
  { value: 'anthropic', label: 'Anthropic', defaultEndpoint: 'https://api.anthropic.com/v1', needsEndpoint: true, description: 'API de Anthropic' },
  { value: 'custom', label: 'Personalizado', defaultEndpoint: '', needsEndpoint: true, description: 'Endpoint personalizado OpenAI-compatible' }
];

interface SettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: string;
}

export function SettingsPanel({ open, onOpenChange, initialTab = 'llm' }: SettingsPanelProps) {
  const { toast } = useToast();
  const store = useTavernStore();
  const { 
    settings, 
    updateSettings, 
    llmConfigs, 
    addLLMConfig, 
    updateLLMConfig, 
    setActiveLLMConfig,
    deleteLLMConfig 
  } = store;

  const [newConfigOpen, setNewConfigOpen] = useState(false);
  const [recordingHotkey, setRecordingHotkey] = useState<string | null>(null);
  const hotkeyContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newConfig, setNewConfig] = useState({
    name: '',
    provider: 'z-ai' as LLMProvider,
    endpoint: '',
    apiKey: ''
  });

  // Export all configuration (without characters/sessions)
  const handleExportConfig = () => {
    try {
      const configData = {
        version: '2.0',
        exportedAt: new Date().toISOString(),
        type: 'config',
        data: {
          // Settings
          settings: store.settings,
          // LLM & TTS
          llmConfigs: store.llmConfigs,
          ttsConfigs: store.ttsConfigs,
          promptTemplates: store.promptTemplates,
          // Personas
          personas: store.personas,
          // Lorebooks
          lorebooks: store.lorebooks,
          activeLorebookIds: store.activeLorebookIds,
          // Sound system
          soundTriggers: store.soundTriggers,
          soundCollections: store.soundCollections,
          soundSequenceTriggers: store.soundSequenceTriggers,
          // Visual systems - Backgrounds
          backgrounds: store.backgrounds,
          backgroundPacks: store.backgroundPacks,
          backgroundIndex: store.backgroundIndex,
          backgroundTriggerPacks: store.backgroundTriggerPacks,
          backgroundCollections: store.backgroundCollections,
          // Visual systems - Sprites
          spritePacks: store.spritePacks,
          spriteIndex: store.spriteIndex,
          spriteLibraries: store.spriteLibraries,
          spritePacksV2: store.spritePacksV2,
          // HUD
          hudTemplates: store.hudTemplates,
          // Atmosphere
          atmosphereSettings: store.atmosphereSettings,
          activeAtmospherePresetId: store.activeAtmospherePresetId,
          // Memory
          summarySettings: store.summarySettings,
          characterMemories: store.characterMemories,
          sessionTracking: store.sessionTracking,
          // Quest
          questSettings: store.questSettings,
          questNotifications: store.questNotifications,
          // Dialogue
          dialogueSettings: store.dialogueSettings,
          // Inventory
          inventorySettings: store.inventorySettings,
          inventoryNotifications: store.inventoryNotifications,
        }
      };

      const blob = new Blob([JSON.stringify(configData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tavernflow-config-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Configuración exportada',
        description: 'El archivo de configuración se ha descargado correctamente.',
      });
    } catch (error) {
      toast({
        title: 'Error al exportar',
        description: 'No se pudo exportar la configuración.',
        variant: 'destructive',
      });
    }
  };

  // Import configuration
  const handleImportConfig = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const imported = JSON.parse(content);

        // Validate structure
        if (!imported.data) {
          throw new Error('Invalid config file structure');
        }

        const { data } = imported;
        const updates: Record<string, unknown> = {};

        // Config data keys (same as in export)
        const configKeys = [
          'settings', 'llmConfigs', 'ttsConfigs', 'promptTemplates',
          'personas', 'lorebooks', 'activeLorebookIds',
          'soundTriggers', 'soundCollections', 'soundSequenceTriggers',
          'backgrounds', 'backgroundPacks', 'backgroundIndex', 'backgroundTriggerPacks', 'backgroundCollections',
          'spritePacks', 'spriteIndex', 'spriteLibraries', 'spritePacksV2',
          'hudTemplates',
          'atmosphereSettings', 'activeAtmospherePresetId',
          'summarySettings', 'characterMemories', 'sessionTracking',
          'questSettings', 'questNotifications',
          'dialogueSettings',
          'inventorySettings', 'inventoryNotifications'
        ];

        configKeys.forEach(key => {
          if (data[key] !== undefined) {
            updates[key] = data[key];
          }
        });

        if (Object.keys(updates).length > 0) {
          useTavernStore.setState(updates);
        }

        toast({
          title: 'Configuración importada',
          description: `${Object.keys(updates).length} secciones de configuración importadas correctamente.`,
        });
      } catch (error) {
        toast({
          title: 'Error al importar',
          description: 'El archivo no tiene un formato válido.',
          variant: 'destructive',
        });
      }
    };
    reader.readAsText(file);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Export everything (config + characters + sessions + groups)
  const handleExportAll = () => {
    try {
      const allData = {
        version: '2.0',
        exportedAt: new Date().toISOString(),
        type: 'full',
        data: {
          // Configuration
          settings: store.settings,
          llmConfigs: store.llmConfigs,
          ttsConfigs: store.ttsConfigs,
          promptTemplates: store.promptTemplates,
          personas: store.personas,
          // Lorebooks
          lorebooks: store.lorebooks,
          activeLorebookIds: store.activeLorebookIds,
          // Sound system
          soundTriggers: store.soundTriggers,
          soundCollections: store.soundCollections,
          soundSequenceTriggers: store.soundSequenceTriggers,
          // Visual systems - Backgrounds
          backgrounds: store.backgrounds,
          backgroundPacks: store.backgroundPacks,
          backgroundIndex: store.backgroundIndex,
          backgroundTriggerPacks: store.backgroundTriggerPacks,
          backgroundCollections: store.backgroundCollections,
          // Visual systems - Sprites
          spritePacks: store.spritePacks,
          spriteIndex: store.spriteIndex,
          spriteLibraries: store.spriteLibraries,
          spritePacksV2: store.spritePacksV2,
          // HUD
          hudTemplates: store.hudTemplates,
          // Atmosphere
          atmosphereSettings: store.atmosphereSettings,
          activeAtmospherePresetId: store.activeAtmospherePresetId,
          // Memory
          summarySettings: store.summarySettings,
          summaries: store.summaries,
          characterMemories: store.characterMemories,
          sessionTracking: store.sessionTracking,
          // Quest
          questSettings: store.questSettings,
          quests: store.quests,
          questNotifications: store.questNotifications,
          // Dialogue
          dialogueSettings: store.dialogueSettings,
          // Inventory
          inventorySettings: store.inventorySettings,
          items: store.items,
          containers: store.containers,
          currencies: store.currencies,
          inventoryNotifications: store.inventoryNotifications,
          // Data
          characters: store.characters,
          sessions: store.sessions,
          groups: store.groups,
          // Active states
          activeSessionId: store.activeSessionId,
          activeCharacterId: store.activeCharacterId,
          activeGroupId: store.activeGroupId,
          activeBackground: store.activeBackground,
          activeOverlayBack: store.activeOverlayBack,
          activeOverlayFront: store.activeOverlayFront,
          activePersonaId: store.activePersonaId,
        }
      };

      const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tavernflow-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Backup completo exportado',
        description: 'Todos los datos se han exportado correctamente.',
      });
    } catch (error) {
      toast({
        title: 'Error al exportar',
        description: 'No se pudo crear el backup.',
        variant: 'destructive',
      });
    }
  };

  // Import everything
  const handleImportAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const imported = JSON.parse(content);

        if (!imported.data) {
          throw new Error('Invalid backup file structure');
        }

        const { data } = imported;
        const updates: Record<string, unknown> = {};

        // All data keys (same as in export)
        const allDataKeys = [
          // Config
          'settings', 'llmConfigs', 'ttsConfigs', 'promptTemplates',
          'personas', 'lorebooks', 'activeLorebookIds',
          'soundTriggers', 'soundCollections', 'soundSequenceTriggers',
          'backgrounds', 'backgroundPacks', 'backgroundIndex', 'backgroundTriggerPacks', 'backgroundCollections',
          'spritePacks', 'spriteIndex', 'spriteLibraries', 'spritePacksV2',
          'hudTemplates',
          'atmosphereSettings', 'activeAtmospherePresetId',
          'summarySettings', 'summaries', 'characterMemories', 'sessionTracking',
          'questSettings', 'quests', 'questNotifications',
          'dialogueSettings',
          'inventorySettings', 'items', 'containers', 'currencies', 'inventoryNotifications',
          // Data
          'characters', 'sessions', 'groups',
          // Active states
          'activeSessionId', 'activeCharacterId', 'activeGroupId',
          'activeBackground', 'activeOverlayBack', 'activeOverlayFront', 'activePersonaId'
        ];

        allDataKeys.forEach(key => {
          if (data[key] !== undefined) {
            updates[key] = data[key];
          }
        });

        if (Object.keys(updates).length > 0) {
          useTavernStore.setState(updates);
        }

        toast({
          title: 'Backup importado',
          description: `${Object.keys(updates).length} secciones importadas correctamente.`,
        });
      } catch (error) {
        toast({
          title: 'Error al importar',
          description: 'El archivo no tiene un formato válido.',
          variant: 'destructive',
        });
      }
    };
    reader.readAsText(file);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Cancel hotkey recording when clicking outside or pressing Escape
  useEffect(() => {
    if (!recordingHotkey) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (hotkeyContainerRef.current && !hotkeyContainerRef.current.contains(e.target as Node)) {
        setRecordingHotkey(null);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setRecordingHotkey(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [recordingHotkey]);

  const handleAddConfig = () => {
    addLLMConfig({
      ...newConfig,
      model: '',
      parameters: {
        temperature: 0.7,
        topP: 0.9,
        topK: 40,
        maxTokens: 512,
        contextSize: 4096,
        repetitionPenalty: 1.1,
        frequencyPenalty: 0,
        presencePenalty: 0,
        stopStrings: [],
        stream: true
      },
      isActive: false
    });
    setNewConfigOpen(false);
    setNewConfig({
      name: '',
      provider: 'z-ai',
      endpoint: '',
      apiKey: ''
    });
  };

  const handleProviderChange = (provider: LLMProvider) => {
    const providerConfig = LLM_PROVIDERS.find(p => p.value === provider);
    const defaultEndpoint = providerConfig?.defaultEndpoint || '';
    setNewConfig(prev => ({ 
      ...prev, 
      provider, 
      endpoint: defaultEndpoint,
      apiKey: provider === 'z-ai' ? '' : prev.apiKey
    }));
  };

  // Hotkey recording handler
  const handleHotkeyKeyDown = (action: string, e: React.KeyboardEvent) => {
    if (!recordingHotkey) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    // Build the hotkey string
    const parts: string[] = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.shiftKey) parts.push('Shift');
    if (e.altKey) parts.push('Alt');
    if (e.metaKey) parts.push('Meta');
    
    // Add the main key (but not modifier keys themselves)
    const key = e.key;
    if (!['Control', 'Shift', 'Alt', 'Meta'].includes(key)) {
      parts.push(key);
    }
    
    if (parts.length > 0 && !['Control', 'Shift', 'Alt', 'Meta'].includes(key)) {
      const hotkeyString = parts.join('+');
      updateSettings({
        hotkeys: {
          ...settings.hotkeys,
          [action]: hotkeyString
        }
      });
      setRecordingHotkey(null);
    }
  };

  // Format hotkey for display
  const formatHotkeyDisplay = (hotkey: string) => {
    return hotkey
      .replace(/\+/g, ' + ')
      .replace(/Arrow/g, '')
      .replace(/Enter/g, '↵')
      .replace(/Shift/g, '⇧')
      .replace(/Ctrl/g, '⌃')
      .replace(/Alt/g, '⌥');
  };

  // Hotkey action labels
  const hotkeyLabels: Record<string, { label: string; description: string }> = {
    send: { label: 'Enviar mensaje', description: 'Envía el mensaje actual' },
    newLine: { label: 'Nueva línea', description: 'Inserta una nueva línea' },
    regenerate: { label: 'Regenerar', description: 'Regenera la última respuesta' },
    swipeLeft: { label: 'Deslizar izquierda', description: 'Ver respuesta alternativa anterior' },
    swipeRight: { label: 'Deslizar derecha', description: 'Ver siguiente respuesta alternativa' }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="w-[95vw] max-w-[1400px] min-w-[900px] h-[90vh] min-h-[600px] p-0 gap-0 flex flex-col overflow-hidden"
        showCloseButton={true}
      >
        <DialogHeader className="p-4 border-b flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Configuración
          </DialogTitle>
        </DialogHeader>

        <Tabs key={initialTab} defaultValue={initialTab} className="flex-1 flex flex-col overflow-hidden min-h-0">
          <div className="border-b px-4 flex-shrink-0 bg-muted/30">
            <TabsList className="h-11 flex-wrap gap-1">
              <TabsTrigger value="llm" className="gap-1.5 text-xs">
                <Bot className="w-4 h-4" />
                LLM
              </TabsTrigger>
              <TabsTrigger value="persona" className="gap-1.5 text-xs">
                <User className="w-4 h-4" />
                Persona
              </TabsTrigger>
              <TabsTrigger value="lorebooks" className="gap-1.5 text-xs">
                <BookOpen className="w-4 h-4" />
                Lorebooks
              </TabsTrigger>
              <TabsTrigger value="appearance" className="gap-1.5 text-xs">
                <Palette className="w-4 h-4" />
                Apariencia
              </TabsTrigger>
              <TabsTrigger value="sounds" className="gap-1.5 text-xs">
                <Music className="w-4 h-4" />
                Sonidos
              </TabsTrigger>
              <TabsTrigger value="backgrounds" className="gap-1.5 text-xs">
                <ImageIcon className="w-4 h-4" />
                Fondos
              </TabsTrigger>
              <TabsTrigger value="voice" className="gap-1.5 text-xs">
                <Volume2 className="w-4 h-4" />
                Voz
              </TabsTrigger>
              <TabsTrigger value="hotkeys" className="gap-1.5 text-xs">
                <Keyboard className="w-4 h-4" />
                Atajos
              </TabsTrigger>
              <TabsTrigger value="data" className="gap-1.5 text-xs">
                <Database className="w-4 h-4" />
                Datos
              </TabsTrigger>
              <TabsTrigger value="hud" className="gap-1.5 text-xs">
                <Layers className="w-4 h-4" />
                HUD
              </TabsTrigger>
              <TabsTrigger value="atmosphere" className="gap-1.5 text-xs">
                <Cloud className="w-4 h-4" />
                Atmósfera
              </TabsTrigger>
              <TabsTrigger value="memory" className="gap-1.5 text-xs">
                <Brain className="w-4 h-4" />
                Memoria
              </TabsTrigger>
              <TabsTrigger value="quests" className="gap-1.5 text-xs">
                <Target className="w-4 h-4" />
                Misiones
              </TabsTrigger>
              <TabsTrigger value="inventory" className="gap-1.5 text-xs">
                <Package className="w-4 h-4" />
                Inventario
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Content container with proper height */}
          <div className="flex-1 overflow-hidden">
            {/* LLM Settings */}
            <TabsContent value="llm" className="h-full overflow-y-auto p-6 m-0 data-[state=inactive]:hidden">
              <TooltipProvider>
              <div className="space-y-4">
                {/* Info Banner */}
                <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-lg p-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <Bot className="w-5 h-5 text-blue-500" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-blue-600 dark:text-blue-400">Configuración de LLM</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Gestiona tus conexiones a modelos de lenguaje. Soporta proveedores locales como <strong>Ollama</strong>, <strong>KoboldCPP</strong> y APIs remotas.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-[1fr_1fr] gap-6">
                  {/* Left: LLM Connections List */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                      <Cpu className="w-4 h-4" />
                      <span className="font-medium">Conexiones LLM</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="w-3.5 h-3.5 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>Las conexiones LLM definen cómo TavernFlow se comunica con los modelos de lenguaje.</p>
                        </TooltipContent>
                      </Tooltip>
                      <Button size="sm" className="ml-auto h-6 text-xs" onClick={() => setNewConfigOpen(true)}>
                        <Plus className="w-3 h-3 mr-1" />
                        Agregar
                      </Button>
                    </div>

                  <div className="p-3 bg-muted/30 rounded-lg border border-border/40 space-y-3">
                    {llmConfigs.map((config) => (
                      <div 
                        key={config.id} 
                        className={cn(
                          'p-3 rounded-lg border transition-colors cursor-pointer',
                          config.isActive ? 'border-primary bg-primary/5' : 'border-border/40 hover:bg-muted/50'
                        )}
                        onClick={() => !config.isActive && setActiveLLMConfig(config.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              'w-2.5 h-2.5 rounded-full',
                              config.isActive ? 'bg-green-500' : 'bg-muted-foreground'
                            )} />
                            <div>
                              <p className="font-medium text-sm">{config.name}</p>
                              <p className="text-xs text-muted-foreground">{config.provider}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {!config.isActive && (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                className="h-7 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveLLMConfig(config.id);
                                }}
                              >
                                <Check className="w-3 h-3 mr-1" />
                                Activar
                              </Button>
                            )}
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="h-7 w-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteLLMConfig(config.id);
                              }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                        {config.endpoint && config.provider !== 'z-ai' && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1 ml-5">
                            <ExternalLink className="w-3 h-3" />
                            {config.endpoint}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: Active Config Parameters */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    <Sliders className="w-4 h-4" />
                    <span className="font-medium">Parámetros</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="w-3.5 h-3.5 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Ajusta los parámetros de generación como temperatura, top-p, y límites de tokens.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  {llmConfigs.find(c => c.isActive) ? (
                    (() => {
                      const config = llmConfigs.find(c => c.isActive)!;
                      const providerInfo = LLM_PROVIDERS.find(p => p.value === config.provider);
                      return (
                        <div className="p-3 bg-muted/30 rounded-lg border border-border/40 space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{config.name}</span>
                            <span className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary">
                              {providerInfo?.label || config.provider}
                            </span>
                          </div>
                          
                          {/* Connection Settings - Show endpoint/model/apiKey */}
                          <div className="space-y-3 p-3 rounded-lg border border-border/40 bg-background/50">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Zap className="w-3.5 h-3.5" />
                              <span className="font-medium">Configuración de Conexión</span>
                            </div>
                            
                            {/* Endpoint field - for providers that need it */}
                            {providerInfo?.needsEndpoint && (
                              <div>
                                <Label className="text-xs">URL del Endpoint</Label>
                                <Input
                                  value={config.endpoint || ''}
                                  onChange={(e) => 
                                    updateLLMConfig(config.id, { endpoint: e.target.value })
                                  }
                                  placeholder={providerInfo.defaultEndpoint}
                                  className="mt-1 h-8 text-sm"
                                />
                              </div>
                            )}
                            
                            {/* Model field - for providers that need model selection */}
                            {config.provider !== 'z-ai' && (
                              <div>
                                <Label className="text-xs">Modelo (opcional)</Label>
                                <Input
                                  value={config.model || ''}
                                  onChange={(e) => 
                                    updateLLMConfig(config.id, { model: e.target.value })
                                  }
                                  placeholder={config.provider === 'openai' ? 'gpt-4o-mini' : config.provider === 'anthropic' ? 'claude-3-sonnet' : ''}
                                  className="mt-1 h-8 text-sm"
                                />
                              </div>
                            )}
                            
                            {/* API Key field - for providers that need it */}
                            {config.provider !== 'z-ai' && (
                              <div>
                                <Label className="text-xs">API Key {config.provider === 'openai' || config.provider === 'anthropic' ? '(requerido)' : '(opcional)'}</Label>
                                <Input
                                  type="password"
                                  value={config.apiKey || ''}
                                  onChange={(e) => 
                                    updateLLMConfig(config.id, { apiKey: e.target.value })
                                  }
                                  placeholder="sk-..."
                                  className="mt-1 h-8 text-sm"
                                />
                              </div>
                            )}
                            
                            {/* Z.ai info */}
                            {config.provider === 'z-ai' && (
                              <div className="p-2 bg-green-500/10 rounded text-xs text-green-600 dark:text-green-400">
                                ✓ Z.ai usa el SDK integrado. No requiere configuración adicional.
                              </div>
                            )}
                          </div>
                          
                          {/* Sliders in 2 columns */}
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span>Temperatura</span>
                                <span className="text-muted-foreground">{config.parameters.temperature}</span>
                              </div>
                              <Slider
                                value={[config.parameters.temperature]}
                                min={0}
                                max={2}
                                step={0.1}
                                onValueChange={([value]) => 
                                  updateLLMConfig(config.id, {
                                    parameters: { ...config.parameters, temperature: value }
                                  })
                                }
                              />
                            </div>

                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span>Top P</span>
                                <span className="text-muted-foreground">{config.parameters.topP}</span>
                              </div>
                              <Slider
                                value={[config.parameters.topP]}
                                min={0}
                                max={1}
                                step={0.05}
                                onValueChange={([value]) => 
                                  updateLLMConfig(config.id, {
                                    parameters: { ...config.parameters, topP: value }
                                  })
                                }
                              />
                            </div>

                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span>Top K</span>
                                <span className="text-muted-foreground">{config.parameters.topK}</span>
                              </div>
                              <Slider
                                value={[config.parameters.topK]}
                                min={1}
                                max={100}
                                step={1}
                                onValueChange={([value]) => 
                                  updateLLMConfig(config.id, {
                                    parameters: { ...config.parameters, topK: value }
                                  })
                                }
                              />
                            </div>

                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span>Penalización de Repetición</span>
                                <span className="text-muted-foreground">{config.parameters.repetitionPenalty}</span>
                              </div>
                              <Slider
                                value={[config.parameters.repetitionPenalty]}
                                min={1}
                                max={2}
                                step={0.05}
                                onValueChange={([value]) => 
                                  updateLLMConfig(config.id, {
                                    parameters: { ...config.parameters, repetitionPenalty: value }
                                  })
                                }
                              />
                            </div>
                          </div>

                          {/* Number inputs in 4 columns */}
                          <div className="grid grid-cols-4 gap-3">
                            <div>
                              <Label className="text-xs">Tokens Máx.</Label>
                              <Input
                                type="number"
                                value={config.parameters.maxTokens}
                                onChange={(e) => 
                                  updateLLMConfig(config.id, {
                                    parameters: { ...config.parameters, maxTokens: parseInt(e.target.value) }
                                  })
                                }
                                className="mt-1 h-8"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Contexto</Label>
                              <Input
                                type="number"
                                value={config.parameters.contextSize}
                                onChange={(e) => 
                                  updateLLMConfig(config.id, {
                                    parameters: { ...config.parameters, contextSize: parseInt(e.target.value) }
                                  })
                                }
                                className="mt-1 h-8"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Freq. Penal.</Label>
                              <Input
                                type="number"
                                step={0.1}
                                value={config.parameters.frequencyPenalty}
                                onChange={(e) => 
                                  updateLLMConfig(config.id, {
                                    parameters: { ...config.parameters, frequencyPenalty: parseFloat(e.target.value) }
                                  })
                                }
                                className="mt-1 h-8"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Pres. Penal.</Label>
                              <Input
                                type="number"
                                step={0.1}
                                value={config.parameters.presencePenalty}
                                onChange={(e) => 
                                  updateLLMConfig(config.id, {
                                    parameters: { ...config.parameters, presencePenalty: parseFloat(e.target.value) }
                                  })
                                }
                                className="mt-1 h-8"
                              />
                            </div>
                          </div>

                          {/* Toggles in row */}
                          <div className="flex items-center gap-6 pt-2">
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                              <Switch
                                checked={config.parameters.stream}
                                onCheckedChange={(checked) => 
                                  updateLLMConfig(config.id, {
                                    parameters: { ...config.parameters, stream: checked }
                                  })
                                }
                              />
                              Streaming
                            </label>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="p-3 bg-muted/30 rounded-lg border border-border/40 text-center py-8 text-muted-foreground">
                      <Bot className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Selecciona una conexión para ver sus parámetros</p>
                    </div>
                  )}
                </div>
              </div>
              </div>
              </TooltipProvider>
            </TabsContent>

            {/* Persona Settings */}
            <TabsContent value="persona" className="h-full overflow-hidden p-6 m-0 data-[state=inactive]:hidden">
              <PersonaPanel />
            </TabsContent>

            {/* Lorebook Settings */}
            <TabsContent value="lorebooks" className="h-full overflow-hidden p-6 m-0 data-[state=inactive]:hidden">
              <LorebookPanel />
            </TabsContent>

            {/* Appearance Settings */}
            <TabsContent value="appearance" className="h-full overflow-hidden m-0 p-0 data-[state=inactive]:hidden">
              <AppearanceSettingsContent settings={settings} updateSettings={updateSettings} />
            </TabsContent>

            {/* Sound Triggers Settings */}
            <TabsContent value="sounds" className="h-full overflow-hidden p-6 m-0 data-[state=inactive]:hidden">
              <SoundTriggersSettings />
            </TabsContent>

            {/* Background Triggers Settings */}
            <TabsContent value="backgrounds" className="h-full overflow-hidden p-6 m-0 data-[state=inactive]:hidden">
              <BackgroundTriggersSettings />
            </TabsContent>

            {/* Voice Settings */}
            <TabsContent value="voice" className="h-full overflow-y-auto p-6 m-0 data-[state=inactive]:hidden">
              <div className="space-y-4">
                {/* Banner Informativo */}
                <div className="bg-gradient-to-r from-pink-500/10 to-rose-500/10 border border-pink-500/20 rounded-lg p-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-pink-500/20 rounded-lg">
                      <Volume2 className="w-5 h-5 text-pink-500" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-pink-600">Sistema de Voz (TTS)</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        La síntesis de voz permite que el personaje hable sus mensajes.
                        Configura un proveedor TTS como ElevenLabs, Azure, o el SDK integrado.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="p-3 bg-muted/30 rounded-lg border border-border/40 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Volume2 className="w-3.5 h-3.5" />
                        <span className="font-medium">Proveedores TTS</span>
                      </div>
                      <Button size="sm" className="h-7 text-xs">
                        <Plus className="w-3 h-3 mr-1" />
                        Agregar
                      </Button>
                    </div>
                    <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                      <Volume2 className="w-10 h-10 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">Sin proveedores TTS configurados</p>
                      <p className="text-xs mt-1">Agrega un proveedor para activar la síntesis de voz</p>
                    </div>
                  </div>
                  <div className="p-3 bg-muted/30 rounded-lg border border-border/40 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span className="font-medium">Acerca de TTS</span>
                    </div>
                    <p>
                      La síntesis de voz (TTS) permite que el personaje hable sus mensajes.
                      Configura un proveedor TTS como ElevenLabs, Azure, o el SDK integrado.
                    </p>
                    <div className="mt-3 p-2 bg-pink-500/10 rounded border border-pink-500/20">
                      <p className="text-xs text-pink-600">💡 El SDK integrado de Z.ai no requiere configuración adicional.</p>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Hotkeys Settings */}
            <TabsContent value="hotkeys" className="h-full overflow-y-auto p-6 m-0 data-[state=inactive]:hidden">
              <div className="space-y-4">
                {/* Banner Informativo */}
                <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-lg p-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-amber-500/20 rounded-lg">
                      <Keyboard className="w-5 h-5 text-amber-500" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-amber-600">Atajos de Teclado</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Personaliza los atajos de teclado para acciones rápidas. 
                        Haz clic en un atajo para editarlo y presiona la nueva combinación.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6" ref={hotkeyContainerRef}>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">Atajos de Teclado</h3>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => updateSettings({
                        hotkeys: {
                          send: 'Enter',
                          newLine: 'Shift+Enter',
                          regenerate: 'Ctrl+R',
                          swipeLeft: 'ArrowLeft',
                          swipeRight: 'ArrowRight'
                        }
                      })}
                    >
                      Restablecer
                    </Button>
                  </div>
                  
                  <div className="space-y-2">
                    {Object.entries(settings.hotkeys).map(([action, key]) => {
                      const info = hotkeyLabels[action] || { label: action, description: '' };
                      const isRecording = recordingHotkey === action;
                      
                      return (
                        <div 
                          key={action} 
                          className={cn(
                            "flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer",
                            isRecording && "border-primary bg-primary/5 ring-2 ring-primary/20"
                          )}
                          onClick={() => setRecordingHotkey(action)}
                          onKeyDown={(e) => handleHotkeyKeyDown(action, e)}
                          tabIndex={0}
                          role="button"
                        >
                          <div>
                            <Label className="text-sm">{info.label}</Label>
                            {info.description && (
                              <p className="text-xs text-muted-foreground">{info.description}</p>
                            )}
                          </div>
                          <kbd 
                            className={cn(
                              "px-3 py-1.5 rounded text-xs font-mono min-w-[80px] text-center transition-colors",
                              isRecording 
                                ? "bg-primary text-primary-foreground animate-pulse" 
                                : "bg-muted"
                            )}
                          >
                            {isRecording ? 'Presiona tecla...' : formatHotkeyDisplay(key)}
                          </kbd>
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                <div className="p-4 rounded-lg border bg-muted/30 text-sm space-y-3">
                  <h4 className="font-medium text-foreground">Cómo usar los atajos</h4>
                  <ul className="space-y-2 text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>Haz clic en un atajo para editarlo y presiona la nueva combinación de teclas.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span><strong>Enviar:</strong> Envía el mensaje cuando estás en el campo de texto.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span><strong>Nueva línea:</strong> Inserta un salto de línea en el mensaje.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span><strong>Regenerar:</strong> Vuelve a generar la última respuesta del personaje.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span><strong>Deslizar:</strong> Navega entre respuestas alternativas (cuando están disponibles).</span>
                    </li>
                  </ul>
                  
                  <div className="pt-2 border-t mt-4">
                    <p className="text-xs text-muted-foreground">
                      Tip: Puedes usar combinaciones como Ctrl+Enter, Shift+R, o teclas de flecha.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

            {/* Data Settings */}
            <TabsContent value="data" className="h-full overflow-y-auto p-6 m-0 data-[state=inactive]:hidden">
              {/* Hidden file inputs */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImportConfig}
                className="hidden"
                id="import-config-input"
              />
              <input
                type="file"
                accept=".json"
                onChange={handleImportAll}
                className="hidden"
                id="import-all-input"
              />
              
              <div className="space-y-6">
                {/* Settings Toggles */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="font-medium">Preferencias de Datos</h3>
                    
                    <label className="flex items-center justify-between p-4 rounded-lg border cursor-pointer hover:bg-muted/50">
                      <div>
                        <Label className="font-medium">Auto-guardado</Label>
                        <p className="text-xs text-muted-foreground">Guardar cambios automáticamente</p>
                      </div>
                      <Switch
                        checked={settings.autoSave}
                        onCheckedChange={(autoSave) => updateSettings({ autoSave })}
                      />
                    </label>

                    <label className="flex items-center justify-between p-4 rounded-lg border cursor-pointer hover:bg-muted/50">
                      <div>
                        <Label className="font-medium">Confirmar Eliminación</Label>
                        <p className="text-xs text-muted-foreground">Preguntar antes de eliminar</p>
                      </div>
                      <Switch
                        checked={settings.confirmDelete}
                        onCheckedChange={(confirmDelete) => updateSettings({ confirmDelete })}
                      />
                    </label>
                  </div>

                  <div className="p-4 rounded-lg border bg-muted/30 text-sm space-y-2">
                    <h4 className="font-medium text-foreground">Almacenamiento</h4>
                    <p className="text-muted-foreground">
                      Los datos se guardan en archivos JSON locales y se sincronizan automáticamente.
                    </p>
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                      <CheckCircle className="w-4 h-4" />
                      <span>Sincronización activa</span>
                    </div>
                  </div>
                </div>

                {/* Export/Import Configuration */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Settings2 className="w-5 h-5" />
                    <h3 className="font-medium">Configuración</h3>
                    <span className="text-xs text-muted-foreground">(Sin datos de personajes/sesiones)</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <Button 
                      variant="outline" 
                      className="h-auto py-4 flex flex-col gap-2"
                      onClick={handleExportConfig}
                    >
                      <FileJson className="w-5 h-5" />
                      <span>Exportar Config</span>
                      <span className="text-xs text-muted-foreground">LLM, sonidos, fondos, etc.</span>
                    </Button>
                    <label className="cursor-pointer">
                      <Button 
                        variant="outline" 
                        className="h-auto py-4 flex flex-col gap-2 w-full"
                        asChild
                      >
                        <span>
                          <Upload className="w-5 h-5" />
                          <span>Importar Config</span>
                          <span className="text-xs text-muted-foreground">Restaurar configuración</span>
                        </span>
                      </Button>
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleImportConfig}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* Export/Import All Data */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Database className="w-5 h-5" />
                    <h3 className="font-medium">Backup Completo</h3>
                    <span className="text-xs text-muted-foreground">(Todo: config + personajes + sesiones)</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <Button 
                      variant="outline" 
                      className="h-auto py-4 flex flex-col gap-2"
                      onClick={handleExportAll}
                    >
                      <Download className="w-5 h-5" />
                      <span>Exportar Todo</span>
                      <span className="text-xs text-muted-foreground">Backup completo</span>
                    </Button>
                    <label className="cursor-pointer">
                      <Button 
                        variant="outline" 
                        className="h-auto py-4 flex flex-col gap-2 w-full"
                        asChild
                      >
                        <span>
                          <Upload className="w-5 h-5" />
                          <span>Importar Todo</span>
                          <span className="text-xs text-muted-foreground">Restaurar backup</span>
                        </span>
                      </Button>
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleImportAll}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* Info box */}
                <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                    <div className="space-y-1">
                      <p className="font-medium text-amber-600 dark:text-amber-400">Recomendación</p>
                      <p className="text-muted-foreground">
                        Exporta regularmente un backup completo para respaldar toda tu información.
                        El archivo de configuración es más ligero y solo incluye ajustes.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* HUD Settings */}
            <TabsContent value="hud" className="h-full overflow-y-auto p-6 m-0 data-[state=inactive]:hidden">
              <HUDManager />
            </TabsContent>

            {/* Atmosphere Settings */}
            <TabsContent value="atmosphere" className="h-full overflow-y-auto p-6 m-0 data-[state=inactive]:hidden">
              <AtmosphereSettings />
            </TabsContent>

            {/* Memory Settings */}
            <TabsContent value="memory" className="h-full overflow-y-auto p-6 m-0 data-[state=inactive]:hidden">
              <MemorySettingsPanel />
            </TabsContent>
            
            {/* Quest Settings */}
            <TabsContent value="quests" className="h-full overflow-y-auto p-6 m-0 data-[state=inactive]:hidden">
              <QuestSettingsPanel />
            </TabsContent>
            
            {/* Inventory Settings */}
            <TabsContent value="inventory" className="h-full overflow-hidden m-0 p-0 data-[state=inactive]:hidden">
              <InventoryPanel />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>

      {/* New Config Dialog */}
      <Dialog open={newConfigOpen} onOpenChange={setNewConfigOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar Conexión LLM</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nombre</Label>
              <Input
                value={newConfig.name}
                onChange={(e) => setNewConfig(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Mi Conexión LLM"
                className="mt-1"
              />
            </div>

            <div>
              <Label>Proveedor</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {LLM_PROVIDERS.map((provider) => (
                  <Button
                    key={provider.value}
                    variant={newConfig.provider === provider.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleProviderChange(provider.value)}
                  >
                    {provider.label}
                  </Button>
                ))}
              </div>
            </div>

            {LLM_PROVIDERS.find(p => p.value === newConfig.provider)?.needsEndpoint && (
              <div>
                <Label>URL del Endpoint</Label>
                <Input
                  value={newConfig.endpoint}
                  onChange={(e) => setNewConfig(prev => ({ ...prev, endpoint: e.target.value }))}
                  placeholder="http://localhost:7860"
                  className="mt-1"
                />
              </div>
            )}

            {newConfig.provider !== 'z-ai' && (
              <div>
                <Label>API Key (opcional)</Label>
                <Input
                  type="password"
                  value={newConfig.apiKey}
                  onChange={(e) => setNewConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                  placeholder="sk-..."
                  className="mt-1"
                />
              </div>
            )}

            {newConfig.provider === 'z-ai' && (
              <div className="p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                <p>Z.ai usa el SDK integrado. No requiere endpoint ni API key.</p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setNewConfigOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleAddConfig} 
                disabled={
                  !newConfig.name || 
                  (LLM_PROVIDERS.find(p => p.value === newConfig.provider)?.needsEndpoint && !newConfig.endpoint)
                }
              >
                Agregar Conexión
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

// ============================================
// Appearance Settings Content Component
// ============================================

interface AppearanceSettingsContentProps {
  settings: AppSettings;
  updateSettings: (settings: Partial<AppSettings>) => void;
}

function AppearanceSettingsContent({ settings, updateSettings }: AppearanceSettingsContentProps) {
  return (
    <Tabs defaultValue="theme" className="h-full flex flex-col">
      <div className="border-b px-4 flex-shrink-0 bg-muted/30">
        <TabsList className="h-10">
          <TabsTrigger value="theme" className="gap-1.5 text-xs">
            <Palette className="w-3.5 h-3.5" />
            Tema
          </TabsTrigger>
          <TabsTrigger value="layout" className="gap-1.5 text-xs">
            <Layers className="w-3.5 h-3.5" />
            Diseño
          </TabsTrigger>
          <TabsTrigger value="dialogue" className="gap-1.5 text-xs">
            <MessageSquare className="w-3.5 h-3.5" />
            Diálogos
          </TabsTrigger>
          <TabsTrigger value="quick" className="gap-1.5 text-xs">
            <GripVertical className="w-3.5 h-3.5" />
            Respuestas
          </TabsTrigger>
        </TabsList>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {/* Theme Settings */}
        <TabsContent value="theme" className="p-4 m-0" forceMount hidden={false}>
          <div className="space-y-4">
            {/* Banner */}
            <div className="bg-gradient-to-r from-violet-500/10 to-pink-500/10 border border-violet-500/20 rounded-lg p-3">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-violet-500/20 rounded-lg">
                  <Palette className="w-5 h-5 text-violet-500" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-violet-600">Personalización Visual</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Configura el tema, tamaño de fuente y estilo de mensajes.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              {/* Theme Settings */}
              <div className="p-3 bg-muted/30 rounded-lg border border-border/40 space-y-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Palette className="w-3.5 h-3.5" />
                  <span className="font-medium">Tema</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-background/50">
                  <div>
                    <Label className="text-xs font-medium">Modo de Color</Label>
                    <p className="text-xs text-muted-foreground">Elige tu tema preferido</p>
                  </div>
                  <div className="flex gap-2">
                    {(['light', 'dark', 'system'] as const).map((theme) => (
                      <Button
                        key={theme}
                        variant={settings.theme === theme ? 'default' : 'outline'}
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => updateSettings({ theme })}
                      >
                        {theme === 'light' ? 'Claro' : theme === 'dark' ? 'Oscuro' : 'Sistema'}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-border/40 bg-background/50 space-y-2">
                  <div className="flex justify-between text-sm">
                    <Label className="text-xs">Tamaño de Fuente</Label>
                    <span className="text-muted-foreground">{settings.fontSize}px</span>
                  </div>
                  <Slider
                    value={[settings.fontSize]}
                    min={12}
                    max={24}
                    step={1}
                    onValueChange={([fontSize]) => updateSettings({ fontSize })}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-background/50">
                  <div>
                    <Label className="text-xs font-medium">Visualización</Label>
                    <p className="text-xs text-muted-foreground">Estilo de mensajes</p>
                  </div>
                  <div className="flex gap-2">
                    {(['bubble', 'compact', 'full'] as const).map((mode) => (
                      <Button
                        key={mode}
                        variant={settings.messageDisplay === mode ? 'default' : 'outline'}
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => updateSettings({ messageDisplay: mode })}
                      >
                        {mode === 'bubble' ? 'Burbuja' : mode === 'compact' ? 'Compacto' : 'Completo'}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Toggle Settings */}
              <div className="p-3 bg-muted/30 rounded-lg border border-border/40 space-y-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Settings2 className="w-3.5 h-3.5" />
                  <span className="font-medium">Opciones de Visualización</span>
                </div>
                
                {[
                  { key: 'showTimestamps', label: 'Marcas de Tiempo', desc: 'Mostrar hora en mensajes' },
                  { key: 'showTokens', label: 'Conteo de Tokens', desc: 'Mostrar uso de tokens' },
                  { key: 'autoScroll', label: 'Auto-desplazamiento', desc: 'Scroll automático a nuevos mensajes' },
                ].map(({ key, label, desc }) => (
                  <label key={key} className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-background/50 cursor-pointer hover:bg-muted/50 transition-colors">
                    <div>
                      <Label className="text-xs font-medium">{label}</Label>
                      <p className="text-[10px] text-muted-foreground">{desc}</p>
                    </div>
                    <Switch
                      checked={settings[key as keyof typeof settings] as boolean}
                      onCheckedChange={(checked) => updateSettings({ [key]: checked })}
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>
        
        {/* Layout Settings */}
        <TabsContent value="layout" className="p-4 m-0" forceMount hidden>
          <div className="space-y-6">
            <div>
              <h3 className="font-medium mb-4">Diseño del Chat</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Ancho</span>
                    <span className="text-muted-foreground">{settings.chatLayout.chatWidth}%</span>
                  </div>
                  <Slider
                    value={[settings.chatLayout.chatWidth]}
                    min={25}
                    max={90}
                    step={1}
                    onValueChange={([chatWidth]) => 
                      updateSettings({ 
                        chatLayout: { ...settings.chatLayout, chatWidth } 
                      })
                    }
                  />
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Alto</span>
                    <span className="text-muted-foreground">{settings.chatLayout.chatHeight}%</span>
                  </div>
                  <Slider
                    value={[settings.chatLayout.chatHeight]}
                    min={20}
                    max={90}
                    step={1}
                    onValueChange={([chatHeight]) => 
                      updateSettings({ 
                        chatLayout: { ...settings.chatLayout, chatHeight } 
                      })
                    }
                  />
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50">
                <div>
                  <Label className="text-sm">Modo Novela</Label>
                  <p className="text-xs text-muted-foreground">Vista novela por defecto</p>
                </div>
                <Switch
                  checked={settings.chatLayout.novelMode}
                  onCheckedChange={(novelMode) => 
                    updateSettings({ 
                      chatLayout: { ...settings.chatLayout, novelMode } 
                    })
                  }
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50">
                <div>
                  <Label className="text-sm">Desenfocar Fondo</Label>
                  <p className="text-xs text-muted-foreground">Efecto blur en fondo</p>
                </div>
                <Switch
                  checked={settings.chatLayout.blurBackground}
                  onCheckedChange={(blurBackground) => 
                    updateSettings({ 
                      chatLayout: { ...settings.chatLayout, blurBackground } 
                    })
                  }
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50 col-span-2">
                <div className="flex-1">
                  <Label className="text-sm">Sprite del Personaje</Label>
                  <p className="text-xs text-muted-foreground">Mostrar imagen del personaje en el fondo</p>
                </div>
                <Switch
                  checked={settings.chatLayout.showCharacterSprite}
                  onCheckedChange={(showCharacterSprite) => 
                    updateSettings({ 
                      chatLayout: { ...settings.chatLayout, showCharacterSprite } 
                    })
                  }
                />
              </label>
            </div>
            
            <div className="p-4 rounded-lg bg-muted/30 space-y-2">
              <Label className="text-xs font-medium">💡 Tips de Diseño</Label>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• <strong>Ancho/Alto</strong>: Controla el tamaño del contenedor del chat</li>
                <li>• <strong>Modo Novela</strong>: Vista optimizada para lectura</li>
                <li>• <strong>Sprite</strong>: Arrastra y redimensiona con el mouse</li>
              </ul>
            </div>
          </div>
        </TabsContent>
        
        {/* Dialogue Settings */}
        <TabsContent value="dialogue" className="p-4 m-0" forceMount hidden>
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 text-sm">
              <p className="text-purple-600 dark:text-purple-400">
                💬 <strong>Sistema de Diálogos</strong> detecta automáticamente diálogos, acciones y pensamientos en los mensajes y los formatea visualmente con speech bubbles y efecto typewriter.
              </p>
            </div>
            <DialogueSettingsPanel />
          </div>
        </TabsContent>
        
        {/* Quick Replies */}
        <TabsContent value="quick" className="p-4 m-0" forceMount hidden>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Respuestas Rápidas</h3>
                <p className="text-xs text-muted-foreground">Botones de respuesta rápida</p>
              </div>
              <Button 
                size="sm" 
                onClick={() => {
                  const newReply = prompt('Ingresa nueva respuesta rápida:');
                  if (newReply && newReply.trim()) {
                    updateSettings({ 
                      quickReplies: [...settings.quickReplies, newReply.trim()] 
                    });
                  }
                }}
              >
                <Plus className="w-4 h-4 mr-1" />
                Agregar
              </Button>
            </div>

            <div className="space-y-1 max-h-[300px] overflow-y-auto">
              {settings.quickReplies.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border rounded-lg">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Sin respuestas rápidas</p>
                  <p className="text-xs mt-1">Agrega respuestas para acceder rápidamente</p>
                </div>
              ) : (
                settings.quickReplies.map((reply, index) => (
                  <div 
                    key={index}
                    className="flex items-center gap-2 p-2 rounded-lg border bg-background hover:bg-muted/50 group"
                  >
                    <GripVertical className="w-3 h-3 text-muted-foreground cursor-grab opacity-0 group-hover:opacity-100" />
                    <Input
                      value={reply}
                      onChange={(e) => {
                        const newReplies = [...settings.quickReplies];
                        newReplies[index] = e.target.value;
                        updateSettings({ quickReplies: newReplies });
                      }}
                      className="flex-1 h-7 text-sm"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive opacity-0 group-hover:opacity-100"
                      onClick={() => {
                        const newReplies = settings.quickReplies.filter((_, i) => i !== index);
                        updateSettings({ quickReplies: newReplies });
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))
              )}
            </div>

            {settings.quickReplies.length > 0 && (
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => {
                    updateSettings({ quickReplies: ['Continuar', '...', 'Sí', 'No'] });
                  }}
                >
                  Restablecer
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => {
                    if (confirm('¿Limpiar todas las respuestas rápidas?')) {
                      updateSettings({ quickReplies: [] });
                    }
                  }}
                >
                  Limpiar
                </Button>
              </div>
            )}
          </div>
        </TabsContent>
      </div>
    </Tabs>
  );
}
