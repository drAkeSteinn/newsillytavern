'use client';

import { useState, useRef, useMemo } from 'react';
import { useTavernStore } from '@/store/tavern-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
  Activity,
  BookOpen,
  ScrollText
} from 'lucide-react';
import type { CharacterCard, SpriteLibraries } from '@/types';
import { SpriteManager } from './sprite-manager';
// Legacy components removed - using V2 system now
import { SpriteLibraryEditor } from './sprite-library-editor';
import { SpriteDebugPanel } from './sprite-debug-panel';
import { PresetSelector, presetToData } from './preset-selector';
import { HUDSelector } from './hud-selector';
import { LorebookSelector } from './lorebook-selector';
import { QuestSelector } from './quest-selector';
import { StatsEditor } from './stats-editor';
import { TriggerCollectionEditor } from './trigger-collection-editor';
import { getLogger } from '@/lib/logger';
import { getMigrationStatus, type MigrationStatus } from '@/lib/migration/sprite-migration';

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
  voice: null,
  lorebookIds: [],
  questTemplateIds: [],
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

  // Get migration status
  const migrationStatus: MigrationStatus = useMemo(() => {
    return getMigrationStatus(character);
  }, [character.triggerCollections, character.spritePacksV2, character.stateCollectionsV2]);

  // Apply preset
  const handleApplyPreset = (preset: { title: string; libraries?: any }) => {
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
      };
    });
    
    setAppliedPresets(prev => [...prev, preset.title]);
  };

  return (
    <TooltipProvider>
      <div className="space-y-4 h-full flex flex-col">
        {/* Header: Avatar + Name + Tags - Diseño mejorado */}
        <div className="flex gap-4 flex-shrink-0">
          {/* Avatar */}
          <div className="relative group flex-shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <div 
                  className={cn(
                    "w-28 h-28 rounded-lg overflow-hidden bg-muted border-2 border-dashed border-muted-foreground/25 flex items-center justify-center transition-colors",
                    !uploading && "cursor-pointer hover:border-primary/50 hover:bg-muted/50"
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
                      <Camera className="w-8 h-8 mx-auto mb-1 opacity-50" />
                      <span className="text-[10px]">Avatar</span>
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

          {/* Name & Tags - Diseño mejorado con secciones */}
          <div className="flex-1 space-y-3">
            {/* Sección: Información básica */}
            <div className="p-3 bg-muted/30 rounded-lg border border-border/40 space-y-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <Palette className="w-3.5 h-3.5" />
                <span className="font-medium">Información Básica</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Label htmlFor="name" className="text-xs">Nombre *</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>El nombre del personaje que se mostrará en el chat.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    id="name"
                    value={character.name}
                    onChange={(e) => setCharacter(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Nombre del personaje"
                    className="h-8"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Label className="text-xs">Etiquetas</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Tags para organizar y buscar personajes.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="flex gap-1.5">
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
                <div className="flex flex-wrap gap-1 pt-1">
                  {character.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1 text-xs py-0.5 px-2">
                      {tag}
                      <X 
                        className="w-3 h-3 cursor-pointer opacity-60 hover:opacity-100" 
                        onClick={() => handleRemoveTag(tag)}
                      />
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Sección: Asignaciones */}
            <div className="p-3 bg-muted/30 rounded-lg border border-border/40 space-y-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Package className="w-3.5 h-3.5" />
                <span className="font-medium">Asignaciones</span>
              </div>
              
              {/* HUD Selector */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Layers className="w-3.5 h-3.5 text-cyan-500" />
                  <Label className="text-xs">Plantilla HUD</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Selecciona una plantilla HUD para mostrar estadísticas del personaje.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <HUDSelector
                  value={character.hudTemplateId}
                  onChange={(hudTemplateId) => setCharacter(prev => ({ ...prev, hudTemplateId }))}
                  placeholder="Sin HUD asignado"
                />
              </div>

              {/* Lorebook Selector */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <BookOpen className="w-3.5 h-3.5 text-amber-500" />
                  <Label className="text-xs">Lorebooks</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Lorebooks asociados con información adicional del personaje.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <LorebookSelector
                  value={character.lorebookIds}
                  onChange={(lorebookIds) => setCharacter(prev => ({ ...prev, lorebookIds }))}
                  placeholder="Sin lorebooks asignados"
                />
              </div>

              {/* Quest Templates Selector */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <ScrollText className="w-3.5 h-3.5 text-purple-500" />
                  <Label className="text-xs">Misiones</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Templates de misiones disponibles para este personaje.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <QuestSelector
                  value={character.questTemplateIds}
                  onChange={(questTemplateIds) => setCharacter(prev => ({ ...prev, questTemplateIds }))}
                  placeholder="Sin misiones asignadas"
                />
              </div>
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
            {/* Description Tab - Diseño mejorado con secciones */}
            <TabsContent value="description" className="mt-0">
              <div className="space-y-4">
                {/* Banner informativo */}
                <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-lg p-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-emerald-500/20 rounded-lg">
                      <FileText className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-emerald-600">Información del Personaje</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Define la <strong>historia</strong>, <strong>personalidad</strong> y <strong>escenario</strong> del personaje. 
                        Esta información ayuda a la IA a entender y interpretar correctamente al personaje.
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  {/* Descripción Principal */}
                  <div className="p-3 bg-muted/30 rounded-lg border border-border/40">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-4 h-4 text-emerald-500" />
                      <span className="text-xs font-medium">Descripción</span>
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

                  {/* Columna derecha */}
                  <div className="space-y-3">
                    {/* Personalidad */}
                    <div className="p-3 bg-muted/30 rounded-lg border border-border/40">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-4 h-4 text-purple-500" />
                        <span className="text-xs font-medium">Personalidad</span>
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

                    {/* Escenario */}
                    <div className="p-3 bg-muted/30 rounded-lg border border-border/40">
                      <div className="flex items-center gap-2 mb-2">
                        <Layers className="w-4 h-4 text-cyan-500" />
                        <span className="text-xs font-medium">Escenario</span>
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
              </div>
            </TabsContent>

            {/* Dialogue Tab - Diseño mejorado con secciones */}
            <TabsContent value="dialogue" className="mt-0">
              <div className="space-y-4">
                {/* Banner informativo */}
                <div className="bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-500/20 rounded-lg p-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <MessageSquare className="w-5 h-5 text-blue-500" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-blue-600">Configuración de Diálogo</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Define el <strong>primer mensaje</strong> y <strong>ejemplos de diálogo</strong> para guiar a la IA 
                        sobre cómo debe hablar e interactuar el personaje.
                      </p>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="outline" className="text-xs bg-blue-500/10">
                          <MessageSquare className="w-3 h-3 mr-1 text-blue-500" />
                          Primer Mensaje
                        </Badge>
                        <Badge variant="outline" className="text-xs bg-purple-500/10">
                          <Sparkles className="w-3 h-3 mr-1 text-purple-500" />
                          Ejemplos
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  {/* Primer Mensaje */}
                  <div className="p-3 bg-muted/30 rounded-lg border border-border/40">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="w-4 h-4 text-blue-500" />
                      <span className="text-xs font-medium">Primer Mensaje</span>
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

                  {/* Ejemplo de Diálogo */}
                  <div className="p-3 bg-muted/30 rounded-lg border border-border/40">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-purple-500" />
                      <span className="text-xs font-medium">Ejemplo de Diálogo</span>
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
                      placeholder={`<START>
{{user}}: ¡Hola!
{{char}}: *sonríe* ¡Hola!`}
                      className="min-h-[200px] font-mono text-xs"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Usa {'<START>'} para separar ejemplos y {'{{user}}'}/{'{{char}}'} para los hablantes.
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Prompts Tab - Diseño mejorado con secciones */}
            <TabsContent value="prompt" className="mt-0">
              <div className="space-y-4">
                {/* Banner informativo */}
                <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-lg p-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-amber-500/20 rounded-lg">
                      <Sparkles className="w-5 h-5 text-amber-500" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-amber-600">Configuración de Prompts</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Personaliza los <strong>prompts de sistema</strong> y <strong>notas</strong> que guían el comportamiento de la IA.
                        Estos ajustes permiten un control más fino sobre cómo responde el personaje.
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  {/* Columna izquierda */}
                  <div className="space-y-3">
                    {/* Prompt de Sistema */}
                    <div className="p-3 bg-muted/30 rounded-lg border border-border/40">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-4 h-4 text-amber-500" />
                        <span className="text-xs font-medium">Prompt de Sistema</span>
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

                    {/* Instrucciones Post-Historia */}
                    <div className="p-3 bg-muted/30 rounded-lg border border-border/40">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="w-4 h-4 text-cyan-500" />
                        <span className="text-xs font-medium">Instrucciones Post-Historia</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>Instrucciones que se añaden después del historial de conversación.</p>
                          </TooltipContent>
                        </Tooltip>
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

                  {/* Columna derecha */}
                  <div className="space-y-3">
                    {/* Nota del Personaje */}
                    <div className="p-3 bg-muted/30 rounded-lg border border-border/40">
                      <div className="flex items-center gap-2 mb-2">
                        <MessageSquare className="w-4 h-4 text-purple-500" />
                        <span className="text-xs font-medium">Nota del Personaje</span>
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

                    {/* Notas del Creador */}
                    <div className="p-3 bg-muted/30 rounded-lg border border-border/40">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs font-medium">Notas del Creador</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>Notas personales sobre el personaje. No se envían a la IA.</p>
                          </TooltipContent>
                        </Tooltip>
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

            {/* Triggers Tab - Sub-tabs for Collections, Libraries, Presets, Debug */}
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
                    {/* V2 status indicator */}
                    {migrationStatus.hasV2Data && (
                      <div className="flex gap-2 mt-2 mb-1">
                        <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600">
                          <Layers className="w-3 h-3 mr-1" />
                          V2 Activo ({migrationStatus.v2Collections} coll, {migrationStatus.v2Packs} packs)
                        </Badge>
                      </div>
                    )}
                    <div className="grid grid-cols-4 gap-2 mt-2 text-xs">
                      <div className="p-1.5 bg-purple-500/10 rounded text-center">
                        <Layers className="w-3 h-3 mx-auto text-purple-500" />
                        <span className="block mt-0.5">Collections</span>
                        <span className="text-muted-foreground">Triggers V2</span>
                      </div>
                      <div className="p-1.5 bg-blue-500/10 rounded text-center">
                        <Library className="w-3 h-3 mx-auto text-blue-500" />
                        <span className="block mt-0.5">Libraries</span>
                        <span className="text-muted-foreground">act-*</span>
                      </div>
                      <div className="p-1.5 bg-pink-500/10 rounded text-center">
                        <Wand2 className="w-3 h-3 mx-auto text-pink-500" />
                        <span className="block mt-0.5">Presets</span>
                        <span className="text-muted-foreground">config</span>
                      </div>
                      <div className="p-1.5 bg-cyan-500/10 rounded text-center">
                        <Bug className="w-3 h-3 mx-auto text-cyan-500" />
                        <span className="block mt-0.5">Debug</span>
                        <span className="text-muted-foreground">test</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <Tabs defaultValue="collections" className="w-full">
                <TabsList className="grid grid-cols-4 w-full">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TabsTrigger value="collections" className="text-xs gap-1 bg-purple-500/5">
                        <Layers className="w-3.5 h-3.5 text-purple-500" />
                        Collections
                      </TabsTrigger>
                    </TooltipTrigger>
                    <TooltipContent><p>Sistema de Trigger Collections con prioridades y cadenas</p></TooltipContent>
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

                {/* Trigger Collections V2 */}
                <TabsContent value="collections" className="mt-0">
                  <TriggerCollectionEditor
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

            {/* Voice Tab - Diseño mejorado */}
            <TabsContent value="voice" className="mt-0">
              <div className="space-y-4">
                {/* Banner informativo */}
                <div className="bg-gradient-to-r from-pink-500/10 to-rose-500/10 border border-pink-500/20 rounded-lg p-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-pink-500/20 rounded-lg">
                      <Mic className="w-5 h-5 text-pink-500" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-pink-600">Sistema de Voz (TTS)</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Configura la <strong>texto-a-voz</strong> del personaje para que responda con audio.
                        Usa el proveedor TTS activo en la configuración global.
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Voice Toggle Section */}
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/40">
                  <div className="flex items-center gap-2">
                    <Mic className="w-4 h-4 text-pink-500" />
                    <span className="text-sm font-medium">Activar Voz</span>
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
                    checked={character.voice?.enabled || false}
                    onCheckedChange={(checked) => setCharacter(prev => ({
                      ...prev,
                      voice: checked 
                        ? { enabled: true, voiceId: 'default', speed: 1, pitch: 1, emotionMapping: {} }
                        : { enabled: false, voiceId: '', speed: 1, pitch: 1, emotionMapping: {} }
                    }))}
                  />
                </div>
                
                {character.voice?.enabled ? (
                  <div className="space-y-3">
                    {/* Status Badge */}
                    <div className="flex items-center gap-2 p-2 bg-green-500/10 border border-green-500/20 rounded-lg">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-xs text-green-600 font-medium">Voz activada para este personaje</span>
                    </div>
                    
                    {/* Voice Settings */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-muted/30 rounded-lg border border-border/40">
                        <div className="flex items-center gap-2 mb-2">
                          <Zap className="w-4 h-4 text-amber-500" />
                          <span className="text-xs font-medium">Velocidad</span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>Velocidad de reproducción de la voz (0.5 - 2.0)</p>
                              <p className="text-xs text-muted-foreground mt-1">1.0 = velocidad normal</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
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
                          className="h-8"
                        />
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Actual: {character.voice.speed || 1}x
                        </p>
                      </div>
                      <div className="p-3 bg-muted/30 rounded-lg border border-border/40">
                        <div className="flex items-center gap-2 mb-2">
                          <Activity className="w-4 h-4 text-purple-500" />
                          <span className="text-xs font-medium">Tono</span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>Tono de la voz (0.5 - 2.0)</p>
                              <p className="text-xs text-muted-foreground mt-1">1.0 = tono normal</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
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
                          className="h-8"
                        />
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Actual: {character.voice.pitch || 1}x
                        </p>
                      </div>
                    </div>
                    
                    {/* Info Note */}
                    <div className="text-xs bg-cyan-500/5 border border-cyan-500/20 p-3 rounded-lg">
                      <div className="flex items-start gap-2">
                        <HelpCircle className="w-4 h-4 text-cyan-500 mt-0.5" />
                        <div>
                          <p>El proveedor TTS se configura en <strong>Ajustes → TTS</strong>.</p>
                          <p className="mt-1 text-muted-foreground">Puedes mapear emociones a voces específicas en la configuración avanzada.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-lg border border-border/40">
                    <Mic className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm font-medium">Voz desactivada</p>
                    <p className="text-xs mt-1">Activa el sistema para configurar texto-a-voz.</p>
                  </div>
                )}
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
