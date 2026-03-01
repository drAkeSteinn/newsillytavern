'use client';

import { useState, useRef } from 'react';
import { useTavernStore } from '@/store/tavern-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { 
  Camera, 
  X, 
  Plus, 
  Sparkles, 
  FileText, 
  MessageSquare, 
  Mic,
  Image as ImageIcon,
  Loader2,
  HelpCircle,
  Palette,
  Zap,
  Library,
  Package,
  Bug,
  Wand2,
  Crown,
  Star,
  Layers,
  Activity
} from 'lucide-react';
import type { CharacterCard, SpriteLibraries } from '@/types';
import { SpriteManager } from './sprite-manager';
import { CharacterTriggerEditor } from './character-trigger-editor';
import { SpriteLibraryEditor } from './sprite-library-editor';
import { SpritePackEditor } from './sprite-pack-editor';
import { SpriteDebugPanel } from './sprite-debug-panel';
import { PresetSelector, presetToData } from './preset-selector';
import { HUDSelector } from './hud-selector';
import { StatsEditor } from './stats-editor';
import { getLogger } from '@/lib/logger';

const editorLogger = getLogger('editor');

interface CharacterEditorProps {
  characterId: string | null;
  onClose: () => void;
}

const defaultCharacter: Omit<CharacterCard, 'id' | 'createdAt' | 'updatedAt'> = {
  name: '',
  description: '',
  personality: '',
  scenario: '',
  firstMes: '',
  mesExample: '',
  creatorNotes: '',
  characterNote: '',
  systemPrompt: '',
  postHistoryInstructions: '',
  alternateGreetings: [],
  tags: [],
  avatar: '',
  sprites: [],
  voice: null
};

export function CharacterEditor({ characterId, onClose }: CharacterEditorProps) {
  const { addCharacter, updateCharacter, getCharacterById } = useTavernStore();

  // Initialize character data based on characterId
  const getInitialCharacter = () => {
    if (characterId) {
      const existing = getCharacterById(characterId);
      if (existing) {
        return existing;
      }
    }
    return defaultCharacter;
  };

  const [character, setCharacter] = useState(getInitialCharacter);
  const [newTag, setNewTag] = useState('');
  const [uploading, setUploading] = useState(false);
  const [appliedPresets, setAppliedPresets] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    if (!character.name.trim()) {
      alert('El nombre del personaje es requerido');
      return;
    }

    if (characterId) {
      updateCharacter(characterId, character);
    } else {
      addCharacter(character);
    }
    onClose();
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 2MB for base64)
    if (file.size > 2 * 1024 * 1024) {
      alert('La imagen es muy grande. El tamaño máximo es 2MB.');
      return;
    }

    setUploading(true);

    try {
      // Convert to base64 for persistent storage
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setCharacter(prev => ({ ...prev, avatar: base64 }));
        setUploading(false);
      };
      reader.onerror = () => {
        alert('Error al leer la imagen');
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      editorLogger.error('Upload error', { error });
      alert(error instanceof Error ? error.message : 'Error al subir la imagen');
      setUploading(false);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleAddTag = () => {
    if (newTag.trim() && !character.tags.includes(newTag.trim())) {
      setCharacter(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
      setNewTag('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setCharacter(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag)
    }));
  };

  // Apply preset
  const handleApplyPreset = (preset: { title: string; libraries?: any; packs?: any }) => {
    const data = presetToData(preset);
    
    setCharacter(prev => {
      // Merge libraries
      const mergedLibraries = {
        actions: [...(prev.spriteLibraries?.actions || []), ...data.libraries.actions],
        poses: [...(prev.spriteLibraries?.poses || []), ...data.libraries.poses],
        clothes: [...(prev.spriteLibraries?.clothes || []), ...data.libraries.clothes],
      };
      
      // Remove duplicates by name+prefix
      const dedupeLibraries = <T extends { name: string; prefix: string }>(arr: T[]): T[] => {
        const seen = new Set<string>();
        return arr.filter(item => {
          const key = `${item.prefix}${item.name}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      };
      
      return {
        ...prev,
        spriteLibraries: {
          actions: dedupeLibraries(mergedLibraries.actions),
          poses: dedupeLibraries(mergedLibraries.poses),
          clothes: dedupeLibraries(mergedLibraries.clothes),
        },
        spritePacks: [...(prev.spritePacks || []), ...data.packs],
      };
    });
    
    setAppliedPresets(prev => [...prev, preset.title]);
  };

  return (
    <TooltipProvider>
      <div className="space-y-4 h-full flex flex-col">
        {/* Header: Avatar + Name + Tags */}
        <div className="flex gap-4 flex-shrink-0">
          {/* Avatar */}
          <div className="relative group flex-shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <div 
                  className={cn(
                    "w-24 h-24 rounded-lg overflow-hidden bg-muted border-2 border-dashed border-muted-foreground/25 flex items-center justify-center transition-colors",
                    !uploading && "cursor-pointer hover:border-primary/50"
                  )}
                  onClick={() => !uploading && fileInputRef.current?.click()}
                >
                  {uploading ? (
                    <div className="text-center text-muted-foreground">
                      <Loader2 className="w-6 h-6 mx-auto animate-spin" />
                      <span className="text-xs mt-1">Subiendo...</span>
                    </div>
                  ) : character.avatar ? (
                    <img 
                      src={character.avatar} 
                      alt={character.name || 'Avatar'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center text-muted-foreground">
                      <Camera className="w-6 h-6 mx-auto mb-1" />
                      <span className="text-xs">Avatar</span>
                    </div>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Haz clic para subir una imagen de avatar</p>
              </TooltipContent>
            </Tooltip>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleAvatarUpload}
              disabled={uploading}
            />
          </div>

          {/* Name & Tags */}
          <div className="flex-1 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="name" className="text-xs">Nombre *</Label>
                <Input
                  id="name"
                  value={character.name}
                  onChange={(e) => setCharacter(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Nombre del personaje"
                  className="mt-1 h-8"
                />
              </div>
              <div>
                <Label className="text-xs">Etiquetas</Label>
                <div className="flex gap-1.5 mt-1">
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="Agregar..."
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                    className="h-8 flex-1"
                  />
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleAddTag}>
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
            {character.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {character.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1 text-xs py-0">
                    {tag}
                    <X 
                      className="w-2.5 h-2.5 cursor-pointer" 
                      onClick={() => handleRemoveTag(tag)}
                    />
                  </Badge>
                ))}
              </div>
            )}
            
            {/* HUD Selector */}
            <div className="pt-1">
              <div className="flex items-center gap-2 mb-1">
                <Layers className="w-3.5 h-3.5 text-muted-foreground" />
                <Label className="text-xs">Plantilla HUD</Label>
              </div>
              <HUDSelector
                value={character.hudTemplateId}
                onChange={(hudTemplateId) => setCharacter(prev => ({ ...prev, hudTemplateId }))}
                placeholder="Sin HUD asignado"
              />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="description" className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid grid-cols-7 w-full flex-shrink-0 h-9">
            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger value="description" className="text-xs gap-1">
                  <FileText className="w-3.5 h-3.5" />
                  Descripción
                </TabsTrigger>
              </TooltipTrigger>
              <TooltipContent><p>Historia, personalidad y escenario del personaje</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger value="dialogue" className="text-xs gap-1">
                  <MessageSquare className="w-3.5 h-3.5" />
                  Diálogo
                </TabsTrigger>
              </TooltipTrigger>
              <TooltipContent><p>Primer mensaje y ejemplos de diálogo</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger value="prompt" className="text-xs gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  Prompts
                </TabsTrigger>
              </TooltipTrigger>
              <TooltipContent><p>Prompts de sistema y notas para la IA</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger value="sprites" className="text-xs gap-1">
                  <ImageIcon className="w-3.5 h-3.5" />
                  Sprites
                </TabsTrigger>
              </TooltipTrigger>
              <TooltipContent><p>Colecciones de sprites para estados (idle, talk, thinking)</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger value="triggers" className="text-xs gap-1">
                  <Zap className="w-3.5 h-3.5" />
                  Triggers
                </TabsTrigger>
              </TooltipTrigger>
              <TooltipContent><p>Cambia sprites automáticamente según palabras clave</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger value="stats" className="text-xs gap-1">
                  <Activity className="w-3.5 h-3.5" />
                  Stats
                </TabsTrigger>
              </TooltipTrigger>
              <TooltipContent><p>Sistema de atributos, habilidades e intenciones</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger value="voice" className="text-xs gap-1">
                  <Mic className="w-3.5 h-3.5" />
                  Voz
                </TabsTrigger>
              </TooltipTrigger>
              <TooltipContent><p>Configuración de texto-a-voz</p></TooltipContent>
            </Tooltip>
          </TabsList>

          <ScrollArea className="flex-1 mt-3">
            {/* Description Tab - 2 columns */}
            <TabsContent value="description" className="mt-0">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Label htmlFor="description" className="text-xs">Descripción</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Descripción detallada del personaje: su historia, apariencia y rasgos principales.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Textarea
                    id="description"
                    value={character.description}
                    onChange={(e) => setCharacter(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe tu personaje en detalle..."
                    className="min-h-[200px] text-sm"
                  />
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Label htmlFor="personality" className="text-xs">Personalidad</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>Rasgos de carácter, manerismos y patrones de comportamiento.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Textarea
                      id="personality"
                      value={character.personality}
                      onChange={(e) => setCharacter(prev => ({ ...prev, personality: e.target.value }))}
                      placeholder="Describe la personalidad..."
                      className="min-h-[90px] text-sm"
                    />
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Label htmlFor="scenario" className="text-xs">Escenario</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>El entorno o escenario donde existe el personaje.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Textarea
                      id="scenario"
                      value={character.scenario}
                      onChange={(e) => setCharacter(prev => ({ ...prev, scenario: e.target.value }))}
                      placeholder="Describe el escenario..."
                      className="min-h-[90px] text-sm"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Dialogue Tab - 2 columns */}
            <TabsContent value="dialogue" className="mt-0">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Label htmlFor="firstMes" className="text-xs">Primer Mensaje</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>El primer mensaje que el personaje enviará para iniciar la conversación.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Textarea
                    id="firstMes"
                    value={character.firstMes}
                    onChange={(e) => setCharacter(prev => ({ ...prev, firstMes: e.target.value }))}
                    placeholder="Mensaje de apertura del personaje..."
                    className="min-h-[200px] text-sm"
                  />
                </div>

                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Label htmlFor="mesExample" className="text-xs">Ejemplo de Diálogo</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Ejemplos de conversación para ayudar a la IA a entender cómo habla el personaje.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Textarea
                    id="mesExample"
                    value={character.mesExample}
                    onChange={(e) => setCharacter(prev => ({ ...prev, mesExample: e.target.value }))}
                    placeholder={`<START>\n{{user}}: ¡Hola!\n{{char}}: *sonríe* ¡Hola!`}
                    className="min-h-[200px] font-mono text-xs"
                  />
                </div>
              </div>
            </TabsContent>

            {/* Prompts Tab - 2 columns */}
            <TabsContent value="prompt" className="mt-0">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Label htmlFor="systemPrompt" className="text-xs">Prompt de Sistema</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>Sobrescribe el prompt de sistema predeterminado. Déjalo vacío para usar el default.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Textarea
                      id="systemPrompt"
                      value={character.systemPrompt}
                      onChange={(e) => setCharacter(prev => ({ ...prev, systemPrompt: e.target.value }))}
                      placeholder="Prompt de sistema personalizado..."
                      className="min-h-[120px] font-mono text-xs"
                    />
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Label htmlFor="postHistoryInstructions" className="text-xs">Instrucciones Post-Historia</Label>
                    </div>
                    <Textarea
                      id="postHistoryInstructions"
                      value={character.postHistoryInstructions}
                      onChange={(e) => setCharacter(prev => ({ ...prev, postHistoryInstructions: e.target.value }))}
                      placeholder="Instrucciones después del historial..."
                      className="min-h-[80px] font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Label htmlFor="characterNote" className="text-xs">Nota del Personaje</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>Una nota que se envía a la IA con cada mensaje para influir en el comportamiento.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Textarea
                      id="characterNote"
                      value={character.characterNote}
                      onChange={(e) => setCharacter(prev => ({ ...prev, characterNote: e.target.value }))}
                      placeholder="Nota que se enviará con cada mensaje..."
                      className="min-h-[120px] font-mono text-xs"
                    />
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Label htmlFor="creatorNotes" className="text-xs">Notas del Creador</Label>
                    </div>
                    <Textarea
                      id="creatorNotes"
                      value={character.creatorNotes}
                      onChange={(e) => setCharacter(prev => ({ ...prev, creatorNotes: e.target.value }))}
                      placeholder="Tus notas sobre este personaje..."
                      className="min-h-[80px] text-sm"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Sprites Tab */}
            <TabsContent value="sprites" className="mt-0 space-y-3">
              {/* Explanation Banner */}
              <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-lg p-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-purple-500/20 rounded-lg">
                    <ImageIcon className="w-5 h-5 text-purple-500" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-purple-600">Sistema de Colecciones de Sprites</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Los estados <strong>Idle, Talk y Thinking</strong> ahora son colecciones de sprites. 
                      Agrega sprites personalizados y define cuál es el principal y cuáles son alternativos.
                    </p>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="outline" className="text-xs bg-amber-500/10">
                        <Crown className="w-3 h-3 mr-1 text-amber-500" />
                        Principal
                      </Badge>
                      <Badge variant="outline" className="text-xs bg-blue-500/10">
                        <Star className="w-3 h-3 mr-1 text-blue-500" />
                        Alternativos
                      </Badge>
                      <Badge variant="outline" className="text-xs bg-green-500/10">
                        Principal/Aleatorio/Lista
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
              
              <SpriteManager
                character={character}
                onChange={(updates) => setCharacter(prev => ({ ...prev, ...updates }))}
              />
            </TabsContent>

            {/* Triggers Tab - Sub-tabs for Simple, Libraries, Packs, Presets, Debug */}
            <TabsContent value="triggers" className="mt-0 space-y-3">
              {/* Explanation Banner */}
              <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-lg p-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-amber-500/20 rounded-lg">
                    <Zap className="w-5 h-5 text-amber-500" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-amber-600">Sistema de Triggers Dinámicos</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Los triggers detectan <strong>palabras clave</strong> en el chat y cambian el sprite automáticamente. 
                      Funcionan junto con el sistema de Sprites estáticos.
                    </p>
                    <div className="grid grid-cols-4 gap-2 mt-2 text-xs">
                      <div className="p-1.5 bg-amber-500/10 rounded text-center">
                        <Zap className="w-3 h-3 mx-auto text-amber-500" />
                        <span className="block mt-0.5">Simple</span>
                        <span className="text-muted-foreground">keyword → sprite</span>
                      </div>
                      <div className="p-1.5 bg-blue-500/10 rounded text-center">
                        <Library className="w-3 h-3 mx-auto text-blue-500" />
                        <span className="block mt-0.5">Libraries</span>
                        <span className="text-muted-foreground">act-*, pose-*</span>
                      </div>
                      <div className="p-1.5 bg-green-500/10 rounded text-center">
                        <Package className="w-3 h-3 mx-auto text-green-500" />
                        <span className="block mt-0.5">Packs</span>
                        <span className="text-muted-foreground">ANY + ALL</span>
                      </div>
                      <div className="p-1.5 bg-purple-500/10 rounded text-center">
                        <Bug className="w-3 h-3 mx-auto text-purple-500" />
                        <span className="block mt-0.5">Debug</span>
                        <span className="text-muted-foreground">probar</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <Tabs defaultValue="simple" className="w-full">
                <TabsList className="grid grid-cols-5 w-full">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TabsTrigger value="simple" className="text-xs gap-1">
                        <Zap className="w-3.5 h-3.5" />
                        Simple
                      </TabsTrigger>
                    </TooltipTrigger>
                    <TooltipContent><p>Triggers básicos: una keyword → un sprite</p></TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TabsTrigger value="libraries" className="text-xs gap-1">
                        <Library className="w-3.5 h-3.5" />
                        Libraries
                      </TabsTrigger>
                    </TooltipTrigger>
                    <TooltipContent><p>Define acciones (act-wave), posturas (pose-sitting), ropa (cloth-casual)</p></TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TabsTrigger value="packs" className="text-xs gap-1">
                        <Package className="w-3.5 h-3.5" />
                        Packs
                      </TabsTrigger>
                    </TooltipTrigger>
                    <TooltipContent><p>Sistema avanzado: CUALQUIER keyword activa + TODAS las keys deben coincidir</p></TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TabsTrigger value="presets" className="text-xs gap-1">
                        <Wand2 className="w-3.5 h-3.5" />
                        Presets
                      </TabsTrigger>
                    </TooltipTrigger>
                    <TooltipContent><p>Configuraciones predefinidas para comenzar rápido</p></TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TabsTrigger value="debug" className="text-xs gap-1">
                        <Bug className="w-3.5 h-3.5" />
                        Debug
                      </TabsTrigger>
                    </TooltipTrigger>
                    <TooltipContent><p>Prueba la detección de tokens en tiempo real</p></TooltipContent>
                  </Tooltip>
                </TabsList>

                {/* Simple Triggers */}
                <TabsContent value="simple" className="mt-0">
                  <CharacterTriggerEditor
                    character={character}
                    onChange={(updates) => setCharacter(prev => ({ ...prev, ...updates }))}
                  />
                </TabsContent>

                {/* Sprite Libraries */}
                <TabsContent value="libraries" className="mt-0">
                  <SpriteLibraryEditor
                    libraries={character.spriteLibraries || { actions: [], poses: [], clothes: [] }}
                    onChange={(libraries: SpriteLibraries) => setCharacter(prev => ({ ...prev, spriteLibraries: libraries }))}
                  />
                </TabsContent>

                {/* Sprite Packs */}
                <TabsContent value="packs" className="mt-0">
                  <SpritePackEditor
                    packs={character.spritePacks || []}
                    libraries={character.spriteLibraries || { actions: [], poses: [], clothes: [] }}
                    spriteIndex={character.spriteIndex}
                    onChange={(packs) => setCharacter(prev => ({ ...prev, spritePacks: packs }))}
                  />
                </TabsContent>

                {/* Presets */}
                <TabsContent value="presets" className="mt-0">
                  <PresetSelector
                    onApplyPreset={handleApplyPreset}
                    appliedPresets={appliedPresets}
                  />
                </TabsContent>

                {/* Debug Panel */}
                <TabsContent value="debug" className="mt-0">
                  <SpriteDebugPanel />
                </TabsContent>
              </Tabs>
            </TabsContent>

            {/* Stats Tab */}
            <TabsContent value="stats" className="mt-0">
              <StatsEditor
                statsConfig={character.statsConfig}
                onChange={(statsConfig) => setCharacter(prev => ({ ...prev, statsConfig }))}
              />
            </TabsContent>

            {/* Voice Tab */}
            <TabsContent value="voice" className="mt-0">
              <div className="space-y-4">
                {character.voice?.enabled ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Mic className="w-4 h-4 text-green-500" />
                        <span className="text-sm font-medium">Voz Activada</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setCharacter(prev => ({
                          ...prev,
                          voice: { ...prev.voice, enabled: false, voiceId: '', speed: 1, pitch: 1, emotionMapping: {} }
                        }))}
                      >
                        Desactivar
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Velocidad</Label>
                        <Input
                          type="number"
                          step="0.1"
                          min="0.5"
                          max="2"
                          value={character.voice.speed || 1}
                          onChange={(e) => setCharacter(prev => ({
                            ...prev,
                            voice: { ...prev.voice!, speed: parseFloat(e.target.value) || 1 }
                          }))}
                          className="mt-1 h-8"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Tono</Label>
                        <Input
                          type="number"
                          step="0.1"
                          min="0.5"
                          max="2"
                          value={character.voice.pitch || 1}
                          onChange={(e) => setCharacter(prev => ({
                            ...prev,
                            voice: { ...prev.voice!, pitch: parseFloat(e.target.value) || 1 }
                          }))}
                          className="mt-1 h-8"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground border rounded-lg">
                    <Mic className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Configura texto-a-voz para este personaje.</p>
                    <p className="text-xs mt-1 mb-3">El personaje hablará con la voz configurada.</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCharacter(prev => ({
                        ...prev,
                        voice: {
                          enabled: true,
                          voiceId: 'default',
                          speed: 1,
                          pitch: 1,
                          emotionMapping: {}
                        }
                      }))}
                    >
                      Activar Voz
                    </Button>
                  </div>
                )}
                
                <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
                  <p>💡 La configuración de voz usará el proveedor TTS activo en configuración.</p>
                  <p className="mt-1">💡 Puedes mapear emociones a voces específicas en la configuración avanzada.</p>
                </div>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-3 border-t flex-shrink-0">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSave}>
            {characterId ? 'Guardar Cambios' : 'Crear Personaje'}
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
}
