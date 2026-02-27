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
  Upload
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { LLMProvider } from '@/types';
import { SoundTriggersSettings } from './sound-triggers-settings';
import { PersonaPanel } from './persona-panel';
import { LorebookPanel } from './lorebook-panel';

const LLM_PROVIDERS: { value: LLMProvider; label: string; defaultEndpoint: string; needsEndpoint: boolean }[] = [
  { value: 'z-ai', label: 'Z.ai Chat', defaultEndpoint: '', needsEndpoint: false },
  { value: 'text-generation-webui', label: 'Text Generation WebUI', defaultEndpoint: 'http://localhost:7860', needsEndpoint: true },
  { value: 'ollama', label: 'Ollama', defaultEndpoint: 'http://localhost:11434', needsEndpoint: true },
  { value: 'koboldcpp', label: 'KoboldCPP', defaultEndpoint: 'http://localhost:5001', needsEndpoint: true },
  { value: 'vllm', label: 'vLLM', defaultEndpoint: 'http://localhost:8000', needsEndpoint: true },
  { value: 'openai', label: 'OpenAI', defaultEndpoint: 'https://api.openai.com/v1', needsEndpoint: true },
  { value: 'anthropic', label: 'Anthropic', defaultEndpoint: 'https://api.anthropic.com/v1', needsEndpoint: true },
  { value: 'custom', label: 'Personalizado', defaultEndpoint: '', needsEndpoint: true }
];

interface SettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsPanel({ open, onOpenChange }: SettingsPanelProps) {
  const { 
    settings, 
    updateSettings, 
    llmConfigs, 
    addLLMConfig, 
    updateLLMConfig, 
    setActiveLLMConfig,
    deleteLLMConfig 
  } = useTavernStore();

  const [newConfigOpen, setNewConfigOpen] = useState(false);
  const [recordingHotkey, setRecordingHotkey] = useState<string | null>(null);
  const hotkeyContainerRef = useRef<HTMLDivElement>(null);
  const [newConfig, setNewConfig] = useState({
    name: '',
    provider: 'z-ai' as LLMProvider,
    endpoint: '',
    apiKey: ''
  });

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

        <Tabs defaultValue="llm" className="flex-1 flex flex-col overflow-hidden min-h-0">
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
              <TabsTrigger value="chat" className="gap-1.5 text-xs">
                <MessageSquare className="w-4 h-4" />
                Chat
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
            </TabsList>
          </div>

          {/* Content container with proper height */}
          <div className="flex-1 overflow-hidden">
            {/* LLM Settings */}
            <TabsContent value="llm" className="h-full overflow-y-auto p-6 m-0 data-[state=inactive]:hidden">
              <div className="grid grid-cols-[1fr_1fr] gap-6 h-full">
                {/* Left: LLM Connections List */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Conexiones LLM</h3>
                    <Button size="sm" onClick={() => setNewConfigOpen(true)}>
                      <Plus className="w-4 h-4 mr-1" />
                      Agregar
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {llmConfigs.map((config) => (
                      <div 
                        key={config.id} 
                        className={cn(
                          'p-3 rounded-lg border transition-colors cursor-pointer',
                          config.isActive ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
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
                <div className="border-l pl-6">
                  {llmConfigs.find(c => c.isActive) ? (
                    (() => {
                      const config = llmConfigs.find(c => c.isActive)!;
                      return (
                        <div className="space-y-4">
                          <h3 className="font-medium">Parámetros de {config.name}</h3>
                          
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
                    <div className="text-center py-12 text-muted-foreground">
                      <Bot className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>Selecciona una conexión para ver sus parámetros</p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Persona Settings */}
            <TabsContent value="persona" className="h-full overflow-hidden p-6 m-0 data-[state=inactive]:hidden">
              <PersonaPanel />
            </TabsContent>

            {/* Lorebook Settings */}
            <TabsContent value="lorebooks" className="h-full overflow-hidden p-6 m-0 data-[state=inactive]:hidden">
              <LorebookPanel />
            </TabsContent>

            {/* Chat Settings */}
            <TabsContent value="chat" className="h-full overflow-y-auto p-6 m-0 data-[state=inactive]:hidden">
              <div className="grid grid-cols-2 gap-6">
                {/* Quick Replies Section */}
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
                      <div className="text-center py-4 text-muted-foreground border rounded-lg">
                        <MessageSquare className="w-6 h-6 mx-auto mb-1 opacity-50" />
                        <p className="text-xs">Sin respuestas rápidas</p>
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

                {/* Chat Layout Settings */}
                <div className="space-y-4">
                  <h3 className="font-medium">Diseño del Chat</h3>
                  
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
                        <p className="text-xs text-muted-foreground">Mostrar imagen del personaje en el fondo del chat</p>
                        <p className="text-xs text-muted-foreground/70 mt-1">
                          💡 Pasa el mouse sobre el sprite para arrastrarlo o redimensionarlo
                        </p>
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
                </div>
              </div>
            </TabsContent>

            {/* Appearance Settings */}
            <TabsContent value="appearance" className="h-full overflow-y-auto p-6 m-0 data-[state=inactive]:hidden">
              <div className="grid grid-cols-2 gap-6">
                {/* Theme Settings */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div>
                      <Label className="font-medium">Tema</Label>
                      <p className="text-xs text-muted-foreground">Elige tu tema preferido</p>
                    </div>
                    <div className="flex gap-2">
                      {(['light', 'dark', 'system'] as const).map((theme) => (
                        <Button
                          key={theme}
                          variant={settings.theme === theme ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => updateSettings({ theme })}
                        >
                          {theme === 'light' ? 'Claro' : theme === 'dark' ? 'Oscuro' : 'Sistema'}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 rounded-lg border space-y-2">
                    <div className="flex justify-between">
                      <Label>Tamaño de Fuente</Label>
                      <span className="text-sm text-muted-foreground">{settings.fontSize}px</span>
                    </div>
                    <Slider
                      value={[settings.fontSize]}
                      min={12}
                      max={24}
                      step={1}
                      onValueChange={([fontSize]) => updateSettings({ fontSize })}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div>
                      <Label className="font-medium">Visualización</Label>
                      <p className="text-xs text-muted-foreground">Estilo de mensajes</p>
                    </div>
                    <div className="flex gap-2">
                      {(['bubble', 'compact', 'full'] as const).map((mode) => (
                        <Button
                          key={mode}
                          variant={settings.messageDisplay === mode ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => updateSettings({ messageDisplay: mode })}
                        >
                          {mode === 'bubble' ? 'Burbuja' : mode === 'compact' ? 'Compacto' : 'Completo'}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Toggle Settings */}
                <div className="space-y-3">
                  <h3 className="font-medium">Opciones de Visualización</h3>
                  
                  {[
                    { key: 'showTimestamps', label: 'Marcas de Tiempo', desc: 'Mostrar hora en mensajes' },
                    { key: 'showTokens', label: 'Conteo de Tokens', desc: 'Mostrar uso de tokens' },
                    { key: 'autoScroll', label: 'Auto-desplazamiento', desc: 'Scroll automático a nuevos mensajes' },
                  ].map(({ key, label, desc }) => (
                    <label key={key} className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50">
                      <div>
                        <Label className="text-sm">{label}</Label>
                        <p className="text-xs text-muted-foreground">{desc}</p>
                      </div>
                      <Switch
                        checked={settings[key as keyof typeof settings] as boolean}
                        onCheckedChange={(checked) => updateSettings({ [key]: checked })}
                      />
                    </label>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* Sound Triggers Settings */}
            <TabsContent value="sounds" className="h-full overflow-hidden p-6 m-0 data-[state=inactive]:hidden">
              <SoundTriggersSettings />
            </TabsContent>

            {/* Background Triggers Settings */}
            <TabsContent value="backgrounds" className="h-full overflow-y-auto p-6 m-0 data-[state=inactive]:hidden">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Triggers de Fondo</h3>
                    <Button size="sm">
                      <Plus className="w-4 h-4 mr-1" />
                      Agregar
                    </Button>
                  </div>
                  <div className="text-center py-8 text-muted-foreground border rounded-lg">
                    <ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Sin triggers de fondo configurados</p>
                    <p className="text-xs mt-1">Los triggers cambian el fondo según palabras clave</p>
                  </div>
                </div>
                <div className="p-4 rounded-lg border bg-muted/30 text-sm text-muted-foreground">
                  <h4 className="font-medium text-foreground mb-2">Acerca de Triggers de Fondo</h4>
                  <p>
                    Los triggers de fondo permiten cambiar automáticamente el fondo del chat 
                    cuando se detectan ciertas palabras clave en los mensajes del personaje.
                  </p>
                  <p className="mt-2">
                    Por ejemplo, puedes configurar un fondo de "noche" cuando aparezca 
                    "luna" o "estrellas" en la conversación.
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* Voice Settings */}
            <TabsContent value="voice" className="h-full overflow-y-auto p-6 m-0 data-[state=inactive]:hidden">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Proveedores TTS</h3>
                    <Button size="sm">
                      <Plus className="w-4 h-4 mr-1" />
                      Agregar
                    </Button>
                  </div>
                  <div className="text-center py-8 text-muted-foreground border rounded-lg">
                    <Volume2 className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Sin proveedores TTS configurados</p>
                    <p className="text-xs mt-1">Agrega un proveedor para activar la síntesis de voz</p>
                  </div>
                </div>
                <div className="p-4 rounded-lg border bg-muted/30 text-sm text-muted-foreground">
                  <h4 className="font-medium text-foreground mb-2">Acerca de TTS</h4>
                  <p>
                    La síntesis de voz (TTS) permite que el personaje hable sus mensajes.
                    Configura un proveedor TTS como ElevenLabs, Azure, o el SDK integrado.
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* Hotkeys Settings */}
            <TabsContent value="hotkeys" className="h-full overflow-y-auto p-6 m-0 data-[state=inactive]:hidden">
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
            </TabsContent>

            {/* Data Settings */}
            <TabsContent value="data" className="h-full overflow-y-auto p-6 m-0 data-[state=inactive]:hidden">
              <div className="grid grid-cols-2 gap-6">
                {/* Settings Toggles */}
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

                {/* Export/Import */}
                <div className="space-y-4">
                  <h3 className="font-medium">Exportar/Importar</h3>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <Button variant="outline" className="h-auto py-4 flex flex-col gap-2">
                      <Download className="w-5 h-5" />
                      <span>Exportar Todo</span>
                      <span className="text-xs text-muted-foreground">Personajes, chats, configs</span>
                    </Button>
                    <Button variant="outline" className="h-auto py-4 flex flex-col gap-2">
                      <Upload className="w-5 h-5" />
                      <span>Importar Datos</span>
                      <span className="text-xs text-muted-foreground">Desde archivo JSON</span>
                    </Button>
                  </div>

                  <div className="p-3 rounded-lg bg-muted/30 text-sm text-muted-foreground">
                    <p>
                      Los datos se guardan localmente en tu navegador. 
                      Exporta regularmente para respaldar tu información.
                    </p>
                  </div>
                </div>
              </div>
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
