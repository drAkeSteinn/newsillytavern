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
  Palette
} from 'lucide-react';
import type { CharacterCard } from '@/types';
import { SpriteManager } from './sprite-manager';
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
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="description" className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid grid-cols-5 w-full flex-shrink-0 h-9">
            <TabsTrigger value="description" className="text-xs gap-1">
              <FileText className="w-3.5 h-3.5" />
              Descripción
            </TabsTrigger>
            <TabsTrigger value="dialogue" className="text-xs gap-1">
              <MessageSquare className="w-3.5 h-3.5" />
              Diálogo
            </TabsTrigger>
            <TabsTrigger value="prompt" className="text-xs gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              Prompts
            </TabsTrigger>
            <TabsTrigger value="sprites" className="text-xs gap-1">
              <ImageIcon className="w-3.5 h-3.5" />
              Sprites
            </TabsTrigger>
            <TabsTrigger value="voice" className="text-xs gap-1">
              <Mic className="w-3.5 h-3.5" />
              Voz
            </TabsTrigger>
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
            <TabsContent value="sprites" className="mt-0">
              <SpriteManager
                character={character}
                onChange={(updates) => setCharacter(prev => ({ ...prev, ...updates }))}
              />
            </TabsContent>

            {/* Voice Tab */}
            <TabsContent value="voice" className="mt-0">
              <div className="text-center py-6 text-muted-foreground">
                <Mic className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Configura texto-a-voz para este personaje.</p>
                <Button variant="outline" size="sm" className="mt-3">
                  Activar Voz
                </Button>
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
