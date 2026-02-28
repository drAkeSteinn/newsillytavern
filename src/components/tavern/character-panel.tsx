'use client';

import { useTavernStore } from '@/store/tavern-store';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { 
  Plus, 
  Search, 
  Users, 
  MessageSquare,
  MoreVertical,
  Trash2,
  Edit,
  Download,
  Upload,
  FileUp
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useState, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CharacterEditor } from './character-editor';
import { GroupEditor } from './group-editor';
import { importCharacterCard, exportCharacterCardAsPng, exportCharacterCardAsJson } from '@/lib/character-card';
import type { CharacterCard, ChatSession } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { getLogger } from '@/lib/logger';

const charLogger = getLogger('character');

export function CharacterPanel() {
  const [searchQuery, setSearchQuery] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingCharacterId, setEditingCharacterId] = useState<string | null>(null);
  const [groupEditorOpen, setGroupEditorOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const {
    characters,
    groups,
    activeCharacterId,
    activeGroupId,
    sessions,
    setActiveCharacter,
    setActiveGroup,
    createSession,
    setActiveSession,
    deleteCharacter,
    deleteGroup,
    addCharacter,
    sidebarOpen
  } = useTavernStore();

  const filteredCharacters = characters.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleSelectCharacter = (characterId: string) => {
    setActiveCharacter(characterId);
    setActiveGroup(null);
    
    // Find existing session or create new
    const existingSession = sessions.find(s => s.characterId === characterId);
    if (existingSession) {
      setActiveSession(existingSession.id);
    } else {
      createSession(characterId);
    }
  };

  const handleSelectGroup = (groupId: string) => {
    setActiveGroup(groupId);
    setActiveCharacter(null);
    
    // Find existing session for this group or create new
    const existingSession = sessions.find(s => s.groupId === groupId);
    if (existingSession) {
      setActiveSession(existingSession.id);
    } else {
      // Create a new session for the group
      const group = groups.find(g => g.id === groupId);
      if (group) {
        const id = uuidv4();
        const newSession: ChatSession = {
          id,
          characterId: 'group',
          groupId,
          name: `Chat con ${group.name}`,
          messages: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        // Add the session to the store
        useTavernStore.setState((state) => ({
          sessions: [...state.sessions, newSession],
          activeSessionId: id,
          activeGroupId: groupId,
          activeCharacterId: null
        }));
      }
    }
  };

  const handleEditCharacter = (characterId: string) => {
    setEditingCharacterId(characterId);
    setEditorOpen(true);
  };

  const handleEditGroup = (groupId: string) => {
    setEditingGroupId(groupId);
    setGroupEditorOpen(true);
  };

  const handleNewGroup = () => {
    setEditingGroupId(null);
    setGroupEditorOpen(true);
  };

  const handleDeleteCharacter = (characterId: string) => {
    if (confirm('¿Estás seguro de que quieres eliminar este personaje?')) {
      deleteCharacter(characterId);
    }
  };

  const handleNewCharacter = () => {
    setEditingCharacterId(null);
    setEditorOpen(true);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    
    try {
      const result = await importCharacterCard(file);
      
      if (!result) {
        toast({
          title: 'Error de Importación',
          description: 'No se pudo analizar la tarjeta del personaje. Asegúrate de que sea un archivo PNG o JSON válido.',
          variant: 'destructive'
        });
        return;
      }

      const { character, avatar } = result;
      
      // Add the character to the store
      addCharacter({
        name: character.name || 'Personaje sin nombre',
        description: character.description || '',
        personality: character.personality || '',
        scenario: character.scenario || '',
        firstMes: character.firstMes || '',
        mesExample: character.mesExample || '',
        creatorNotes: character.creatorNotes || '',
        characterNote: character.characterNote || '',
        systemPrompt: character.systemPrompt || '',
        postHistoryInstructions: character.postHistoryInstructions || '',
        alternateGreetings: character.alternateGreetings || [],
        tags: character.tags || [],
        avatar: avatar,
        sprites: [],
        voice: null
      });

      toast({
        title: 'Personaje Importado',
        description: `"${character.name || 'Personaje sin nombre'}" ha sido importado exitosamente.`
      });
    } catch (error) {
      charLogger.error('Import error', { error, source: 'file-input' });
      toast({
        title: 'Error de Importación',
        description: 'Ocurrió un error al importar el personaje.',
        variant: 'destructive'
      });
    } finally {
      setIsImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleExportCharacter = async (character: CharacterCard, format: 'png' | 'json') => {
    try {
      let blob: Blob;
      let filename: string;
      
      if (format === 'png') {
        blob = await exportCharacterCardAsPng(character);
        filename = `${character.name.replace(/[^a-z0-9]/gi, '_')}.png`;
      } else {
        const jsonStr = exportCharacterCardAsJson(character);
        blob = new Blob([jsonStr], { type: 'application/json' });
        filename = `${character.name.replace(/[^a-z0-9]/gi, '_')}.json`;
      }
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: 'Personaje Exportado',
        description: `"${character.name}" ha sido exportado como ${format.toUpperCase()}.`
      });
    } catch (error) {
      charLogger.error('Export error', { error, characterName: character.name, format });
      toast({
        title: 'Error de Exportación',
        description: 'Ocurrió un error al exportar el personaje.',
        variant: 'destructive'
      });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length === 0) return;
    
    const file = files[0];
    setIsImporting(true);
    
    try {
      const result = await importCharacterCard(file);
      
      if (!result) {
        toast({
          title: 'Error de Importación',
          description: 'No se pudo analizar la tarjeta del personaje. Asegúrate de que sea un archivo PNG o JSON válido.',
          variant: 'destructive'
        });
        return;
      }

      const { character, avatar } = result;
      
      addCharacter({
        name: character.name || 'Personaje sin nombre',
        description: character.description || '',
        personality: character.personality || '',
        scenario: character.scenario || '',
        firstMes: character.firstMes || '',
        mesExample: character.mesExample || '',
        creatorNotes: character.creatorNotes || '',
        characterNote: character.characterNote || '',
        systemPrompt: character.systemPrompt || '',
        postHistoryInstructions: character.postHistoryInstructions || '',
        alternateGreetings: character.alternateGreetings || [],
        tags: character.tags || [],
        avatar: avatar,
        sprites: [],
        voice: null
      });

      toast({
        title: 'Personaje Importado',
        description: `"${character.name || 'Personaje sin nombre'}" ha sido importado exitosamente.`
      });
    } catch (error) {
      charLogger.error('Import error', { error, source: 'drag-drop' });
      toast({
        title: 'Error de Importación',
        description: 'Ocurrió un error al importar el personaje.',
        variant: 'destructive'
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <>
      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".png,.json,image/png,application/json"
        onChange={handleFileChange}
        className="hidden"
      />
      
      <div 
        className={cn(
          "w-72 border-l bg-background flex flex-col h-full relative z-10 transition-all duration-300",
          !sidebarOpen && "w-0 overflow-hidden border-l-0",
          isDragging && "ring-2 ring-primary ring-inset"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drag overlay */}
        {isDragging && (
          <div className="absolute inset-0 bg-primary/10 backdrop-blur-sm z-10 flex items-center justify-center">
            <div className="bg-background border-2 border-dashed border-primary rounded-lg p-6 text-center">
              <Upload className="w-8 h-8 mx-auto mb-2 text-primary" />
              <p className="text-sm font-medium">Suelta la tarjeta aquí</p>
              <p className="text-xs text-muted-foreground mt-1">PNG o JSON</p>
            </div>
          </div>
        )}
        
        {/* Header */}
        <div className="p-4 border-b space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg">Personajes</h2>
            <div className="flex gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8" 
                onClick={handleImportClick}
                disabled={isImporting}
                title="Importar Personaje"
              >
                {isImporting ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8" 
                onClick={handleNewCharacter} 
                title="Crear Nuevo Personaje"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar personajes..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          {/* Characters List */}
          <div className="p-2">
            <div className="flex items-center gap-2 px-2 py-1 text-muted-foreground">
              <MessageSquare className="w-4 h-4" />
              <span className="text-sm font-medium">Personajes</span>
            </div>
            {filteredCharacters.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? 'No se encontraron personajes' : 'Sin personajes aún'}
                <Button 
                  variant="link" 
                  className="block mx-auto mt-2"
                  onClick={handleNewCharacter}
                >
                  Crea tu primer personaje
                </Button>
              </div>
            ) : (
              <div className="space-y-1 mt-1">
                {filteredCharacters.map((character) => (
                  <div
                    key={character.id}
                    className={cn(
                      'flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors',
                      activeCharacterId === character.id 
                        ? 'bg-primary/10 border border-primary/20' 
                        : 'hover:bg-muted'
                    )}
                    onClick={() => handleSelectCharacter(character.id)}
                  >
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                      {character.avatar ? (
                        <img 
                          src={character.avatar} 
                          alt={character.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-400 to-orange-600">
                          <span className="text-white font-bold">
                            {character.name[0].toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{character.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {character.tags.slice(0, 2).join(', ')}
                      </p>
                    </div>

                    {/* Actions - always visible */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 flex-shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          handleEditCharacter(character.id);
                        }}>
                          <Edit className="w-4 h-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          handleExportCharacter(character, 'png');
                        }}>
                          <Download className="w-4 h-4 mr-2" />
                          Exportar como PNG
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          handleExportCharacter(character, 'json');
                        }}>
                          <FileUp className="w-4 h-4 mr-2" />
                          Exportar como JSON
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCharacter(character.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Groups Section */}
          <div className="p-2 border-t mt-2">
            <div className="flex items-center justify-between px-2 py-1 text-muted-foreground">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span className="text-sm font-medium">Grupos</span>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6"
                onClick={handleNewGroup}
                title="Crear Nuevo Grupo"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {groups.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-sm">
                Sin grupos aún
              </div>
            ) : (
              <div className="space-y-1 mt-1">
                {groups.map((group) => (
                  <div
                    key={group.id}
                    className={cn(
                      'flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors',
                      activeGroupId === group.id 
                        ? 'bg-primary/10 border border-primary/20' 
                        : 'hover:bg-muted'
                    )}
                    onClick={() => handleSelectGroup(group.id)}
                  >
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-violet-400 to-purple-600">
                      <Users className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{group.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {group.members?.length || group.characterIds?.length || 0} personajes
                      </p>
                    </div>
                    
                    {/* Group Actions Menu - always visible */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 flex-shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          handleEditGroup(group.id);
                        }}>
                          <Edit className="w-4 h-4 mr-2" />
                          Editar Grupo
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`¿Estás seguro de que quieres eliminar el grupo "${group.name}"?`)) {
                              deleteGroup(group.id);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Eliminar Grupo
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-3 border-t space-y-2">
          <Button 
            variant="outline" 
            className="w-full justify-start gap-2"
            onClick={handleNewCharacter}
          >
            <Plus className="w-4 h-4" />
            Nuevo Personaje
          </Button>
          <Button 
            variant="outline" 
            className="w-full justify-start gap-2"
            onClick={handleNewGroup}
          >
            <Users className="w-4 h-4" />
            Nuevo Grupo
          </Button>
        </div>
      </div>

      {/* Character Editor Dialog */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-6xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCharacterId ? 'Editar Personaje' : 'Crear Nuevo Personaje'}
            </DialogTitle>
          </DialogHeader>
          <CharacterEditor 
            characterId={editingCharacterId}
            onClose={() => setEditorOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Group Editor Dialog */}
      <Dialog open={groupEditorOpen} onOpenChange={setGroupEditorOpen}>
        <DialogContent className="max-w-5xl w-[95vw] h-[90vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle>
              {editingGroupId ? 'Editar Grupo' : 'Crear Nuevo Grupo'}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            <GroupEditor 
              key={editingGroupId || 'new-group'}
              groupId={editingGroupId}
              onClose={() => setGroupEditorOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
