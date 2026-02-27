'use client';

import { useTavernStore } from '@/store/tavern-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { 
  Plus, 
  Trash2, 
  Check, 
  User,
  Edit2,
  X,
  Upload
} from 'lucide-react';
import { useState, useRef } from 'react';
import type { Persona } from '@/types';

export function PersonaPanel() {
  const { 
    personas, 
    activePersonaId,
    addPersona, 
    updatePersona, 
    deletePersona, 
    setActivePersona 
  } = useTavernStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    name: string;
    description: string;
    avatar: string;
  }>({
    name: '',
    description: '',
    avatar: ''
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCreatePersona = () => {
    const newPersona: Omit<Persona, 'id' | 'createdAt' | 'updatedAt'> = {
      name: 'New Persona',
      description: '',
      avatar: '',
      isActive: false
    };
    addPersona(newPersona);
    // Start editing the new persona
    const newId = personas.length > 0 ? 'new' : 'temp'; // Will be replaced
    setEditingId(newId);
    setEditForm({
      name: 'New Persona',
      description: '',
      avatar: ''
    });
  };

  const handleStartEdit = (persona: Persona) => {
    setEditingId(persona.id);
    setEditForm({
      name: persona.name,
      description: persona.description,
      avatar: persona.avatar
    });
  };

  const handleSaveEdit = (id: string) => {
    if (!editForm.name.trim()) return;
    
    updatePersona(id, {
      name: editForm.name.trim(),
      description: editForm.description,
      avatar: editForm.avatar
    });
    setEditingId(null);
    setEditForm({ name: '', description: '', avatar: '' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({ name: '', description: '', avatar: '' });
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>, personaId?: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (personaId) {
        // Update existing persona
        updatePersona(personaId, { avatar: dataUrl });
      } else {
        // Update edit form
        setEditForm(prev => ({ ...prev, avatar: dataUrl }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDelete = (id: string) => {
    if (id === 'default') {
      alert('Cannot delete the default persona');
      return;
    }
    if (confirm('Are you sure you want to delete this persona?')) {
      deletePersona(id);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Personas</h3>
          <p className="text-sm text-muted-foreground">
            Define who you are in the roleplay
          </p>
        </div>
        <Button size="sm" onClick={handleCreatePersona}>
          <Plus className="w-4 h-4 mr-1" />
          New Persona
        </Button>
      </div>

      {/* Active Persona Preview */}
      {activePersonaId && (
        <div className="p-3 rounded-lg border bg-primary/5 border-primary/20">
          <p className="text-xs text-muted-foreground mb-2">Active Persona</p>
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10">
              <AvatarImage src={personas.find(p => p.id === activePersonaId)?.avatar} />
              <AvatarFallback>
                <User className="w-5 h-5" />
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">
                {personas.find(p => p.id === activePersonaId)?.name || 'User'}
              </p>
              {personas.find(p => p.id === activePersonaId)?.description && (
                <p className="text-xs text-muted-foreground line-clamp-1">
                  {personas.find(p => p.id === activePersonaId)?.description}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Persona List */}
      <ScrollArea className="h-[400px] pr-4">
        <div className="space-y-2">
          {personas.map((persona) => (
            <div
              key={persona.id}
              className={cn(
                'p-3 rounded-lg border transition-colors',
                persona.id === activePersonaId 
                  ? 'border-primary bg-primary/5' 
                  : 'bg-background hover:bg-muted/50'
              )}
            >
              {editingId === persona.id ? (
                // Edit Mode
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="relative">
                      <Avatar className="w-12 h-12 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                        <AvatarImage src={editForm.avatar} />
                        <AvatarFallback>
                          <User className="w-6 h-6" />
                        </AvatarFallback>
                      </Avatar>
                      <Button
                        size="icon"
                        variant="secondary"
                        className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="w-3 h-3" />
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleAvatarUpload(e)}
                      />
                    </div>
                    <div className="flex-1 space-y-2">
                      <Input
                        value={editForm.name}
                        onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Persona Name"
                        className="h-8"
                      />
                    </div>
                  </div>
                  <Textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe your persona's personality, background, or any details you want the AI to know about you..."
                    rows={3}
                    className="text-sm resize-none"
                  />
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                      <X className="w-4 h-4 mr-1" />
                      Cancel
                    </Button>
                    <Button size="sm" onClick={() => handleSaveEdit(persona.id)}>
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                // View Mode
                <div className="flex items-start gap-3">
                  <Avatar className="w-10 h-10 flex-shrink-0">
                    <AvatarImage src={persona.avatar} />
                    <AvatarFallback>
                      <User className="w-5 h-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{persona.name}</p>
                      {persona.id === activePersonaId && (
                        <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                          Active
                        </span>
                      )}
                      {persona.id === 'default' && (
                        <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                          Default
                        </span>
                      )}
                    </div>
                    {persona.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {persona.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {persona.id !== activePersonaId && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => setActivePersona(persona.id)}
                        title="Set as active"
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => handleStartEdit(persona)}
                      title="Edit persona"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    {persona.id !== 'default' && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(persona.id)}
                        title="Delete persona"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {personas.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <User className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No personas created yet</p>
              <p className="text-xs mt-1">Create a persona to define who you are in roleplays</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Help Text */}
      <div className="p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-1">About Personas</p>
        <p>
          Personas define your identity in the roleplay. When you create a persona with a name 
          and description, the AI will use this information to understand who it&apos;s talking to.
          This adds depth and personalization to your conversations.
        </p>
      </div>
    </div>
  );
}
