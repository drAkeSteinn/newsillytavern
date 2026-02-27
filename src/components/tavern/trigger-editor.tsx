'use client';

import { useState } from 'react';
import { useTriggerStore } from '@/store/trigger-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  Volume2, 
  Image as ImageIcon, 
  Sparkles, 
  Plus, 
  Trash2, 
  Edit,
  Play,
  Settings
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { SFXTrigger, BackgroundTrigger, SpriteTrigger } from '@/types/triggers';

interface TriggerEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TriggerEditor({ open, onOpenChange }: TriggerEditorProps) {
  const {
    settings,
    updateSettings,
    sfxTriggers,
    addSFXTrigger,
    deleteSFXTrigger,
    backgroundTriggers,
    addBackgroundTrigger,
    deleteBackgroundTrigger,
    spriteTriggers,
    addSpriteTrigger,
    deleteSpriteTrigger,
  } = useTriggerStore();

  const [newSFXKeyword, setNewSFXKeyword] = useState('');
  const [newSoundPath, setNewSoundPath] = useState('/sounds/pop/pop1.wav');
  const [newBgKeyword, setNewBgKeyword] = useState('');
  const [newBgPath, setNewBgPath] = useState('');

  const handleAddSFXTrigger = () => {
    if (!newSFXKeyword.trim()) return;
    
    addSFXTrigger({
      title: newSFXKeyword,
      active: true,
      keywords: [newSFXKeyword.toLowerCase()],
      requirePipes: true,
      caseSensitive: false,
      src: newSoundPath,
      volume: 1.0,
      cooldownMs: 800,
      repeatCount: 1,
      soundPack: 'custom',
    });
    
    setNewSFXKeyword('');
  };

  const handleAddBackgroundTrigger = () => {
    if (!newBgKeyword.trim()) return;
    
    addBackgroundTrigger({
      title: newBgKeyword,
      active: true,
      keywords: [newBgKeyword.toLowerCase()],
      requirePipes: true,
      caseSensitive: false,
      backgroundName: newBgPath || 'Room',
      cooldownMs: 1500,
    });
    
    setNewBgKeyword('');
    setNewBgPath('');
  };

  const handleTestSound = (src: string) => {
    const audio = new Audio(src);
    audio.volume = settings.globalVolume;
    audio.play().catch(console.error);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Trigger Configuration
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="sfx" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="sfx" className="gap-1">
              <Volume2 className="w-4 h-4" />
              SFX
            </TabsTrigger>
            <TabsTrigger value="backgrounds" className="gap-1">
              <ImageIcon className="w-4 h-4" />
              Backgrounds
            </TabsTrigger>
            <TabsTrigger value="sprites" className="gap-1">
              <Sparkles className="w-4 h-4" />
              Sprites
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1">
              <Settings className="w-4 h-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-4">
            {/* SFX Triggers Tab */}
            <TabsContent value="sfx" className="space-y-4 mt-0">
              {/* Add new trigger */}
              <div className="p-4 border rounded-lg space-y-3">
                <h4 className="font-medium">Add Sound Trigger</h4>
                <div className="flex gap-2">
                  <Input
                    placeholder="Keyword (e.g., golpe)"
                    value={newSFXKeyword}
                    onChange={(e) => setNewSFXKeyword(e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    placeholder="Sound path"
                    value={newSoundPath}
                    onChange={(e) => setNewSoundPath(e.target.value)}
                    className="flex-1"
                  />
                  <Button onClick={handleAddSFXTrigger}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Existing triggers */}
              <div className="space-y-2">
                {sfxTriggers.map((trigger) => (
                  <div
                    key={trigger.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleTestSound(trigger.src)}
                      >
                        <Play className="w-4 h-4" />
                      </Button>
                      <div>
                        <p className="font-medium">{trigger.title}</p>
                        <div className="flex gap-1">
                          {trigger.keywords.slice(0, 3).map((kw) => (
                            <Badge key={kw} variant="secondary" className="text-xs">
                              |{kw}|
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{Math.round(trigger.volume * 100)}%</Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => deleteSFXTrigger(trigger.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* Backgrounds Tab */}
            <TabsContent value="backgrounds" className="space-y-4 mt-0">
              <div className="p-4 border rounded-lg space-y-3">
                <h4 className="font-medium">Add Background Trigger</h4>
                <div className="flex gap-2">
                  <Input
                    placeholder="Keyword (e.g., baño)"
                    value={newBgKeyword}
                    onChange={(e) => setNewBgKeyword(e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    placeholder="Background name"
                    value={newBgPath}
                    onChange={(e) => setNewBgPath(e.target.value)}
                    className="flex-1"
                  />
                  <Button onClick={handleAddBackgroundTrigger}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                {backgroundTriggers.map((trigger) => (
                  <div
                    key={trigger.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                  >
                    <div>
                      <p className="font-medium">{trigger.title}</p>
                      <p className="text-sm text-muted-foreground">
                        → {trigger.backgroundName}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => deleteBackgroundTrigger(trigger.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* Sprites Tab */}
            <TabsContent value="sprites" className="space-y-4 mt-0">
              <div className="text-center py-8 text-muted-foreground">
                <Sparkles className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Sprite triggers allow changing character expressions based on keywords.</p>
                <Button variant="outline" className="mt-4">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Sprite Trigger
                </Button>
              </div>
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="space-y-6 mt-0">
              {/* Enable/Disable */}
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Triggers</Label>
                  <p className="text-xs text-muted-foreground">
                    Master switch for all trigger systems
                  </p>
                </div>
                <Switch
                  checked={settings.enabled}
                  onCheckedChange={(enabled) => updateSettings({ enabled })}
                />
              </div>

              {/* Scan Mode */}
              <div className="flex items-center justify-between">
                <div>
                  <Label>Scan Mode</Label>
                  <p className="text-xs text-muted-foreground">
                    {settings.scanMode === 'pipes' 
                      ? 'Only detect |keyword| syntax' 
                      : 'Also detect plain text keywords'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={settings.scanMode === 'pipes' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateSettings({ scanMode: 'pipes' })}
                  >
                    Pipes Only
                  </Button>
                  <Button
                    variant={settings.scanMode === 'pipes+text' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateSettings({ scanMode: 'pipes+text' })}
                  >
                    Pipes + Text
                  </Button>
                </div>
              </div>

              {/* Global Volume */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Global Volume</Label>
                  <span className="text-sm">{Math.round(settings.globalVolume * 100)}%</span>
                </div>
                <Slider
                  value={[settings.globalVolume]}
                  min={0}
                  max={1}
                  step={0.05}
                  onValueChange={([volume]) => updateSettings({ globalVolume: volume })}
                />
              </div>

              {/* Fuzzy Matching */}
              <div className="flex items-center justify-between">
                <div>
                  <Label>Fuzzy Matching</Label>
                  <p className="text-xs text-muted-foreground">
                    Allow partial keyword matches
                  </p>
                </div>
                <Switch
                  checked={settings.fuzzyEnabled}
                  onCheckedChange={(fuzzyEnabled) => updateSettings({ fuzzyEnabled })}
                />
              </div>

              {/* Fuzzy Threshold */}
              {settings.fuzzyEnabled && (
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Fuzzy Threshold</Label>
                    <span className="text-sm">{settings.fuzzyThreshold.toFixed(2)}</span>
                  </div>
                  <Slider
                    value={[settings.fuzzyThreshold]}
                    min={0}
                    max={1}
                    step={0.05}
                    onValueChange={([fuzzyThreshold]) => updateSettings({ fuzzyThreshold })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Lower = stricter matching, Higher = more lenient
                  </p>
                </div>
              )}

              {/* Cooldowns */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Global Cooldown (ms)</Label>
                  <Input
                    type="number"
                    value={settings.globalCooldownMs}
                    onChange={(e) => updateSettings({ globalCooldownMs: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Sounds Per Message</Label>
                  <Input
                    type="number"
                    value={settings.maxSoundsPerMessage}
                    onChange={(e) => updateSettings({ maxSoundsPerMessage: parseInt(e.target.value) || 1 })}
                  />
                </div>
              </div>

              {/* Background Settings */}
              <div className="flex items-center justify-between">
                <div>
                  <Label>Background Triggers</Label>
                  <p className="text-xs text-muted-foreground">
                    Enable background switching from triggers
                  </p>
                </div>
                <Switch
                  checked={settings.playBackgroundTriggers}
                  onCheckedChange={(playBackgroundTriggers) => updateSettings({ playBackgroundTriggers })}
                />
              </div>

              {/* Realtime Detection */}
              <div className="flex items-center justify-between">
                <div>
                  <Label>Realtime Detection</Label>
                  <p className="text-xs text-muted-foreground">
                    Detect triggers during message streaming
                  </p>
                </div>
                <Switch
                  checked={settings.realtimeEnabled}
                  onCheckedChange={(realtimeEnabled) => updateSettings({ realtimeEnabled })}
                />
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
