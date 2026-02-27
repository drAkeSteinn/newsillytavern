'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTavernStore } from '@/store/tavern-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import type { SoundTrigger, SoundCollection } from '@/types';
import {
  Plus,
  Play,
  Copy,
  Trash2,
  RefreshCw,
  Volume2,
  VolumeX,
  ChevronDown,
  Zap,
  Music
} from 'lucide-react';

export function SoundTriggersSettings() {
  const {
    soundTriggers,
    soundCollections,
    settings,
    addSoundTrigger,
    updateSoundTrigger,
    deleteSoundTrigger,
    cloneSoundTrigger,
    toggleSoundTrigger,
    toggleSoundKeyword,
    setSoundCollections,
    updateSettings
  } = useTavernStore();

  const [isLoading, setIsLoading] = useState(false);
  const [expandedTriggers, setExpandedTriggers] = useState<string[]>([]);
  const [testingSound, setTestingSound] = useState<string | null>(null);

  // Fetch sound collections
  const fetchCollections = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/sounds/collections');
      const data = await response.json();
      console.log('[SoundTriggers] Loaded collections:', data.collections?.length || 0);
      setSoundCollections(data.collections);
    } catch (error) {
      console.error('Failed to fetch sound collections:', error);
    } finally {
      setIsLoading(false);
    }
  }, [setSoundCollections]);

  // Fetch sound collections on mount
  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  // Create new trigger
  const handleAddTrigger = () => {
    const newTrigger: Omit<SoundTrigger, 'id' | 'createdAt' | 'updatedAt' | 'currentIndex'> = {
      name: `New Trigger ${soundTriggers.length + 1}`,
      active: true,
      keywords: [],
      keywordsEnabled: {},
      collection: soundCollections[0]?.name || '',
      playMode: 'random',
      volume: 0.8,
      cooldown: 1000,
      delay: 0
    };
    addSoundTrigger(newTrigger);
  };

  // Test sound playback
  const handleTestSound = async (trigger: SoundTrigger) => {
    const collection = soundCollections.find(c => c.name === trigger.collection);
    if (!collection || collection.files.length === 0) return;

    setTestingSound(trigger.id);
    
    try {
      const soundIndex = trigger.playMode === 'random'
        ? Math.floor(Math.random() * collection.files.length)
        : trigger.currentIndex % collection.files.length;
      
      const audio = new Audio(collection.files[soundIndex]);
      audio.volume = trigger.volume * (settings.sound?.globalVolume || 0.85);
      await audio.play();
      
      // Update index for cyclic mode
      if (trigger.playMode === 'cyclic') {
        updateSoundTrigger(trigger.id, {
          currentIndex: (trigger.currentIndex + 1) % collection.files.length
        });
      }
    } catch (error) {
      console.error('Failed to play sound:', error);
    } finally {
      setTimeout(() => setTestingSound(null), 300);
    }
  };

  // Update keywords from input
  const handleKeywordsChange = (triggerId: string, keywordsStr: string) => {
    const keywords = keywordsStr
      .split(',')
      .map(k => k.trim().toLowerCase())
      .filter(k => k.length > 0);
    
    const trigger = soundTriggers.find(t => t.id === triggerId);
    if (!trigger) return;

    const keywordsEnabled: Record<string, boolean> = {};
    keywords.forEach(kw => {
      keywordsEnabled[kw] = trigger.keywordsEnabled[kw] ?? true;
    });

    updateSoundTrigger(triggerId, { keywords, keywordsEnabled });
  };

  return (
    <div className="space-y-6">
      {/* Global Settings */}
      <div className="p-4 rounded-lg border bg-muted/30 space-y-4">
        <h4 className="font-medium flex items-center gap-2">
          <Volume2 className="w-4 h-4" />
          Global Sound Settings
        </h4>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Enable Sounds</Label>
            <Switch
              checked={settings.sound?.enabled ?? true}
              onCheckedChange={(checked) => 
                updateSettings({ 
                  sound: { ...settings.sound, enabled: checked } 
                })
              }
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Label className="text-sm">Realtime Detection</Label>
            <Switch
              checked={settings.sound?.realtimeEnabled ?? true}
              onCheckedChange={(checked) => 
                updateSettings({ 
                  sound: { ...settings.sound, realtimeEnabled: checked } 
                })
              }
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Global Volume</span>
            <span>{Math.round((settings.sound?.globalVolume ?? 0.85) * 100)}%</span>
          </div>
          <Slider
            value={[(settings.sound?.globalVolume ?? 0.85) * 100]}
            min={0}
            max={100}
            step={1}
            onValueChange={([value]) => 
              updateSettings({ 
                sound: { ...settings.sound, globalVolume: value / 100 } 
              })
            }
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Max Sounds Per Message</Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={settings.sound?.maxSoundsPerMessage ?? 3}
              onChange={(e) => 
                updateSettings({ 
                  sound: { ...settings.sound, maxSoundsPerMessage: parseInt(e.target.value) || 3 } 
                })
              }
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Global Cooldown (ms)</Label>
            <Input
              type="number"
              min={0}
              step={50}
              value={settings.sound?.globalCooldown ?? 150}
              onChange={(e) => 
                updateSettings({ 
                  sound: { ...settings.sound, globalCooldown: parseInt(e.target.value) || 150 } 
                })
              }
              className="mt-1"
            />
          </div>
        </div>
      </div>

      {/* Triggers List */}
      <div className="flex items-center justify-between">
        <h4 className="font-medium flex items-center gap-2">
          <Zap className="w-4 h-4" />
          Sound Triggers ({soundTriggers.length})
        </h4>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchCollections}
            disabled={isLoading}
          >
            <RefreshCw className={cn("w-4 h-4 mr-1", isLoading && "animate-spin")} />
            Update Collections
          </Button>
          <Button size="sm" onClick={handleAddTrigger}>
            <Plus className="w-4 h-4 mr-1" />
            Add Trigger
          </Button>
        </div>
      </div>

      {/* Collections Info */}
      <div className="p-3 rounded-lg bg-muted/50 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Music className="w-4 h-4" />
          {isLoading ? (
            <span>Loading collections...</span>
          ) : (
            <>
              <span>{soundCollections.length} collections available</span>
              <span className="text-xs">({soundCollections.reduce((acc, c) => acc + c.files.length, 0)} sounds total)</span>
            </>
          )}
        </div>
      </div>

      {/* No Collections Warning */}
      {!isLoading && soundCollections.length === 0 && (
        <div className="p-4 rounded-lg border border-yellow-500/50 bg-yellow-500/10 text-sm">
          <p className="font-medium text-yellow-500">No sound collections found</p>
          <p className="text-muted-foreground mt-1">
            Add sound files to <code className="bg-muted px-1 rounded">public/sounds/</code> folder and click "Update Collections"
          </p>
        </div>
      )}

      {/* Triggers Accordion */}
      {soundTriggers.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <VolumeX className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No sound triggers configured</p>
          <p className="text-xs mt-1">Add a trigger to play sounds based on keywords</p>
        </div>
      ) : (
        <ScrollArea className="h-[400px] pr-4">
          <Accordion
            type="multiple"
            value={expandedTriggers}
            onValueChange={setExpandedTriggers}
            className="space-y-2"
          >
            {soundTriggers.map((trigger) => {
              const collection = soundCollections.find(c => c.name === trigger.collection);
              
              return (
                <AccordionItem
                  key={trigger.id}
                  value={trigger.id}
                  className="border rounded-lg data-[state=open]:bg-muted/20"
                >
                  <AccordionTrigger className="px-4 py-3 hover:no-underline">
                    <div className="flex items-center gap-3 w-full">
                      <div
                        className={cn(
                          "w-2 h-2 rounded-full",
                          trigger.active ? "bg-green-500" : "bg-muted-foreground"
                        )}
                      />
                      <span className="font-medium">{trigger.name}</span>
                      <span className="text-xs text-muted-foreground ml-auto mr-2">
                        {trigger.keywords.length} keywords · {collection?.files.length || 0} sounds
                      </span>
                    </div>
                  </AccordionTrigger>
                  
                  <AccordionContent className="px-4 pb-4">
                    <div className="space-y-4 pt-2">
                      {/* Trigger Name & Active Toggle */}
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <Label className="text-xs">Trigger Name</Label>
                          <Input
                            value={trigger.name}
                            onChange={(e) => updateSoundTrigger(trigger.id, { name: e.target.value })}
                            className="mt-1"
                          />
                        </div>
                        <div className="flex items-center gap-2 pt-4">
                          <Label className="text-sm">Active</Label>
                          <Switch
                            checked={trigger.active}
                            onCheckedChange={() => toggleSoundTrigger(trigger.id)}
                          />
                        </div>
                      </div>

                      {/* Keywords */}
                      <div className="space-y-2">
                        <Label className="text-xs">Keywords (comma-separated)</Label>
                        <Input
                          value={trigger.keywords.join(', ')}
                          onChange={(e) => handleKeywordsChange(trigger.id, e.target.value)}
                          placeholder="golpe, impact, punch..."
                          className="mt-1"
                        />
                        
                        {/* Keyword Toggles */}
                        {trigger.keywords.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {trigger.keywords.map((keyword) => (
                              <button
                                key={keyword}
                                onClick={() => toggleSoundKeyword(trigger.id, keyword)}
                                className={cn(
                                  "px-2 py-1 rounded text-xs transition-colors",
                                  trigger.keywordsEnabled[keyword]
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted text-muted-foreground line-through"
                                )}
                              >
                                {keyword}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Collection & Play Mode */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs">Sound Collection</Label>
                          <Select
                            value={trigger.collection}
                            onValueChange={(value) => updateSoundTrigger(trigger.id, { collection: value })}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Select collection" />
                            </SelectTrigger>
                            <SelectContent>
                              {soundCollections.map((col) => (
                                <SelectItem key={col.name} value={col.name}>
                                  {col.name === '__root__' ? 'Root Sounds' : col.name}
                                  <span className="text-xs text-muted-foreground ml-1">
                                    ({col.files.length})
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div>
                          <Label className="text-xs">Play Mode</Label>
                          <Select
                            value={trigger.playMode}
                            onValueChange={(value: 'random' | 'cyclic') => 
                              updateSoundTrigger(trigger.id, { playMode: value })
                            }
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="random">Random</SelectItem>
                              <SelectItem value="cyclic">Cyclic (in order)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Volume */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Volume</span>
                          <span>{Math.round(trigger.volume * 100)}%</span>
                        </div>
                        <Slider
                          value={[trigger.volume * 100]}
                          min={0}
                          max={100}
                          step={1}
                          onValueChange={([value]) => 
                            updateSoundTrigger(trigger.id, { volume: value / 100 })
                          }
                        />
                      </div>

                      {/* Cooldown & Delay */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs">Cooldown (ms)</Label>
                          <Input
                            type="number"
                            min={0}
                            step={100}
                            value={trigger.cooldown}
                            onChange={(e) => 
                              updateSoundTrigger(trigger.id, { cooldown: parseInt(e.target.value) || 0 })
                            }
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Delay (ms)</Label>
                          <Input
                            type="number"
                            min={0}
                            step={50}
                            value={trigger.delay}
                            onChange={(e) => 
                              updateSoundTrigger(trigger.id, { delay: parseInt(e.target.value) || 0 })
                            }
                            className="mt-1"
                          />
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTestSound(trigger)}
                          disabled={testingSound === trigger.id || !collection?.files.length}
                        >
                          <Play className={cn(
                            "w-4 h-4 mr-1",
                            testingSound === trigger.id && "animate-pulse"
                          )} />
                          Test
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => cloneSoundTrigger(trigger.id)}
                        >
                          <Copy className="w-4 h-4 mr-1" />
                          Clone
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteSoundTrigger(trigger.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </ScrollArea>
      )}
    </div>
  );
}
