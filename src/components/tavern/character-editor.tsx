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
  Package,
  Layers,
  Activity,
  BookOpen,
  ScrollText
} from 'lucide-react';
import type { CharacterCard, CharacterVoiceSettings } from '@/types';
import { DEFAULT_CHARACTER_VOICE_SETTINGS } from '@/types';
import { SpriteCollectionSelector } from './sprite-collection-selector';
import { SpriteManager } from './sprite-manager';
import { HUDSelector } from './hud-selector';
import { LorebookSelector } from './lorebook-selector';
import { QuestSelector } from './quest-selector';
import { StatsEditor } from './stats-editor';
import { CharacterVoicePanel } from './character-voice-panel';
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
  voice: null,
  lorebookIds: [],
  questTemplateIds: [],
};

export function CharacterEditor({ characterId, onClose }: CharacterEditorProps) {
  const { addCharacter, updateCharacter, getCharacterById, characters, personas, activePersonaId } = useTavernStore();

  // Get active persona
  const activePersona = personas.find(p => p.id === activePersonaId);

  // Get all characters except the one being edited (for target selection in invitations)
  // Also include the active persona if it has solicitudes configured
  const allCharacters = useMemo(() => {
    const result = characters
      .filter(c => c.id !== characterId)
      .map(c => ({
        id: c.id,
        name: c.name,
        solicitudDefinitions: c.statsConfig?.solicitudDefinitions || []
      }));
    
    // Add active persona if it has solicitudes configured
    if (activePersona?.statsConfig?.enabled && 
        (activePersona.statsConfig.solicitudDefinitions?.length || 0) > 0) {
      result.push({
        id: '__user__',
        name: activePersona.name || 'Usuario',
        solicitudDefinitions: activePersona.statsConfig.solicitudDefinitions || []
      });
    }
    
    return result;
  }, [characters, characterId, activePersona]);

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

  return (
    <TooltipProvider>
      <div className="space-y-4 h-full flex flex-col">
        {/* Compact Header - Only character name */}
        <div className="flex items-center justify-between flex-shrink-0 px-1">
          <h2 className="text-lg font-semibold truncate">
            {character.name || 'Nuevo Personaje'}
          </h2>
          <div className="text-xs text-muted-foreground">
            {characterId ? 'Editando' : 'Creando'}
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="info" className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid grid-cols-7 w-full flex-shrink-0 h-9">
            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger value="info" className="text-xs gap-1">
                  <Palette className="w-3.5 h-3.5" />
                  Información
                </TabsTrigger>
              </TooltipTrigger>
              <TooltipContent><p>Avatar, información básica y asignaciones del personaje</p></TooltipContent>
            </Tooltip>
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
                  <Layers className="w-3.5 h-3.5" />
                  Sprites
                </TabsTrigger>
              </TooltipTrigger>
              <TooltipContent><p>Sprite Packs, Estados y Triggers del personaje</p></TooltipContent>
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
            {/* Info Tab - Avatar, Basic Info, Assignments */}
            <TabsContent value="info" className="mt-0">
              <div className="space-y-4">
                {/* Info Banner */}
                <div className="bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-500/20 rounded-lg p-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <Palette className="w-5 h-5 text-blue-500" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-blue-600">Información del Personaje</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Configura el <strong>avatar</strong>, <strong>información básica</strong> y <strong>asignaciones</strong> del personaje.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  {/* Avatar Section */}
                  <div className="flex-shrink-0">
                    <div className="relative group">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div 
                            className={cn(
                              "w-32 h-32 rounded-lg overflow-hidden bg-muted border-2 border-dashed border-muted-foreground/25 flex items-center justify-center transition-colors",
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
                  </div>

                  {/* Name & Tags */}
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

                      {/* Sprite Collection Selector */}
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <ImageIcon className="w-3.5 h-3.5 text-purple-500" />
                          <Label className="text-xs">Colección de Sprites</Label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>Selecciona la colección de sprites que usará este personaje. Las colecciones se gestionan en Sprite Timeline.</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <SpriteCollectionSelector
                          value={character.spriteConfig?.collection}
                          onChange={(collectionName) => setCharacter(prev => ({ 
                            ...prev, 
                            spriteConfig: { 
                              ...prev.spriteConfig, 
                              enabled: true,
                              collection: collectionName,
                              sprites: prev.spriteConfig?.sprites || {},
                              stateCollections: prev.spriteConfig?.stateCollections || {}
                            } 
                          }))}
                          placeholder="Sin colección asignada"
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
              </div>
            </TabsContent>

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
            <TabsContent value="sprites" className="mt-0">
              <SpriteManager
                character={character}
                onChange={(updates) => setCharacter(prev => ({ ...prev, ...updates }))}
              />
            </TabsContent>

            {/* Stats Tab */}
            <TabsContent value="stats" className="mt-0">
              <StatsEditor
                statsConfig={character.statsConfig}
                onChange={(statsConfig) => setCharacter(prev => ({ ...prev, statsConfig }))}
                allCharacters={allCharacters}
              />
            </TabsContent>

            {/* Voice Tab - Dual Voice System */}
            <TabsContent value="voice" className="mt-0">
              <CharacterVoicePanel
                voiceSettings={character.voice}
                onChange={(voice) => setCharacter(prev => ({ ...prev, voice }))}
              />
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
