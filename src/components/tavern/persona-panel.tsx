'use client';

import { useTavernStore } from '@/store/tavern-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  Plus, 
  Trash2, 
  Check, 
  User,
  Edit2,
  X,
  Upload,
  Loader2,
  HelpCircle,
  Users,
  Sparkles
} from 'lucide-react';
import { useState, useRef } from 'react';
import type { Persona } from '@/types';
import { getLogger } from '@/lib/logger';

const personaLogger = getLogger('persona');

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
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCreatePersona = () => {
    const newPersona: Omit<Persona, 'id' | 'createdAt' | 'updatedAt'> = {
      name: 'Nueva Persona',
      description: '',
      avatar: '',
      isActive: false
    };
    addPersona(newPersona);
    // Start editing the new persona
    const newId = personas.length > 0 ? 'new' : 'temp'; // Will be replaced
    setEditingId(newId);
    setEditForm({
      name: 'Nueva Persona',
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

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>, personaId?: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 2MB for base64)
    if (file.size > 2 * 1024 * 1024) {
      alert('Imagen muy grande. El tamaño máximo es 2MB.');
      return;
    }

    setUploading(true);
    
    try {
      // Convert to base64 for persistent storage
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        
        if (personaId) {
          // Update existing persona
          updatePersona(personaId, { avatar: base64 });
        } else {
          // Update edit form
          setEditForm(prev => ({ ...prev, avatar: base64 }));
        }
        setUploading(false);
      };
      reader.onerror = () => {
        alert('Error al leer la imagen');
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      personaLogger.error('Upload error', { error });
      alert(error instanceof Error ? error.message : 'Error al subir imagen');
      setUploading(false);
    } finally {
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = (id: string) => {
    if (id === 'default') {
      alert('No se puede eliminar la persona por defecto');
      return;
    }
    if (confirm('¿Estás seguro de que deseas eliminar esta persona?')) {
      deletePersona(id);
    }
  };

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col gap-4">
        {/* Banner Informativo */}
        <div className="bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/20 rounded-lg p-3 flex-shrink-0">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-violet-500/20 rounded-lg">
              <Users className="w-5 h-5 text-violet-500" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-violet-600 dark:text-violet-400">Sistema de Personas</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Las personas definen tu <strong>identidad</strong> en el roleplay. La IA usará esta información 
                para entender con quién está hablando y adaptar sus respuestas.
              </p>
            </div>
          </div>
        </div>

        {/* Active Persona Preview */}
        {activePersonaId && (
          <div className="p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20 flex-shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-emerald-600 font-medium">Persona Activa</span>
            </div>
            <div className="flex items-center gap-3">
              <Avatar className="w-10 h-10 border-2 border-emerald-500/30">
                <AvatarImage src={personas.find(p => p.id === activePersonaId)?.avatar} />
                <AvatarFallback className="bg-emerald-500/20">
                  <User className="w-5 h-5 text-emerald-600" />
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-sm">
                  {personas.find(p => p.id === activePersonaId)?.name || 'Usuario'}
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

        {/* Sección: Lista de Personas */}
        <div className="p-3 bg-muted/30 rounded-lg border border-border/40 flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-3 flex-shrink-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <User className="w-3.5 h-3.5" />
              <span className="font-medium">Personas</span>
              <Badge variant="secondary" className="text-xs">{personas.length}</Badge>
            </div>
            <Button size="sm" className="h-7 text-xs" onClick={handleCreatePersona}>
              <Plus className="w-3 h-3 mr-1" />
              Nueva
            </Button>
          </div>

          <ScrollArea className="flex-1">
            <div className="grid grid-cols-2 gap-3 pr-2">
              {personas.map((persona) => (
                <div
                  key={persona.id}
                  className={cn(
                    'p-3 rounded-lg border transition-colors',
                    persona.id === activePersonaId 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border/40 bg-background hover:bg-muted/50'
                  )}
                >
                  {editingId === persona.id ? (
                    // Edit Mode
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="relative">
                          <Avatar 
                            className={cn(
                              "w-12 h-12 border-2 border-dashed border-muted-foreground/30", 
                              !uploading && "cursor-pointer hover:border-primary/50"
                            )} 
                            onClick={() => !uploading && fileInputRef.current?.click()}
                          >
                            <AvatarImage src={editForm.avatar} />
                            <AvatarFallback>
                              {uploading ? (
                                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                              ) : (
                                <User className="w-6 h-6 text-muted-foreground" />
                              )}
                            </AvatarFallback>
                          </Avatar>
                          <Button
                            size="icon"
                            variant="secondary"
                            className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                          >
                            {uploading ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Upload className="w-3 h-3" />
                            )}
                          </Button>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleAvatarUpload(e)}
                            disabled={uploading}
                          />
                        </div>
                        <div className="flex-1">
                          <Input
                            value={editForm.name}
                            onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="Nombre de Persona"
                            className="h-8"
                            disabled={uploading}
                          />
                        </div>
                      </div>
                      <Textarea
                        value={editForm.description}
                        onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Describe la personalidad, antecedentes..."
                        rows={2}
                        className="text-sm resize-none"
                        disabled={uploading}
                      />
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={handleCancelEdit} disabled={uploading} className="h-7 text-xs">
                          <X className="w-3 h-3 mr-1" />
                          Cancelar
                        </Button>
                        <Button size="sm" onClick={() => handleSaveEdit(persona.id)} disabled={uploading} className="h-7 text-xs">
                          {uploading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
                          Guardar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // View Mode
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <Avatar className="w-9 h-9 flex-shrink-0">
                          <AvatarImage src={persona.avatar} />
                          <AvatarFallback>
                            <User className="w-4 h-4" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-medium text-sm truncate">{persona.name}</p>
                            {persona.id === activePersonaId && (
                              <Badge className="text-[10px] bg-emerald-500/20 text-emerald-600 border-0 py-0 px-1.5">
                                Activa
                              </Badge>
                            )}
                          </div>
                          {persona.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                              {persona.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-1">
                        {persona.id !== activePersonaId && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                            onClick={() => setActivePersona(persona.id)}
                          >
                            <Check className="w-3 h-3 mr-1" />
                            Activar
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          onClick={() => handleStartEdit(persona)}
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                        {persona.id !== 'default' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(persona.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {personas.length === 0 && (
                <div className="col-span-2 text-center py-8 text-muted-foreground bg-muted/30 rounded-lg border border-dashed">
                  <User className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p className="text-sm font-medium">Sin personas creadas</p>
                  <p className="text-xs mt-1">Crea una persona para definir quién eres en los roleplays</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Help Text */}
        <div className="p-3 bg-cyan-500/5 border border-cyan-500/20 rounded-lg text-xs flex-shrink-0">
          <div className="flex items-start gap-2">
            <HelpCircle className="w-4 h-4 text-cyan-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-foreground">Acerca de Personas</p>
              <p className="text-muted-foreground mt-1">
                Las personas definen tu identidad en el roleplay. Cuando creas una persona con un nombre 
                y descripción, la IA usará esta información para entender con quién está hablando.
              </p>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
