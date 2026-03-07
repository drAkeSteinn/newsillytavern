'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTavernStore } from '@/store/tavern-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { SoundTrigger, SoundCollection, SoundSequenceTrigger } from '@/types';
import { getLogger } from '@/lib/logger';
import {
  Plus,
  Play,
  Copy,
  Trash2,
  RefreshCw,
  Volume2,
  VolumeX,
  Zap,
  Music,
  ListMusic,
  HelpCircle,
  GripVertical,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export function SoundTriggersSettings() {
  const soundLogger = getLogger('sound');
  const {
    soundTriggers,
    soundCollections,
    soundSequenceTriggers,
    settings,
    addSoundTrigger,
    updateSoundTrigger,
    deleteSoundTrigger,
    cloneSoundTrigger,
    toggleSoundTrigger,
    toggleSoundKeyword,
    setSoundCollections,
    updateSettings,
    addSoundSequenceTrigger,
    updateSoundSequenceTrigger,
    deleteSoundSequenceTrigger,
    cloneSoundSequenceTrigger,
    toggleSoundSequenceTrigger,
  } = useTavernStore();

  const [isLoading, setIsLoading] = useState(false);
  const [expandedTriggers, setExpandedTriggers] = useState<string[]>([]);
  const [expandedSequences, setExpandedSequences] = useState<string[]>([]);
  const [testingSound, setTestingSound] = useState<string | null>(null);
  const [newKeywordInput, setNewKeywordInput] = useState<Record<string, string>>({});

  // Fetch sound collections
  const fetchCollections = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/sounds/collections');
      const data = await response.json();
      soundLogger.debug('Loaded sound collections', { count: data.collections?.length || 0 });
      setSoundCollections(data.collections);
    } catch (error) {
      soundLogger.error('Failed to fetch sound collections', { error });
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
      cooldown: 0,  // 0 = no cooldown, play all sounds
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
      soundLogger.error('Failed to play sound', { error });
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
              max={20}
              value={settings.sound?.maxSoundsPerMessage ?? 10}
              onChange={(e) => 
                updateSettings({ 
                  sound: { ...settings.sound, maxSoundsPerMessage: parseInt(e.target.value) || 10 } 
                })
              }
              className="mt-1 h-8"
            />
            <p className="text-xs text-muted-foreground mt-1">0 = sin límite</p>
          </div>
          <div>
            <Label className="text-xs">Enfriamiento Global (ms)</Label>
            <Input
              type="number"
              min={0}
              step={50}
              value={settings.sound?.globalCooldown ?? 0}
              onChange={(e) => 
                updateSettings({ 
                  sound: { ...settings.sound, globalCooldown: parseInt(e.target.value) || 0 } 
                })
              }
              className="mt-1 h-8"
            />
            <p className="text-xs text-muted-foreground mt-1">0 = sin límite</p>
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
                            value={trigger.cooldown ?? 0}
                            onChange={(e) => 
                              updateSoundTrigger(trigger.id, { cooldown: parseInt(e.target.value) || 0 })
                            }
                            className="mt-1 h-8"
                          />
                          <p className="text-xs text-muted-foreground mt-0.5">0 = sin límite</p>
                        </div>
                        <div>
                          <Label className="text-xs">Retardo (ms)</Label>
                          <Input
                            type="number"
                            min={0}
                            step={50}
                            value={trigger.delay ?? 0}
                            onChange={(e) => 
                              updateSoundTrigger(trigger.id, { delay: parseInt(e.target.value) || 0 })
                            }
                            className="mt-1 h-8"
                          />
                          <p className="text-xs text-muted-foreground mt-0.5">Pausa antes de reproducir</p>
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

      {/* Divider */}
      <div className="border-t my-6" />

      {/* Sound Sequence Triggers Section */}
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListMusic className="w-5 h-5 text-purple-500" />
            <h4 className="font-medium flex items-center gap-2">
              Triggers de Secuencia de Sonido
              <Badge variant="outline" className="text-xs">
                {soundSequenceTriggers.length}
              </Badge>
            </h4>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-sm">
                <p>Los triggers de secuencia reproducen múltiples sonidos en orden cuando se detecta la key de activación en la respuesta del LLM.</p>
                <p className="mt-1 text-xs text-muted-foreground">Cada item en la secuencia referencia un trigger de sonido existente por su keyword.</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <Button size="sm" onClick={() => {
            addSoundSequenceTrigger({
              name: `Nueva Secuencia ${soundSequenceTriggers.length + 1}`,
              active: true,
              activationKey: '',
              sequence: [],
              volume: 1,
              delayBetween: 0,
              cooldown: 0,
            });
          }}>
            <Plus className="w-4 h-4 mr-1" />
            Nueva Secuencia
          </Button>
        </div>

        {/* Sequence Triggers List */}
        {soundSequenceTriggers.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground border rounded-lg bg-muted/20">
            <ListMusic className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No hay triggers de secuencia configurados</p>
            <p className="text-xs mt-1">Crea una secuencia para reproducir múltiples sonidos con un solo trigger</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            <Accordion type="multiple" className="space-y-2">
              {soundSequenceTriggers.map((sequence, index) => {
                const isExpanded = expandedSequences.includes(sequence.id);
                const availableKeywords = soundTriggers
                  .filter(t => t.active)
                  .flatMap(t => t.keywords);

                return (
                  <AccordionItem key={sequence.id} value={sequence.id} className="border rounded-lg bg-muted/30">
                    <AccordionTrigger
                      className="px-4 py-3 hover:no-underline hover:bg-muted/50"
                      onClick={() => {
                        setExpandedSequences(prev =>
                          prev.includes(sequence.id)
                            ? prev.filter(e => e !== sequence.id)
                            : [...prev, sequence.id]
                        );
                      }}
                    >
                      <div className="flex items-center gap-2 flex-1">
                        <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                        <Zap className={cn(
                          "w-4 h-4",
                          sequence.active ? "text-purple-500" : "text-muted-foreground"
                        )} />
                        <span className="font-medium">
                          {sequence.name || `Secuencia #${index + 1}`}
                        </span>
                        {sequence.activationKey && (
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                            {sequence.activationKey}
                          </code>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {sequence.sequence.length} sonidos
                        </Badge>
                      </div>
                    </AccordionTrigger>

                    <AccordionContent className="px-4 pb-4">
                      <div className="space-y-4 pt-2">
                        {/* Row 1: Name and Active */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs mb-1 block">Nombre</Label>
                            <Input
                              value={sequence.name}
                              onChange={(e) =>
                                updateSoundSequenceTrigger(sequence.id, { name: e.target.value })
                              }
                              placeholder="Nombre de la secuencia"
                              className="h-8"
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label className="text-xs">Activo</Label>
                            <Switch
                              checked={sequence.active}
                              onCheckedChange={() => toggleSoundSequenceTrigger(sequence.id)}
                            />
                          </div>
                        </div>

                        {/* Row 2: Activation Key */}
                        <div className="space-y-2 p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                          <div className="flex items-center gap-2">
                            <Zap className="w-4 h-4 text-purple-400" />
                            <Label className="text-xs font-medium text-purple-400">Key de Activación</Label>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs text-muted-foreground mb-1 block">Key principal</Label>
                              <Input
                                value={sequence.activationKey || ''}
                                onChange={(e) =>
                                  updateSoundSequenceTrigger(sequence.id, {
                                    activationKey: e.target.value.toLowerCase().replace(/\s+/g, '_') || undefined,
                                  })
                                }
                                placeholder="secuencia1, combo"
                                className="h-8 font-mono text-xs"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground mb-1 block">Keys alternativas</Label>
                              <Input
                                value={(sequence.activationKeys || []).join(', ')}
                                onChange={(e) => {
                                  const keys = e.target.value.split(',').map(k => k.trim().toLowerCase().replace(/\s+/g, '_')).filter(Boolean);
                                  updateSoundSequenceTrigger(sequence.id, {
                                    activationKeys: keys.length > 0 ? keys : undefined,
                                  });
                                }}
                                placeholder="seq1, combo1"
                                className="h-8 text-xs"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Row 3: Sequence */}
                        <div className="space-y-2">
                          <Label className="text-xs flex items-center gap-1">
                            Secuencia de Sonidos
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p>Lista de keywords de triggers de sonido existentes. Cada uno se reproducirá en orden.</p>
                              </TooltipContent>
                            </Tooltip>
                          </Label>

                          {/* Current sequence */}
                          <div className="space-y-1">
                            {sequence.sequence.map((keyword, kwIndex) => (
                              <div
                                key={kwIndex}
                                className="flex items-center gap-2 bg-muted/50 rounded p-2"
                              >
                                <span className="text-xs text-muted-foreground w-6">{kwIndex + 1}.</span>
                                <Badge variant="secondary" className="font-mono">
                                  {keyword}
                                </Badge>
                                <div className="flex-1" />
                                {kwIndex > 0 && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => {
                                      const newSeq = [...sequence.sequence];
                                      const [removed] = newSeq.splice(kwIndex, 1);
                                      newSeq.splice(kwIndex - 1, 0, removed);
                                      updateSoundSequenceTrigger(sequence.id, { sequence: newSeq });
                                    }}
                                  >
                                    <ChevronUp className="w-3 h-3" />
                                  </Button>
                                )}
                                {kwIndex < sequence.sequence.length - 1 && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => {
                                      const newSeq = [...sequence.sequence];
                                      const [removed] = newSeq.splice(kwIndex, 1);
                                      newSeq.splice(kwIndex + 1, 0, removed);
                                      updateSoundSequenceTrigger(sequence.id, { sequence: newSeq });
                                    }}
                                  >
                                    <ChevronDown className="w-3 h-3" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => {
                                    updateSoundSequenceTrigger(sequence.id, {
                                      sequence: sequence.sequence.filter((_, i) => i !== kwIndex),
                                    });
                                  }}
                                >
                                  <Trash2 className="w-3 h-3 text-destructive" />
                                </Button>
                              </div>
                            ))}
                            {sequence.sequence.length === 0 && (
                              <p className="text-xs text-muted-foreground italic p-2">Sin sonidos en la secuencia</p>
                            )}
                          </div>

                          {/* Add keyword input */}
                          <div className="flex gap-2">
                            <Input
                              value={newKeywordInput[sequence.id] || ''}
                              onChange={(e) =>
                                setNewKeywordInput(prev => ({ ...prev, [sequence.id]: e.target.value }))
                              }
                              placeholder="Agregar keyword de sonido..."
                              className="h-8 text-xs"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && (newKeywordInput[sequence.id]?.trim())) {
                                  updateSoundSequenceTrigger(sequence.id, {
                                    sequence: [...sequence.sequence, newKeywordInput[sequence.id].trim()],
                                  });
                                  setNewKeywordInput(prev => ({ ...prev, [sequence.id]: '' }));
                                }
                              }}
                              list={`available-keywords-${sequence.id}`}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8"
                              onClick={() => {
                                if (newKeywordInput[sequence.id]?.trim()) {
                                  updateSoundSequenceTrigger(sequence.id, {
                                    sequence: [...sequence.sequence, newKeywordInput[sequence.id].trim()],
                                  });
                                  setNewKeywordInput(prev => ({ ...prev, [sequence.id]: '' }));
                                }
                              }}
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          </div>

                          <datalist id={`available-keywords-${sequence.id}`}>
                            {availableKeywords.map((kw, i) => (
                              <option key={i} value={kw} />
                            ))}
                          </datalist>

                          {/* Quick add suggestions */}
                          {availableKeywords.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              <span className="text-xs text-muted-foreground mr-1">Sugerencias:</span>
                              {availableKeywords.slice(0, 6).map((kw, i) => (
                                <Button
                                  key={i}
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-[10px] px-2"
                                  onClick={() => {
                                    updateSoundSequenceTrigger(sequence.id, {
                                      sequence: [...sequence.sequence, kw],
                                    });
                                  }}
                                >
                                  +{kw}
                                </Button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Row 4: Volume, Delay, Cooldown */}
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span>Volumen</span>
                              <span className="text-muted-foreground">{Math.round(sequence.volume * 100)}%</span>
                            </div>
                            <Slider
                              value={[sequence.volume * 100]}
                              min={0}
                              max={100}
                              step={1}
                              onValueChange={([value]) =>
                                updateSoundSequenceTrigger(sequence.id, { volume: value / 100 })
                              }
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Delay entre sonidos (ms)</Label>
                            <Input
                              type="number"
                              min={0}
                              step={50}
                              value={sequence.delayBetween ?? 0}
                              onChange={(e) =>
                                updateSoundSequenceTrigger(sequence.id, { delayBetween: parseInt(e.target.value) || 0 })
                              }
                              className="mt-1 h-8"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Cooldown (ms)</Label>
                            <Input
                              type="number"
                              min={0}
                              step={100}
                              value={sequence.cooldown ?? 0}
                              onChange={(e) =>
                                updateSoundSequenceTrigger(sequence.id, { cooldown: parseInt(e.target.value) || 0 })
                              }
                              className="mt-1 h-8"
                            />
                          </div>
                        </div>

                        {/* Row 5: Actions */}
                        <div className="flex gap-2 pt-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => cloneSoundSequenceTrigger(sequence.id)}
                          >
                            <Copy className="w-3 h-3 mr-1" />
                            Clonar
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => deleteSoundSequenceTrigger(sequence.id)}
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
    </div>
  );
}
