'use client';

import { useTavernStore } from '@/store/tavern-store';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { 
  Plus, 
  Search, 
  Users, 
  Settings, 
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
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CharacterEditor } from './character-editor';
import { importCharacterCard, exportCharacterCardAsPng, exportCharacterCardAsJson } from '@/lib/character-card';
import type { CharacterCard } from '@/types';
import { useToast } from '@/hooks/use-toast';

export function CharacterPanel() {
  const [searchQuery, setSearchQuery] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingCharacterId, setEditingCharacterId] = useState<string | null>(null);
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
  };

  const handleEditCharacter = (characterId: string) => {
    setEditingCharacterId(characterId);
    setEditorOpen(true);
  };

  const handleDeleteCharacter = (characterId: string) => {
    if (confirm('Are you sure you want to delete this character?')) {
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
          title: 'Import Failed',
          description: 'Could not parse character card. Make sure it\'s a valid PNG or JSON file.',
          variant: 'destructive'
        });
        return;
      }

      const { character, avatar } = result;
      
      // Add the character to the store
      addCharacter({
        name: character.name || 'Unnamed Character',
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
        title: 'Character Imported',
        description: `"${character.name || 'Unnamed Character'}" has been imported successfully.`
      });
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: 'Import Failed',
        description: 'An error occurred while importing the character.',
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
        title: 'Character Exported',
        description: `"${character.name}" has been exported as ${format.toUpperCase()}.`
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'Export Failed',
        description: 'An error occurred while exporting the character.',
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
          title: 'Import Failed',
          description: 'Could not parse character card. Make sure it\'s a valid PNG or JSON file.',
          variant: 'destructive'
        });
        return;
      }

      const { character, avatar } = result;
      
      addCharacter({
        name: character.name || 'Unnamed Character',
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
        title: 'Character Imported',
        description: `"${character.name || 'Unnamed Character'}" has been imported successfully.`
      });
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: 'Import Failed',
        description: 'An error occurred while importing the character.',
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
              <p className="text-sm font-medium">Drop character card here</p>
              <p className="text-xs text-muted-foreground mt-1">PNG or JSON</p>
            </div>
          </div>
        )}
        
        {/* Header */}
        <div className="p-4 border-b space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg">Characters</h2>
            <div className="flex gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8" 
                onClick={handleImportClick}
                disabled={isImporting}
                title="Import Character Card"
              >
                {isImporting ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleNewCharacter} title="Create New Character">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search characters..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          {/* Characters List */}
          <div className="p-2">
            {filteredCharacters.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? 'No characters found' : 'No characters yet'}
                <Button 
                  variant="link" 
                  className="block mx-auto mt-2"
                  onClick={handleNewCharacter}
                >
                  Create your first character
                </Button>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredCharacters.map((character) => (
                  <div
                    key={character.id}
                    className={cn(
                      'group flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors',
                      activeCharacterId === character.id 
                        ? 'bg-primary/10 border border-primary/20' 
                        : 'hover:bg-muted'
                    )}
                    onClick={() => handleSelectCharacter(character.id)}
                  >
                    {/* Avatar */}
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                      {character.avatar ? (
                        <img 
                          src={character.avatar} 
                          alt={character.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-400 to-orange-600">
                          <span className="text-white font-bold text-lg">
                            {character.name[0].toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{character.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {character.tags.slice(0, 2).join(', ')}
                      </p>
                    </div>

                    {/* Actions */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 opacity-0 group-hover:opacity-100"
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
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          handleExportCharacter(character, 'png');
                        }}>
                          <Download className="w-4 h-4 mr-2" />
                          Export as PNG
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          handleExportCharacter(character, 'json');
                        }}>
                          <FileUp className="w-4 h-4 mr-2" />
                          Export as JSON
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
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Groups Section */}
          {groups.length > 0 && (
            <div className="p-2 border-t mt-2">
              <div className="flex items-center gap-2 px-2 py-1 text-muted-foreground">
                <Users className="w-4 h-4" />
                <span className="text-sm font-medium">Groups</span>
              </div>
              <div className="space-y-1 mt-1">
                {groups.map((group) => (
                  <div
                    key={group.id}
                    className={cn(
                      'group flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors',
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
                      <p className="font-medium truncate">{group.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {group.characterIds.length} characters
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="p-3 border-t">
          <Button 
            variant="outline" 
            className="w-full justify-start gap-2"
            onClick={handleNewCharacter}
          >
            <Plus className="w-4 h-4" />
            New Character
          </Button>
        </div>
      </div>

      {/* Character Editor Dialog */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCharacterId ? 'Edit Character' : 'Create New Character'}
            </DialogTitle>
          </DialogHeader>
          <CharacterEditor 
            characterId={editingCharacterId}
            onClose={() => setEditorOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
