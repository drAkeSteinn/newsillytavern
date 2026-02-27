'use client';

import { useTavernStore } from '@/store/tavern-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  X,
  User
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { LLMProvider } from '@/types';
import { SoundTriggersSettings } from './sound-triggers-settings';
import { PersonaPanel } from './persona-panel';

const LLM_PROVIDERS: { value: LLMProvider; label: string; defaultEndpoint: string; needsEndpoint: boolean }[] = [
  { value: 'z-ai', label: 'Z.ai Chat', defaultEndpoint: '', needsEndpoint: false },
  { value: 'text-generation-webui', label: 'Text Generation WebUI', defaultEndpoint: 'http://localhost:7860', needsEndpoint: true },
  { value: 'ollama', label: 'Ollama', defaultEndpoint: 'http://localhost:11434', needsEndpoint: true },
  { value: 'koboldcpp', label: 'KoboldCPP', defaultEndpoint: 'http://localhost:5001', needsEndpoint: true },
  { value: 'vllm', label: 'vLLM', defaultEndpoint: 'http://localhost:8000', needsEndpoint: true },
  { value: 'openai', label: 'OpenAI', defaultEndpoint: 'https://api.openai.com/v1', needsEndpoint: true },
  { value: 'anthropic', label: 'Anthropic', defaultEndpoint: 'https://api.anthropic.com/v1', needsEndpoint: true },
  { value: 'custom', label: 'Custom', defaultEndpoint: '', needsEndpoint: true }
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
  const [newConfig, setNewConfig] = useState({
    name: '',
    provider: 'z-ai' as LLMProvider,
    endpoint: '',
    apiKey: ''
  });

  const activeConfig = llmConfigs.find(c => c.isActive);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        fullscreen
        className="p-0 gap-0"
        showCloseButton={true}
      >
        <DialogHeader className="p-6 border-b flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Settings
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="llm" className="flex-1 flex flex-col overflow-hidden h-[calc(100vh-80px)]">
          <div className="border-b px-6 flex-shrink-0">
            <TabsList className="h-12 flex-wrap">
              <TabsTrigger value="llm" className="gap-2">
                <Bot className="w-4 h-4" />
                LLM
              </TabsTrigger>
              <TabsTrigger value="persona" className="gap-2">
                <User className="w-4 h-4" />
                Persona
              </TabsTrigger>
              <TabsTrigger value="chat" className="gap-2">
                <MessageSquare className="w-4 h-4" />
                Chat
              </TabsTrigger>
              <TabsTrigger value="appearance" className="gap-2">
                <Palette className="w-4 h-4" />
                Appearance
              </TabsTrigger>
              <TabsTrigger value="sounds" className="gap-2">
                <Music className="w-4 h-4" />
                Sounds
              </TabsTrigger>
              <TabsTrigger value="backgrounds" className="gap-2">
                <ImageIcon className="w-4 h-4" />
                Backgrounds
              </TabsTrigger>
              <TabsTrigger value="voice" className="gap-2">
                <Volume2 className="w-4 h-4" />
                Voice
              </TabsTrigger>
              <TabsTrigger value="hotkeys" className="gap-2">
                <Keyboard className="w-4 h-4" />
                Hotkeys
              </TabsTrigger>
              <TabsTrigger value="data" className="gap-2">
                <Database className="w-4 h-4" />
                Data
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1 overflow-auto">
            {/* LLM Settings */}
            <TabsContent value="llm" className="p-6 space-y-6 mt-0">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">LLM Connections</h3>
                  <Button size="sm" onClick={() => setNewConfigOpen(true)}>
                    <Plus className="w-4 h-4 mr-1" />
                    Add Connection
                  </Button>
                </div>

                {llmConfigs.map((config) => (
                  <div 
                    key={config.id} 
                    className={cn(
                      'p-4 rounded-lg border space-y-3',
                      config.isActive && 'border-primary bg-primary/5'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'w-3 h-3 rounded-full',
                          config.isActive ? 'bg-green-500' : 'bg-muted-foreground'
                        )} />
                        <div>
                          <p className="font-medium">{config.name}</p>
                          <p className="text-xs text-muted-foreground">{config.provider}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!config.isActive && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setActiveLLMConfig(config.id)}
                          >
                            <Check className="w-4 h-4 mr-1" />
                            Activate
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => deleteLLMConfig(config.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {config.endpoint && config.provider !== 'z-ai' && (
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" />
                        {config.endpoint}
                      </div>
                    )}

                    {config.provider === 'z-ai' && (
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <Check className="w-3 h-3 text-green-500" />
                        Built-in SDK (no endpoint needed)
                      </div>
                    )}

                    {config.isActive && (
                      <div className="space-y-4 pt-4 border-t">
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Temperature</span>
                            <span>{config.parameters.temperature}</span>
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
                            <span>{config.parameters.topP}</span>
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

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-xs">Max Tokens</Label>
                            <Input
                              type="number"
                              value={config.parameters.maxTokens}
                              onChange={(e) => 
                                updateLLMConfig(config.id, {
                                  parameters: { ...config.parameters, maxTokens: parseInt(e.target.value) }
                                })
                              }
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Context Size</Label>
                            <Input
                              type="number"
                              value={config.parameters.contextSize}
                              onChange={(e) => 
                                updateLLMConfig(config.id, {
                                  parameters: { ...config.parameters, contextSize: parseInt(e.target.value) }
                                })
                              }
                              className="mt-1"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <Label className="text-sm">Enable Streaming</Label>
                          <Switch
                            checked={config.parameters.stream}
                            onCheckedChange={(checked) => 
                              updateLLMConfig(config.id, {
                                parameters: { ...config.parameters, stream: checked }
                              })
                            }
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* Persona Settings */}
            <TabsContent value="persona" className="p-6 space-y-6 mt-0">
              <PersonaPanel />
            </TabsContent>

            {/* Chat Settings */}
            <TabsContent value="chat" className="p-6 space-y-6 mt-0">
              {/* Quick Replies Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Quick Replies</h3>
                    <p className="text-sm text-muted-foreground">Customize quick reply buttons for fast responses</p>
                  </div>
                  <Button 
                    size="sm" 
                    onClick={() => {
                      const newReply = prompt('Enter new quick reply:');
                      if (newReply && newReply.trim()) {
                        updateSettings({ 
                          quickReplies: [...settings.quickReplies, newReply.trim()] 
                        });
                      }
                    }}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Reply
                  </Button>
                </div>

                <div className="space-y-2">
                  {settings.quickReplies.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground border rounded-lg">
                      <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No quick replies configured</p>
                      <p className="text-xs">Add some to speed up your responses</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {settings.quickReplies.map((reply, index) => (
                        <div 
                          key={index}
                          className="flex items-center gap-2 p-2 rounded-lg border bg-background hover:bg-muted/50 group"
                        >
                          <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab opacity-0 group-hover:opacity-100" />
                          
                          <Input
                            value={reply}
                            onChange={(e) => {
                              const newReplies = [...settings.quickReplies];
                              newReplies[index] = e.target.value;
                              updateSettings({ quickReplies: newReplies });
                            }}
                            className="flex-1 h-8 text-sm"
                          />
                          
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                            {index > 0 && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => {
                                  const newReplies = [...settings.quickReplies];
                                  [newReplies[index - 1], newReplies[index]] = [newReplies[index], newReplies[index - 1]];
                                  updateSettings({ quickReplies: newReplies });
                                }}
                              >
                                <span className="text-xs">↑</span>
                              </Button>
                            )}
                            {index < settings.quickReplies.length - 1 && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => {
                                  const newReplies = [...settings.quickReplies];
                                  [newReplies[index], newReplies[index + 1]] = [newReplies[index + 1], newReplies[index]];
                                  updateSettings({ quickReplies: newReplies });
                                }}
                              >
                                <span className="text-xs">↓</span>
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => {
                                const newReplies = settings.quickReplies.filter((_, i) => i !== index);
                                updateSettings({ quickReplies: newReplies });
                              }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {settings.quickReplies.length > 0 && (
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        updateSettings({ quickReplies: ['Continue', '...', 'Yes', 'No'] });
                      }}
                    >
                      Reset to Default
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        if (confirm('Are you sure you want to clear all quick replies?')) {
                          updateSettings({ quickReplies: [] });
                        }
                      }}
                    >
                      Clear All
                    </Button>
                  </div>
                )}
              </div>

              {/* Chat Layout Settings */}
              <div className="pt-4 border-t space-y-4">
                <h3 className="font-medium">Chat Layout</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Default Width</span>
                      <span>{settings.chatLayout.chatWidth}%</span>
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
                      <span>Default Height</span>
                      <span>{settings.chatLayout.chatHeight}%</span>
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

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Start in Novel Mode</Label>
                    <p className="text-xs text-muted-foreground">Open chats in novel view by default</p>
                  </div>
                  <Switch
                    checked={settings.chatLayout.novelMode}
                    onCheckedChange={(novelMode) => 
                      updateSettings({ 
                        chatLayout: { ...settings.chatLayout, novelMode } 
                      })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Blur Background</Label>
                    <p className="text-xs text-muted-foreground">Apply blur effect to chat background</p>
                  </div>
                  <Switch
                    checked={settings.chatLayout.blurBackground}
                    onCheckedChange={(blurBackground) => 
                      updateSettings({ 
                        chatLayout: { ...settings.chatLayout, blurBackground } 
                      })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Show Character Sprite</Label>
                    <p className="text-xs text-muted-foreground">Display character image in novel mode</p>
                  </div>
                  <Switch
                    checked={settings.chatLayout.showCharacterSprite}
                    onCheckedChange={(showCharacterSprite) => 
                      updateSettings({ 
                        chatLayout: { ...settings.chatLayout, showCharacterSprite } 
                      })
                    }
                  />
                </div>
              </div>
            </TabsContent>

            {/* Appearance Settings */}
            <TabsContent value="appearance" className="p-6 space-y-6 mt-0">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Theme</Label>
                    <p className="text-xs text-muted-foreground">Choose your preferred color theme</p>
                  </div>
                  <div className="flex gap-2">
                    {(['light', 'dark', 'system'] as const).map((theme) => (
                      <Button
                        key={theme}
                        variant={settings.theme === theme ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => updateSettings({ theme })}
                      >
                        {theme.charAt(0).toUpperCase() + theme.slice(1)}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Font Size</Label>
                    <p className="text-xs text-muted-foreground">Adjust the text size</p>
                  </div>
                  <div className="w-48">
                    <Slider
                      value={[settings.fontSize]}
                      min={12}
                      max={24}
                      step={1}
                      onValueChange={([fontSize]) => updateSettings({ fontSize })}
                    />
                    <div className="text-center text-sm mt-1">{settings.fontSize}px</div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Message Display</Label>
                    <p className="text-xs text-muted-foreground">How messages are displayed</p>
                  </div>
                  <div className="flex gap-2">
                    {(['bubble', 'compact', 'full'] as const).map((mode) => (
                      <Button
                        key={mode}
                        variant={settings.messageDisplay === mode ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => updateSettings({ messageDisplay: mode })}
                      >
                        {mode.charAt(0).toUpperCase() + mode.slice(1)}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Show Timestamps</Label>
                    <p className="text-xs text-muted-foreground">Display time on messages</p>
                  </div>
                  <Switch
                    checked={settings.showTimestamps}
                    onCheckedChange={(showTimestamps) => updateSettings({ showTimestamps })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Show Token Count</Label>
                    <p className="text-xs text-muted-foreground">Display token usage</p>
                  </div>
                  <Switch
                    checked={settings.showTokens}
                    onCheckedChange={(showTokens) => updateSettings({ showTokens })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Auto-scroll</Label>
                    <p className="text-xs text-muted-foreground">Scroll to new messages automatically</p>
                  </div>
                  <Switch
                    checked={settings.autoScroll}
                    onCheckedChange={(autoScroll) => updateSettings({ autoScroll })}
                  />
                </div>
              </div>
            </TabsContent>

            {/* Sound Triggers Settings */}
            <TabsContent value="sounds" className="p-6 space-y-6 mt-0">
              <SoundTriggersSettings />
            </TabsContent>

            {/* Background Triggers Settings */}
            <TabsContent value="backgrounds" className="p-6 space-y-6 mt-0">
              <div className="text-center py-8 text-muted-foreground">
                <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Background triggers configuration</p>
                <p className="text-xs mt-1">Configure background changes based on keywords</p>
                <Button variant="outline" className="mt-4">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Background Trigger
                </Button>
              </div>
            </TabsContent>

            {/* Voice Settings */}
            <TabsContent value="voice" className="p-6 space-y-6 mt-0">
              <div className="text-center py-8 text-muted-foreground">
                <Volume2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Configure TTS providers and voice settings</p>
                <Button variant="outline" className="mt-4">
                  <Plus className="w-4 h-4 mr-2" />
                  Add TTS Provider
                </Button>
              </div>
            </TabsContent>

            {/* Hotkeys Settings */}
            <TabsContent value="hotkeys" className="p-6 space-y-6 mt-0">
              <div className="space-y-4">
                {Object.entries(settings.hotkeys).map(([action, key]) => (
                  <div key={action} className="flex items-center justify-between">
                    <Label className="capitalize">{action.replace(/([A-Z])/g, ' $1')}</Label>
                    <kbd className="px-2 py-1 bg-muted rounded text-sm font-mono">
                      {key}
                    </kbd>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* Data Settings */}
            <TabsContent value="data" className="p-6 space-y-6 mt-0">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Auto-save</Label>
                    <p className="text-xs text-muted-foreground">Automatically save changes</p>
                  </div>
                  <Switch
                    checked={settings.autoSave}
                    onCheckedChange={(autoSave) => updateSettings({ autoSave })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Confirm Delete</Label>
                    <p className="text-xs text-muted-foreground">Ask before deleting items</p>
                  </div>
                  <Switch
                    checked={settings.confirmDelete}
                    onCheckedChange={(confirmDelete) => updateSettings({ confirmDelete })}
                  />
                </div>

                <div className="pt-4 border-t space-y-3">
                  <h4 className="font-medium">Export/Import</h4>
                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1">
                      Export All Data
                    </Button>
                    <Button variant="outline" className="flex-1">
                      Import Data
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>

      {/* New Config Dialog */}
      <Dialog open={newConfigOpen} onOpenChange={setNewConfigOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add LLM Connection</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                value={newConfig.name}
                onChange={(e) => setNewConfig(prev => ({ ...prev, name: e.target.value }))}
                placeholder="My LLM Connection"
                className="mt-1"
              />
            </div>

            <div>
              <Label>Provider</Label>
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

            {/* Endpoint URL - only for providers that need it */}
            {LLM_PROVIDERS.find(p => p.value === newConfig.provider)?.needsEndpoint && (
              <div>
                <Label>Endpoint URL</Label>
                <Input
                  value={newConfig.endpoint}
                  onChange={(e) => setNewConfig(prev => ({ ...prev, endpoint: e.target.value }))}
                  placeholder="http://localhost:7860"
                  className="mt-1"
                />
              </div>
            )}

            {/* API Key - not needed for Z.ai */}
            {newConfig.provider !== 'z-ai' && (
              <div>
                <Label>API Key (optional)</Label>
                <Input
                  type="password"
                  value={newConfig.apiKey}
                  onChange={(e) => setNewConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                  placeholder="sk-..."
                  className="mt-1"
                />
              </div>
            )}

            {/* Info for Z.ai */}
            {newConfig.provider === 'z-ai' && (
              <div className="p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                <p>Z.ai uses the built-in SDK. No endpoint or API key required.</p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setNewConfigOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleAddConfig} 
                disabled={
                  !newConfig.name || 
                  (LLM_PROVIDERS.find(p => p.value === newConfig.provider)?.needsEndpoint && !newConfig.endpoint)
                }
              >
                Add Connection
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
