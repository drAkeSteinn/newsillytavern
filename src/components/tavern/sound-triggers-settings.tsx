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
      name: `Nuevo Trigger ${soundTriggers.length + 1}`,
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
    <div className="h-full flex flex-col gap-4">
      {/* Global Settings */}
      <div className="p-4 rounded-lg border bg-muted/30 space-y-4 flex-shrink-0">
        <h4 className="font-medium flex items-center gap-2">
          <Volume2 className="w-4 h-4" />
          Configuración Global de Sonidos
        </h4>
        
        <div className="grid grid-cols-4 gap-4">
          <label className="flex items-center justify-between p-2 rounded border bg-background">
            <span className="text-sm">Habilitar</span>
            <Switch
              checked={settings.sound?.enabled ?? true}
              onCheckedChange={(checked) => 
                updateSettings({ 
                  sound: { ...settings.sound, enabled: checked } 
                })
              }
            />
          </label>
          
          <label className="flex items-center justify-between p-2 rounded border bg-background">
            <span className="text-sm">Tiempo Real</span>
            <Switch
              checked={settings.sound?.realtimeEnabled ?? true}
              onCheckedChange={(checked) => 
                updateSettings({ 
                  sound: { ...settings.sound, realtimeEnabled: checked } 
                })
              }
            />
          </label>

          <div className="col-span-2">
            <div className="flex justify-between text-sm mb-1">
              <span>Volumen Global</span>
              <span className="text-muted-foreground">{Math.round((settings.sound?.globalVolume ?? 0.85) * 100)}%</span>
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
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label className="text-xs">Máx. Sonidos/Mensaje</Label>
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
              className="mt-1 h-8"
            />
          </div>
          <div>
            <Label className="text-xs">Enfriamiento Global (ms)</Label>
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
              className="mt-1 h-8"
            />
          </div>
          <div className="flex items-end">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchCollections}
              disabled={isLoading}
              className="w-full h-8"
            >
              <RefreshCw className={cn("w-3.5 h-3.5 mr-1", isLoading && "animate-spin")} />
              Actualizar
            </Button>
          </div>
        </div>
      </div>

      {/* Triggers Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <h4 className="font-medium flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Triggers de Sonido ({soundTriggers.length})
          </h4>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Music className="w-4 h-4" />
            {isLoading ? (
              <span>Cargando...</span>
            ) : (
              <>
                <span>{soundCollections.length} colecciones</span>
                <span className="text-xs">({soundCollections.reduce((acc, c) => acc + c.files.length, 0)} sonidos)</span>
              </>
            )}
          </div>
        </div>
        <Button size="sm" onClick={handleAddTrigger}>
          <Plus className="w-4 h-4 mr-1" />
          Agregar Trigger
        </Button>
      </div>

      {/* No Collections Warning */}
      {!isLoading && soundCollections.length === 0 && (
        <div className="p-4 rounded-lg border border-yellow-500/50 bg-yellow-500/10 text-sm flex-shrink-0">
          <p className="font-medium text-yellow-500">No se encontraron colecciones de sonidos</p>
          <p className="text-muted-foreground mt-1">
            Agrega archivos a <code className="bg-muted px-1 rounded">public/sounds/</code> y haz clic en "Actualizar"
          </p>
        </div>
      )}

      {/* Triggers Accordion */}
      {soundTriggers.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <VolumeX className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No hay triggers de sonido configurados</p>
            <p className="text-xs mt-1">Agrega un trigger para reproducir sonidos basados en palabras clave</p>
          </div>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <Accordion
            type="multiple"
            value={expandedTriggers}
            onValueChange={setExpandedTriggers}
            className="space-y-2 pr-4"
          >
            {soundTriggers.map((trigger) => {
              const collection = soundCollections.find(c => c.name === trigger.collection);
              
              return (
                <AccordionItem
                  key={trigger.id}
                  value={trigger.id}
                  className="border rounded-lg data-[state=open]:bg-muted/10"
                >
                  <AccordionTrigger className="px-4 py-2 hover:no-underline">
                    <div className="flex items-center gap-3 w-full">
                      <div
                        className={cn(
                          "w-2 h-2 rounded-full flex-shrink-0",
                          trigger.active ? "bg-green-500" : "bg-muted-foreground"
                        )}
                      />
                      <span className="font-medium text-sm">{trigger.name}</span>
                      <span className="text-xs text-muted-foreground ml-auto mr-2">
                        {trigger.keywords.length} claves · {collection?.files.length || 0} sonidos
                      </span>
                    </div>
                  </AccordionTrigger>
                  
                  <AccordionContent className="px-4 pb-4">
                    <div className="space-y-3 pt-2">
                      {/* Row 1: Name, Active, Collection, Play Mode */}
                      <div className="grid grid-cols-4 gap-3">
                        <div>
                          <Label className="text-xs">Nombre</Label>
                          <Input
                            value={trigger.name}
                            onChange={(e) => updateSoundTrigger(trigger.id, { name: e.target.value })}
                            className="mt-1 h-8"
                          />
                        </div>
                        <div className="flex items-end pb-1">
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <Switch
                              checked={trigger.active}
                              onCheckedChange={() => toggleSoundTrigger(trigger.id)}
                            />
                            Activo
                          </label>
                        </div>
                        <div>
                          <Label className="text-xs">Colección</Label>
                          <Select
                            value={trigger.collection}
                            onValueChange={(value) => updateSoundTrigger(trigger.id, { collection: value })}
                          >
                            <SelectTrigger className="mt-1 h-8">
                              <SelectValue placeholder="Seleccionar" />
                            </SelectTrigger>
                            <SelectContent>
                              {soundCollections.map((col) => (
                                <SelectItem key={col.name} value={col.name}>
                                  {col.name === '__root__' ? 'Raíz' : col.name}
                                  <span className="text-xs text-muted-foreground ml-1">
                                    ({col.files.length})
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Modo</Label>
                          <Select
                            value={trigger.playMode}
                            onValueChange={(value: 'random' | 'cyclic') => 
                              updateSoundTrigger(trigger.id, { playMode: value })
                            }
                          >
                            <SelectTrigger className="mt-1 h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="random">Aleatorio</SelectItem>
                              <SelectItem value="cyclic">Cíclico</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Row 2: Keywords */}
                      <div className="space-y-1.5">
                        <Label className="text-xs">Palabras Clave (separadas por coma)</Label>
                        <Input
                          value={trigger.keywords.join(', ')}
                          onChange={(e) => handleKeywordsChange(trigger.id, e.target.value)}
                          placeholder="golpe, impacto, puño..."
                          className="h-8"
                        />
                        {trigger.keywords.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {trigger.keywords.map((keyword) => (
                              <button
                                key={keyword}
                                onClick={() => toggleSoundKeyword(trigger.id, keyword)}
                                className={cn(
                                  "px-2 py-0.5 rounded text-xs transition-colors",
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

                      {/* Row 3: Volume, Cooldown, Delay */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span>Volumen</span>
                            <span className="text-muted-foreground">{Math.round(trigger.volume * 100)}%</span>
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
                        <div>
                          <Label className="text-xs">Enfriamiento (ms)</Label>
                          <Input
                            type="number"
                            min={0}
                            step={100}
                            value={trigger.cooldown}
                            onChange={(e) => 
                              updateSoundTrigger(trigger.id, { cooldown: parseInt(e.target.value) || 0 })
                            }
                            className="mt-1 h-8"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Retardo (ms)</Label>
                          <Input
                            type="number"
                            min={0}
                            step={50}
                            value={trigger.delay}
                            onChange={(e) => 
                              updateSoundTrigger(trigger.id, { delay: parseInt(e.target.value) || 0 })
                            }
                            className="mt-1 h-8"
                          />
                        </div>
                      </div>

                      {/* Row 4: Actions */}
                      <div className="flex gap-2 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleTestSound(trigger)}
                          disabled={testingSound === trigger.id || !collection?.files.length}
                        >
                          <Play className={cn(
                            "w-3 h-3 mr-1",
                            testingSound === trigger.id && "animate-pulse"
                          )} />
                          Probar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => cloneSoundTrigger(trigger.id)}
                        >
                          <Copy className="w-3 h-3 mr-1" />
                          Clonar
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => deleteSoundTrigger(trigger.id)}
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Eliminar
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
