'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import {
  Plus,
  Trash2,
  Edit,
  Zap,
  Image as ImageIcon,
  X,
  Loader2,
  Timer,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';
import type { CharacterCard, SpriteState, CharacterSpriteTrigger, SpriteIndexEntry, ReturnToMode } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { SpritePreview } from './sprite-preview';

interface CharacterTriggerEditorProps {
  character: CharacterCard;
  onChange: (updates: Partial<CharacterCard>) => void;
}

const CUSTOM_SPRITE_VALUE = '__custom__';

// Only standard states + custom sprite option
const SPRITE_STATES: { value: SpriteState | typeof CUSTOM_SPRITE_VALUE; label: string }[] = [
  { value: CUSTOM_SPRITE_VALUE, label: 'Personalizado (Sprite)' },
  { value: 'idle', label: 'Idle (reposo)' },
  { value: 'talk', label: 'Talk (hablando)' },
  { value: 'thinking', label: 'Thinking (pensando)' },
];

// Return to mode options
const RETURN_TO_MODES: { value: ReturnToMode; label: string; description: string }[] = [
  { 
    value: 'idle_collection', 
    label: 'Colección Idle', 
    description: 'Retorna al sprite de la colección Idle (según su configuración: Principal, Aleatorio, Lista)' 
  },
  { 
    value: 'custom_sprite', 
    label: 'Sprite Personalizado', 
    description: 'Retorna a un sprite específico de la colección' 
  },
];

export function CharacterTriggerEditor({ character, onChange }: CharacterTriggerEditorProps) {
  // Get triggers from character data
  const triggers: CharacterSpriteTrigger[] = character.spriteTriggers || [];
  
  const [editingTrigger, setEditingTrigger] = useState<CharacterSpriteTrigger | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [newKeyword, setNewKeyword] = useState('');
  const [availableSprites, setAvailableSprites] = useState<SpriteIndexEntry[]>([]);
  const [loadingSprites, setLoadingSprites] = useState(false);

  // Load available sprites from character's collection
  useEffect(() => {
    const loadSprites = async () => {
      setLoadingSprites(true);
      try {
        const response = await fetch('/api/sprites/index');
        const data = await response.json();
        
        // Filter by character's selected collection
        const collectionName = character.spriteConfig?.collection;
        if (collectionName && data.sprites) {
          setAvailableSprites(data.sprites.filter((s: SpriteIndexEntry) => s.pack === collectionName));
        } else {
          setAvailableSprites(data.sprites || []);
        }
      } catch (error) {
        console.error('Error loading sprites:', error);
        setAvailableSprites([]);
      } finally {
        setLoadingSprites(false);
      }
    };

    if (showEditor) {
      loadSprites();
    }
  }, [showEditor, character.spriteConfig?.collection]);

  const updateTriggers = (newTriggers: CharacterSpriteTrigger[]) => {
    onChange({
      spriteTriggers: newTriggers,
    });
  };

  const handleAddTrigger = () => {
    const newTrigger: CharacterSpriteTrigger = {
      id: uuidv4(),
      title: 'Nuevo Trigger',
      active: true,
      keywords: [],
      requirePipes: true,
      caseSensitive: false,
      spriteUrl: '',
      spriteState: '',
      returnToIdleMs: 3000,
      returnToMode: 'idle_collection',
      returnToSpriteUrl: '',
      cooldownMs: 1000,
      priority: 1,
    };
    setEditingTrigger(newTrigger);
    setShowEditor(true);
  };

  const handleEditTrigger = (trigger: CharacterSpriteTrigger) => {
    setEditingTrigger({ ...trigger });
    setShowEditor(true);
  };

  const handleDeleteTrigger = (id: string) => {
    updateTriggers(triggers.filter(t => t.id !== id));
  };

  const handleSaveTrigger = () => {
    if (!editingTrigger) return;
    
    const existingIndex = triggers.findIndex(t => t.id === editingTrigger.id);
    if (existingIndex >= 0) {
      // Update existing
      const newTriggers = [...triggers];
      newTriggers[existingIndex] = editingTrigger;
      updateTriggers(newTriggers);
    } else {
      // Add new
      updateTriggers([...triggers, editingTrigger]);
    }
    
    setEditingTrigger(null);
    setShowEditor(false);
  };

  const handleAddKeyword = () => {
    if (!editingTrigger || !newKeyword.trim()) return;
    
    const keyword = newKeyword.trim().toLowerCase();
    if (!editingTrigger.keywords.includes(keyword)) {
      setEditingTrigger({
        ...editingTrigger,
        keywords: [...editingTrigger.keywords, keyword],
      });
    }
    setNewKeyword('');
  };

  const handleRemoveKeyword = (keyword: string) => {
    if (!editingTrigger) return;
    setEditingTrigger({
      ...editingTrigger,
      keywords: editingTrigger.keywords.filter(k => k !== keyword),
    });
  };

  // Get sprite preview URL from trigger
  const getSpritePreviewUrl = (trigger: CharacterSpriteTrigger) => {
    // If it's a state reference
    if (trigger.spriteState && trigger.spriteState !== CUSTOM_SPRITE_VALUE) {
      // Get from state collections first
      const stateCollection = character.spriteConfig?.stateCollections?.[trigger.spriteState as SpriteState];
      if (stateCollection && stateCollection.entries.length > 0) {
        // Return principal sprite URL
        const principal = stateCollection.entries.find(e => e.role === 'principal');
        if (principal) return principal.spriteUrl;
        return stateCollection.entries[0]?.spriteUrl;
      }
      // Fall back to legacy sprites
      if (character.spriteConfig?.sprites?.[trigger.spriteState as SpriteState]) {
        return character.spriteConfig.sprites[trigger.spriteState as SpriteState];
      }
    }
    // Custom sprite URL
    return trigger.spriteUrl;
  };

  // Get sprite label for display
  const getSpriteLabel = (trigger: CharacterSpriteTrigger) => {
    if (trigger.spriteState && trigger.spriteState !== CUSTOM_SPRITE_VALUE) {
      return SPRITE_STATES.find(s => s.value === trigger.spriteState)?.label || trigger.spriteState;
    }
    if (trigger.spriteUrl) {
      // Find label from available sprites
      const sprite = availableSprites.find(s => s.url === trigger.spriteUrl);
      return sprite?.label || 'Sprite personalizado';
    }
    return 'Sin sprite';
  };

  // Format time for display
  const formatTime = (ms: number) => {
    if (ms <= 0) return 'Nunca';
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  };

  // Determine if we're in custom mode for trigger sprite
  const isCustomMode = !editingTrigger?.spriteState || editingTrigger.spriteState === '';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Triggers Simples</h3>
          <p className="text-xs text-muted-foreground">
            Sistema básico: cuando se detecta <strong>cualquier keyword</strong>, muestra el sprite asignado.
          </p>
        </div>
        <Button size="sm" onClick={handleAddTrigger}>
          <Plus className="w-4 h-4 mr-1" />
          Agregar
        </Button>
      </div>
      
      {/* How it works */}
      <div className="text-xs bg-muted/50 border rounded-lg p-3 space-y-2">
        <div className="flex items-center gap-2 font-medium text-foreground">
          <Zap className="w-4 h-4 text-amber-500" />
          ¿Cómo funciona?
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 bg-background rounded border">
            <div className="font-mono text-xs">|happy|</div>
            <div className="text-muted-foreground text-[10px] mt-1">Detectado en chat</div>
          </div>
          <div className="flex items-center justify-center text-muted-foreground">→</div>
          <div className="p-2 bg-background rounded border">
            <div className="font-mono text-xs">happy.png</div>
            <div className="text-muted-foreground text-[10px] mt-1">Sprite mostrado</div>
          </div>
        </div>
        <p className="text-muted-foreground">
          Los triggers simples son ideales para emociones básicas. Para lógica más compleja, usa <strong>Packs</strong>.
        </p>
      </div>

      {/* Triggers List */}
      {triggers.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground border rounded-lg">
          <Zap className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No hay triggers configurados</p>
          <p className="text-xs mt-1">Los triggers permiten cambiar expresiones automáticamente</p>
        </div>
      ) : (
        <ScrollArea className="h-[300px]">
          <div className="space-y-2 pr-2">
            {triggers.map((trigger) => (
              <div
                key={trigger.id}
                className={cn(
                  "flex items-center gap-3 p-3 border rounded-lg",
                  !trigger.active && "opacity-50"
                )}
              >
                {/* Sprite Preview */}
                <div className="w-12 h-12 rounded border overflow-hidden bg-muted/50 flex items-center justify-center flex-shrink-0">
                  {getSpritePreviewUrl(trigger) ? (
                    <SpritePreview
                      src={getSpritePreviewUrl(trigger)!}
                      alt={trigger.title}
                      className="w-full h-full"
                      objectFit="contain"
                    />
                  ) : (
                    <ImageIcon className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{trigger.title}</span>
                    <Badge variant="outline" className="text-xs">
                      {getSpriteLabel(trigger)}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {trigger.keywords.slice(0, 4).map((kw) => (
                      <Badge key={kw} variant="secondary" className="text-xs">
                        {trigger.requirePipes ? `|${kw}|` : kw}
                      </Badge>
                    ))}
                    {trigger.keywords.length > 4 && (
                      <Badge variant="secondary" className="text-xs">
                        +{trigger.keywords.length - 4}
                      </Badge>
                    )}
                  </div>
                  {/* Return info */}
                  {trigger.returnToIdleMs > 0 && (
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                      <Timer className="w-3 h-3" />
                      <span>
                        Retorna en {formatTime(trigger.returnToIdleMs)} → 
                        {trigger.returnToMode === 'custom_sprite' ? ' Sprite personalizado' : ' Colección Idle'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <Switch
                    checked={trigger.active}
                    onCheckedChange={(active) => {
                      const newTriggers = triggers.map(t =>
                        t.id === trigger.id ? { ...t, active } : t
                      );
                      updateTriggers(newTriggers);
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleEditTrigger(trigger)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => handleDeleteTrigger(trigger.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Info Box */}
      <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg space-y-1">
        <p>💡 <strong>Pipes:</strong> Usa |keyword| para detectar solo cuando está entre pipes.</p>
        <p>💡 <strong>Prioridad:</strong> Los triggers con mayor prioridad tienen preferencia.</p>
        <p>💡 <strong>Return to Idle:</strong> Tiempo antes de retornar. Por defecto usa la Colección Idle.</p>
      </div>

      {/* Edit Dialog */}
      <AlertDialog open={showEditor} onOpenChange={setShowEditor}>
        <AlertDialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {editingTrigger?.id && triggers.find(t => t.id === editingTrigger.id)
                ? 'Editar Trigger'
                : 'Nuevo Trigger'}
            </AlertDialogTitle>
          </AlertDialogHeader>

          {editingTrigger && (
            <div className="space-y-4 py-4">
              {/* Title */}
              <div>
                <Label className="text-xs">Título</Label>
                <Input
                  value={editingTrigger.title}
                  onChange={(e) => setEditingTrigger({ ...editingTrigger, title: e.target.value })}
                  placeholder="Nombre del trigger"
                  className="mt-1 h-8"
                />
              </div>

              {/* Keywords */}
              <div>
                <Label className="text-xs">Palabras Clave</Label>
                <div className="flex gap-1.5 mt-1">
                  <Input
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    placeholder="Agregar palabra..."
                    onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
                    className="h-8 flex-1"
                  />
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleAddKeyword}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {editingTrigger.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {editingTrigger.keywords.map((kw) => (
                      <Badge key={kw} variant="secondary" className="gap-1 text-xs">
                        {kw}
                        <X
                          className="w-3 h-3 cursor-pointer"
                          onClick={() => handleRemoveKeyword(kw)}
                        />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Options Row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Requiere |pipes|</Label>
                  <Switch
                    checked={editingTrigger.requirePipes}
                    onCheckedChange={(requirePipes) => setEditingTrigger({ ...editingTrigger, requirePipes })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Cooldown</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      value={editingTrigger.cooldownMs}
                      onChange={(e) => setEditingTrigger({
                        ...editingTrigger,
                        cooldownMs: Math.max(0, parseInt(e.target.value) || 0),
                      })}
                      className="h-7 w-16 text-xs"
                    />
                    <span className="text-xs text-muted-foreground">ms</span>
                  </div>
                </div>
              </div>

              {/* Sprite Selection */}
              <div className="space-y-2">
                <Label className="text-xs">Sprite a Mostrar</Label>
                <Select
                  value={editingTrigger.spriteState || CUSTOM_SPRITE_VALUE}
                  onValueChange={(value) => setEditingTrigger({
                    ...editingTrigger,
                    spriteState: value === CUSTOM_SPRITE_VALUE ? '' : (value as SpriteState),
                    spriteUrl: value === CUSTOM_SPRITE_VALUE ? '' : '',
                  })}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Seleccionar sprite..." />
                  </SelectTrigger>
                  <SelectContent>
                    {SPRITE_STATES.map((state) => (
                      <SelectItem key={state.value} value={state.value}>
                        {state.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {/* Custom Sprite Dropdown - appears when "Personalizado" is selected */}
                {isCustomMode && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      Colección: <strong>{character.spriteConfig?.collection || 'default'}</strong>
                    </Label>
                    {loadingSprites ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : availableSprites.length === 0 ? (
                      <div className="text-xs text-muted-foreground text-center py-4 border rounded bg-muted/50">
                        No hay sprites en esta colección.
                      </div>
                    ) : (
                      <Select
                        value={editingTrigger.spriteUrl || ''}
                        onValueChange={(value) => setEditingTrigger({
                          ...editingTrigger,
                          spriteUrl: value,
                        })}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Seleccionar sprite..." />
                        </SelectTrigger>
                        <SelectContent>
                          {availableSprites.map((sprite) => (
                            <SelectItem key={sprite.label} value={sprite.url}>
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded overflow-hidden bg-muted/50 flex-shrink-0">
                                  <SpritePreview
                                    src={sprite.url}
                                    alt={sprite.label}
                                    className="w-full h-full"
                                    objectFit="contain"
                                  />
                                </div>
                                <span className="truncate">{sprite.label}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}
              </div>

              {/* Return to Idle Section */}
              <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <Timer className="w-4 h-4 text-blue-500" />
                  <Label className="text-xs font-medium">Retorno Automático</Label>
                </div>
                
                {/* Return Time */}
                <div>
                  <Label className="text-xs text-muted-foreground">Tiempo antes de retornar (0 = nunca)</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="number"
                      value={editingTrigger.returnToIdleMs}
                      onChange={(e) => setEditingTrigger({
                        ...editingTrigger,
                        returnToIdleMs: Math.max(0, parseInt(e.target.value) || 0),
                      })}
                      placeholder="0"
                      className="h-8 w-24"
                    />
                    <span className="text-xs text-muted-foreground">ms ({formatTime(editingTrigger.returnToIdleMs)})</span>
                  </div>
                </div>

                {/* Return Mode - only show if return time > 0 */}
                {editingTrigger.returnToIdleMs > 0 && (
                  <>
                    <div>
                      <Label className="text-xs text-muted-foreground">¿A dónde retornar?</Label>
                      <Select
                        value={editingTrigger.returnToMode || 'idle_collection'}
                        onValueChange={(value: ReturnToMode) => setEditingTrigger({
                          ...editingTrigger,
                          returnToMode: value,
                          returnToSpriteUrl: value === 'idle_collection' ? '' : editingTrigger.returnToSpriteUrl,
                        })}
                      >
                        <SelectTrigger className="h-8 mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {RETURN_TO_MODES.map((mode) => (
                            <SelectItem key={mode.value} value={mode.value}>
                              <div>
                                <div className="font-medium">{mode.label}</div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {RETURN_TO_MODES.find(m => m.value === (editingTrigger.returnToMode || 'idle_collection'))?.description}
                      </p>
                    </div>

                    {/* Custom Return Sprite - only show if return mode is 'custom_sprite' */}
                    {editingTrigger.returnToMode === 'custom_sprite' && (
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">
                          Sprite de retorno: <strong>{character.spriteConfig?.collection || 'default'}</strong>
                        </Label>
                        {loadingSprites ? (
                          <div className="flex items-center justify-center py-2">
                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                          </div>
                        ) : availableSprites.length === 0 ? (
                          <div className="text-xs text-muted-foreground text-center py-2 border rounded bg-muted/50">
                            No hay sprites disponibles
                          </div>
                        ) : (
                          <Select
                            value={editingTrigger.returnToSpriteUrl || ''}
                            onValueChange={(value) => setEditingTrigger({
                              ...editingTrigger,
                              returnToSpriteUrl: value,
                            })}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="Seleccionar sprite de retorno..." />
                            </SelectTrigger>
                            <SelectContent>
                              {availableSprites.map((sprite) => (
                                <SelectItem key={`return-${sprite.label}`} value={sprite.url}>
                                  <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 rounded overflow-hidden bg-muted/50 flex-shrink-0">
                                      <SpritePreview
                                        src={sprite.url}
                                        alt={sprite.label}
                                        className="w-full h-full"
                                        objectFit="contain"
                                      />
                                    </div>
                                    <ArrowRight className="w-3 h-3 text-muted-foreground" />
                                    <span className="truncate">{sprite.label}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        
                        {/* Preview return sprite */}
                        {editingTrigger.returnToSpriteUrl && (
                          <div className="flex items-center gap-2 p-2 border rounded bg-background">
                            <div className="w-8 h-8 rounded overflow-hidden bg-muted/50">
                              <SpritePreview
                                src={editingTrigger.returnToSpriteUrl}
                                alt="Return sprite"
                                className="w-full h-full"
                                objectFit="contain"
                              />
                            </div>
                            <div className="text-xs">
                              <div className="font-medium">
                                {availableSprites.find(s => s.url === editingTrigger.returnToSpriteUrl)?.label}
                              </div>
                              <div className="text-muted-foreground text-[10px]">
                                Retorno después de {formatTime(editingTrigger.returnToIdleMs)}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Preview: what will happen */}
                    <div className="flex items-center gap-2 p-2 border rounded bg-blue-500/10 border-blue-500/20">
                      <RefreshCw className="w-3 h-3 text-blue-500" />
                      <span className="text-[10px] text-blue-600">
                        {editingTrigger.returnToMode === 'custom_sprite' ? (
                          <>
                            Después de {formatTime(editingTrigger.returnToIdleMs)} → 
                            cambiará a "{availableSprites.find(s => s.url === editingTrigger.returnToSpriteUrl)?.label || 'sprite seleccionado'}"
                          </>
                        ) : (
                          <>
                            Después de {formatTime(editingTrigger.returnToIdleMs)} → 
                            retornará a la Colección Idle (siguiendo su configuración: Principal/Aleatorio/Lista)
                          </>
                        )}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Priority */}
              <div>
                <Label className="text-xs">Prioridad (mayor = más importante)</Label>
                <Input
                  type="number"
                  value={editingTrigger.priority}
                  onChange={(e) => setEditingTrigger({
                    ...editingTrigger,
                    priority: parseInt(e.target.value) || 1,
                  })}
                  placeholder="1"
                  className="mt-1 h-8"
                />
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setEditingTrigger(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveTrigger}>
              Guardar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
