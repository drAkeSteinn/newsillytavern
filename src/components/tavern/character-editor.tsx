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
  Camera, 
  X, 
  Plus, 
  Sparkles, 
  FileText, 
  MessageSquare, 
  Settings,
  Mic,
  Image as ImageIcon
} from 'lucide-react';
import type { CharacterCard } from '@/types';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    if (!character.name.trim()) {
      alert('Character name is required');
      return;
    }

    if (characterId) {
      updateCharacter(characterId, character);
    } else {
      addCharacter(character);
    }
    onClose();
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCharacter(prev => ({ ...prev, avatar: reader.result as string }));
      };
      reader.readAsDataURL(file);
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
    <div className="space-y-6">
      {/* Avatar Section */}
      <div className="flex items-start gap-6">
        <div className="relative group">
          <div 
            className="w-24 h-24 rounded-xl overflow-hidden bg-muted cursor-pointer border-2 border-dashed border-muted-foreground/25 flex items-center justify-center"
            onClick={() => fileInputRef.current?.click()}
          >
            {character.avatar ? (
              <img 
                src={character.avatar} 
                alt={character.name || 'Avatar'}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-center text-muted-foreground">
                <Camera className="w-8 h-8 mx-auto mb-1" />
                <span className="text-xs">Upload</span>
              </div>
            )}
          </div>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            onChange={handleAvatarUpload}
          />
        </div>

        <div className="flex-1 space-y-4">
          <div>
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={character.name}
              onChange={(e) => setCharacter(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Character name"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="tags">Tags</Label>
            <div className="flex gap-2 mt-1">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Add tag"
                onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
              />
              <Button variant="outline" onClick={handleAddTag}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {character.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {character.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <X 
                      className="w-3 h-3 cursor-pointer" 
                      onClick={() => handleRemoveTag(tag)}
                    />
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="description" className="w-full">
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="description">
            <FileText className="w-4 h-4 mr-1" />
            Description
          </TabsTrigger>
          <TabsTrigger value="dialogue">
            <MessageSquare className="w-4 h-4 mr-1" />
            Dialogue
          </TabsTrigger>
          <TabsTrigger value="prompt">
            <Sparkles className="w-4 h-4 mr-1" />
            Prompts
          </TabsTrigger>
          <TabsTrigger value="sprites">
            <ImageIcon className="w-4 h-4 mr-1" />
            Sprites
          </TabsTrigger>
          <TabsTrigger value="voice">
            <Mic className="w-4 h-4 mr-1" />
            Voice
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="h-[400px] mt-4">
          <TabsContent value="description" className="space-y-4 mt-0">
            <div>
              <Label htmlFor="description">Description</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Detailed description of the character, their background, appearance, and key traits.
              </p>
              <Textarea
                id="description"
                value={character.description}
                onChange={(e) => setCharacter(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe your character in detail..."
                className="min-h-[150px]"
              />
            </div>

            <div>
              <Label htmlFor="personality">Personality</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Character traits, mannerisms, and behavioral patterns.
              </p>
              <Textarea
                id="personality"
                value={character.personality}
                onChange={(e) => setCharacter(prev => ({ ...prev, personality: e.target.value }))}
                placeholder="Describe the character's personality..."
                className="min-h-[100px]"
              />
            </div>

            <div>
              <Label htmlFor="scenario">Scenario</Label>
              <p className="text-xs text-muted-foreground mb-2">
                The setting or scenario where the character exists.
              </p>
              <Textarea
                id="scenario"
                value={character.scenario}
                onChange={(e) => setCharacter(prev => ({ ...prev, scenario: e.target.value }))}
                placeholder="Describe the scenario or setting..."
                className="min-h-[100px]"
              />
            </div>
          </TabsContent>

          <TabsContent value="dialogue" className="space-y-4 mt-0">
            <div>
              <Label htmlFor="firstMes">First Message</Label>
              <p className="text-xs text-muted-foreground mb-2">
                The first message the character will send to start the conversation.
              </p>
              <Textarea
                id="firstMes"
                value={character.firstMes}
                onChange={(e) => setCharacter(prev => ({ ...prev, firstMes: e.target.value }))}
                placeholder="Character's opening message..."
                className="min-h-[150px]"
              />
            </div>

            <div>
              <Label htmlFor="mesExample">Example Dialogue</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Example conversations to help the AI understand how the character speaks.
              </p>
              <Textarea
                id="mesExample"
                value={character.mesExample}
                onChange={(e) => setCharacter(prev => ({ ...prev, mesExample: e.target.value }))}
                placeholder={`<START>
{{user}}: Hello!
{{char}}: *smiles warmly* Hello there! How can I help you today?`}
                className="min-h-[200px] font-mono text-sm"
              />
            </div>

            <div>
              <Label>Alternate Greetings</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Alternative first messages for different scenarios.
              </p>
              <Button variant="outline" className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Add Alternate Greeting
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="prompt" className="space-y-4 mt-0">
            <div>
              <Label htmlFor="systemPrompt">System Prompt</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Override the default system prompt for this character. Leave empty to use default.
              </p>
              <Textarea
                id="systemPrompt"
                value={character.systemPrompt}
                onChange={(e) => setCharacter(prev => ({ ...prev, systemPrompt: e.target.value }))}
                placeholder="Custom system prompt..."
                className="min-h-[150px] font-mono text-sm"
              />
            </div>

            <div>
              <Label htmlFor="postHistoryInstructions">Post-History Instructions</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Instructions added after the chat history. Use for reminders or specific formatting.
              </p>
              <Textarea
                id="postHistoryInstructions"
                value={character.postHistoryInstructions}
                onChange={(e) => setCharacter(prev => ({ ...prev, postHistoryInstructions: e.target.value }))}
                placeholder="Instructions after history..."
                className="min-h-[100px] font-mono text-sm"
              />
            </div>

            <div>
              <Label htmlFor="characterNote">Character&apos;s Note</Label>
              <p className="text-xs text-muted-foreground mb-2">
                A note that is sent to the AI with each message to influence behavior. Use this to add temporary instructions or reminders for the character during chat.
              </p>
              <Textarea
                id="characterNote"
                value={character.characterNote}
                onChange={(e) => setCharacter(prev => ({ ...prev, characterNote: e.target.value }))}
                placeholder="[Write a note that will be sent to the AI to influence the character's behavior...]"
                className="min-h-[100px] font-mono text-sm"
              />
            </div>

            <div>
              <Label htmlFor="creatorNotes">Creator Notes</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Notes about the character (not sent to AI). These are for your own reference.
              </p>
              <Textarea
                id="creatorNotes"
                value={character.creatorNotes}
                onChange={(e) => setCharacter(prev => ({ ...prev, creatorNotes: e.target.value }))}
                placeholder="Your notes about this character..."
                className="min-h-[100px]"
              />
            </div>
          </TabsContent>

          <TabsContent value="sprites" className="space-y-4 mt-0">
            <div className="text-center py-8 text-muted-foreground">
              <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Sprites allow you to add different expressions for your character.</p>
              <Button variant="outline" className="mt-4">
                <Plus className="w-4 h-4 mr-2" />
                Add Sprite
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="voice" className="space-y-4 mt-0">
            <div className="text-center py-8 text-muted-foreground">
              <Mic className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Configure text-to-speech for this character.</p>
              <Button variant="outline" className="mt-4">
                Enable Voice
              </Button>
            </div>
          </TabsContent>
        </ScrollArea>
      </Tabs>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSave}>
          {characterId ? 'Save Changes' : 'Create Character'}
        </Button>
      </div>
    </div>
  );
}
