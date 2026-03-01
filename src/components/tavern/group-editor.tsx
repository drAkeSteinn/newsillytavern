'use client';

import { useTavernStore } from '@/store/tavern-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  Users, 
  UserCheck, 
  UserX,
  Eye,
  EyeOff,
  MessageSquare,
  HelpCircle,
  Crown,
  User,
  Binoculars,
  Sparkles,
  RefreshCw,
  Shuffle,
  Zap,
  Brain,
  Settings,
  Layers
} from 'lucide-react';
import { useState, useMemo } from 'react';
import type { GroupMember, GroupActivationStrategy } from '@/types';
import { HUDSelector } from './hud-selector';

interface GroupEditorProps {
  groupId: string | null;
  onClose: () => void;
}

const strategyInfo: Record<GroupActivationStrategy, { 
  name: string; 
  description: string; 
  icon: React.ReactNode;
  tip: string 
}> = {
  all: { 
    name: 'Todos Responden', 
    description: 'Todos los miembros activos responden',
    icon: <Users className="w-3.5 h-3.5" />,
    tip: 'Ideal para conversaciones grupales animadas.'
  },
  round_robin: { 
    name: 'Por Turno', 
    description: 'Los miembros responden en orden',
    icon: <RefreshCw className="w-3.5 h-3.5" />,
    tip: 'Útil para mantener un flujo ordenado.'
  },
  random: { 
    name: 'Aleatorio', 
    description: 'Miembro(s) aleatorio(s) responden',
    icon: <Shuffle className="w-3.5 h-3.5" />,
    tip: 'Crea dinamismo y sorpresa.'
  },
  reactive: { 
    name: 'Reactivo', 
    description: 'Solo los mencionados responden',
    icon: <Zap className="w-3.5 h-3.5" />,
    tip: 'Los personajes responden al ser mencionados.'
  },
  smart: { 
    name: 'Inteligente', 
    description: 'La IA decide quién responde',
    icon: <Brain className="w-3.5 h-3.5" />,
    tip: 'El modelo elige el personaje más apropiado.'
  }
};

export function GroupEditor({ groupId, onClose }: GroupEditorProps) {
  const {
    characters,
    groups,
    addGroup,
    updateGroup,
    deleteGroup,
    addGroupMember,
    removeGroupMember,
    toggleGroupMemberActive,
    toggleGroupMemberPresent,
    updateGroupMember
  } = useTavernStore();

  const isNewGroup = !groupId;
  const existingGroup = groups.find(g => g.id === groupId);

  // Get initial values from existing group or defaults
  const initialValues = useMemo(() => {
    if (existingGroup) {
      return {
        name: existingGroup.name || '',
        description: existingGroup.description || '',
        systemPrompt: existingGroup.systemPrompt || '',
        activationStrategy: existingGroup.activationStrategy || 'all' as GroupActivationStrategy,
        maxResponsesPerTurn: existingGroup.maxResponsesPerTurn ?? 3,
        allowMentions: existingGroup.allowMentions ?? true,
        mentionTriggers: existingGroup.mentionTriggers || [],
        conversationStyle: existingGroup.conversationStyle || 'sequential' as 'sequential' | 'parallel',
        hudTemplateId: existingGroup?.hudTemplateId || null
      };
    }
    return {
      name: '',
      description: '',
      systemPrompt: '',
      activationStrategy: 'all' as GroupActivationStrategy,
      maxResponsesPerTurn: 3,
      allowMentions: true,
      mentionTriggers: [],
      conversationStyle: 'sequential' as 'sequential' | 'parallel',
      hudTemplateId: null
    };
  }, [existingGroup]);

  // Local state for new group members (before saving)
  const [localMembers, setLocalMembers] = useState<GroupMember[]>([]);

  // Initialize state from existing group or defaults
  const [name, setName] = useState(initialValues.name);
  const [description, setDescription] = useState(initialValues.description);
  const [systemPrompt, setSystemPrompt] = useState(initialValues.systemPrompt);
  const [activationStrategy, setActivationStrategy] = useState<GroupActivationStrategy>(initialValues.activationStrategy);
  const [maxResponsesPerTurn, setMaxResponsesPerTurn] = useState(initialValues.maxResponsesPerTurn);
  const [allowMentions, setAllowMentions] = useState(initialValues.allowMentions);
  const [conversationStyle, setConversationStyle] = useState<'sequential' | 'parallel'>(initialValues.conversationStyle);
  const [hudTemplateId, setHudTemplateId] = useState<string | null>(initialValues.hudTemplateId);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>('');

  // Get members - either from existing group or local state
  const members = useMemo(() => {
    if (isNewGroup) {
      return localMembers;
    }
    return existingGroup?.members || [];
  }, [isNewGroup, localMembers, existingGroup?.members]);

  // Member characters with character data
  const memberCharacters = useMemo(() => {
    return members
      .map(m => ({
        ...m,
        character: characters.find(c => c.id === m.characterId)
      }))
      .filter(m => m.character);
  }, [members, characters]);

  // Get available characters (not in group)
  const memberIds = useMemo(() => members.map(m => m.characterId), [members]);
  const availableCharacters = useMemo(() => 
    characters.filter(c => !memberIds.includes(c.id)),
    [characters, memberIds]
  );

  // Local handlers for new groups
  const handleLocalAddMember = (characterId: string, role: 'leader' | 'member' | 'observer' = 'member') => {
    const newMember: GroupMember = {
      characterId,
      role,
      isActive: true,
      isPresent: true,
      joinOrder: localMembers.length
    };
    setLocalMembers([...localMembers, newMember]);
  };

  const handleLocalRemoveMember = (characterId: string) => {
    setLocalMembers(localMembers.filter(m => m.characterId !== characterId));
  };

  const handleLocalToggleActive = (characterId: string) => {
    setLocalMembers(localMembers.map(m => 
      m.characterId === characterId ? { ...m, isActive: !m.isActive } : m
    ));
  };

  const handleLocalTogglePresent = (characterId: string) => {
    setLocalMembers(localMembers.map(m => 
      m.characterId === characterId ? { ...m, isPresent: !m.isPresent } : m
    ));
  };

  const handleLocalRoleChange = (characterId: string, role: 'leader' | 'member' | 'observer') => {
    setLocalMembers(localMembers.map(m => 
      m.characterId === characterId ? { ...m, role } : m
    ));
  };

  const handleSave = () => {
    if (!name.trim()) {
      alert('El nombre del grupo es requerido');
      return;
    }

    if (memberCharacters.length === 0) {
      alert('Agrega al menos un personaje al grupo');
      return;
    }

    const groupData = {
      name: name.trim(),
      description,
      systemPrompt,
      activationStrategy,
      maxResponsesPerTurn,
      allowMentions,
      mentionTriggers: [],
      conversationStyle,
      characterIds: memberIds,
      members,
      avatar: existingGroup?.avatar || '',
      hudTemplateId
    };

    if (isNewGroup) {
      addGroup(groupData);
    } else {
      updateGroup(groupId, groupData);
    }

    onClose();
  };

  const handleDelete = () => {
    if (!isNewGroup && confirm('¿Estás seguro de que quieres eliminar este grupo?')) {
      deleteGroup(groupId);
      onClose();
    }
  };

  const handleAddMember = () => {
    if (!selectedCharacterId) return;
    
    if (isNewGroup) {
      handleLocalAddMember(selectedCharacterId, 'member');
    } else {
      addGroupMember(groupId, selectedCharacterId, 'member');
    }
    setSelectedCharacterId('');
  };

  const handleRemoveMember = (characterId: string) => {
    if (isNewGroup) {
      handleLocalRemoveMember(characterId);
    } else {
      removeGroupMember(groupId, characterId);
    }
  };

  const handleToggleActive = (characterId: string) => {
    if (isNewGroup) {
      handleLocalToggleActive(characterId);
    } else {
      toggleGroupMemberActive(groupId, characterId);
    }
  };

  const handleTogglePresent = (characterId: string) => {
    if (isNewGroup) {
      handleLocalTogglePresent(characterId);
    } else {
      toggleGroupMemberPresent(groupId, characterId);
    }
  };

  const handleRoleChange = (characterId: string, role: 'leader' | 'member' | 'observer') => {
    if (isNewGroup) {
      handleLocalRoleChange(characterId, role);
    } else {
      updateGroupMember(groupId, characterId, { role });
    }
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-[1fr_1fr] gap-6 p-6">
            {/* Left Column: Basic Info & Members */}
            <div className="space-y-4">
              {/* Basic Info */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="name" className="text-xs">Nombre del Grupo *</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Nombre..."
                      className="mt-1 h-8"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Estilo de Conversación</Label>
                    <Select
                      value={conversationStyle}
                      onValueChange={(v) => setConversationStyle(v as 'sequential' | 'parallel')}
                    >
                      <SelectTrigger className="mt-1 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sequential">
                          <div className="flex items-center gap-1.5 text-xs">
                            <RefreshCw className="w-3 h-3" />
                            Secuencial
                          </div>
                        </SelectItem>
                        <SelectItem value="parallel">
                          <div className="flex items-center gap-1.5 text-xs">
                            <Sparkles className="w-3 h-3" />
                            Paralelo
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="description" className="text-xs">Descripción / Escenario</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe el escenario..."
                    rows={2}
                    className="mt-1 text-sm"
                  />
                </div>

                {/* HUD Selector */}
                <div className="pt-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Layers className="w-3.5 h-3.5 text-muted-foreground" />
                    <Label className="text-xs">Plantilla HUD</Label>
                  </div>
                  <HUDSelector
                    value={hudTemplateId}
                    onChange={setHudTemplateId}
                    placeholder="Sin HUD asignado"
                  />
                </div>
              </div>

              {/* Members */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-sm flex items-center gap-1.5">
                    <Users className="w-4 h-4" />
                    Miembros ({memberCharacters.length})
                  </h3>
                </div>

                {/* Add Member */}
                <div className="flex gap-2">
                  <Select value={selectedCharacterId} onValueChange={setSelectedCharacterId}>
                    <SelectTrigger className="flex-1 h-8">
                      <SelectValue placeholder="Seleccionar personaje..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCharacters.length === 0 ? (
                        <div className="px-2 py-3 text-center text-xs text-muted-foreground">
                          No hay personajes disponibles
                        </div>
                      ) : (
                        availableCharacters.map((char) => (
                          <SelectItem key={char.id} value={char.id}>
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 rounded-full overflow-hidden bg-muted flex-shrink-0">
                                {char.avatar ? (
                                  <img src={char.avatar} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-400 to-orange-600">
                                    <span className="text-white text-[10px] font-bold">{char.name[0]}</span>
                                  </div>
                                )}
                              </div>
                              <span className="text-sm">{char.name}</span>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <Button 
                    onClick={handleAddMember} 
                    disabled={!selectedCharacterId}
                    size="sm"
                    className="h-8"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                {/* Member List */}
                <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
                  {memberCharacters.map((member, index) => (
                    <div
                      key={member.characterId}
                      className="flex items-center gap-3 p-2 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                    >
                      {/* Avatar */}
                      <div className="w-9 h-9 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                        {member.character?.avatar ? (
                          <img 
                            src={member.character.avatar} 
                            alt={member.character.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-400 to-orange-600">
                            <span className="text-white font-bold text-sm">
                              {member.character?.name?.[0]?.toUpperCase() || '?'}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">{member.character?.name}</p>
                          <Select
                            value={member.role}
                            onValueChange={(v) => handleRoleChange(member.characterId, v as 'leader' | 'member' | 'observer')}
                          >
                            <SelectTrigger className="w-20 h-6 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="leader">
                                <div className="flex items-center gap-1 text-xs">
                                  <Crown className="w-2.5 h-2.5 text-amber-500" />
                                  Líder
                                </div>
                              </SelectItem>
                              <SelectItem value="member">
                                <div className="flex items-center gap-1 text-xs">
                                  <User className="w-2.5 h-2.5" />
                                  Miembro
                                </div>
                              </SelectItem>
                              <SelectItem value="observer">
                                <div className="flex items-center gap-1 text-xs">
                                  <Binoculars className="w-2.5 h-2.5 text-blue-500" />
                                  Obs.
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        {/* Status */}
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Badge 
                            variant={member.isActive ? 'default' : 'secondary'}
                            className="text-[10px] cursor-pointer py-0 px-1"
                            onClick={() => handleToggleActive(member.characterId)}
                          >
                            {member.isActive ? 'Activo' : 'Inactivo'}
                          </Badge>
                          <Badge 
                            variant={member.isPresent ? 'outline' : 'secondary'}
                            className="text-[10px] cursor-pointer py-0 px-1"
                            onClick={() => handleTogglePresent(member.characterId)}
                          >
                            {member.isPresent ? 'Presente' : 'Ausente'}
                          </Badge>
                        </div>
                      </div>

                      {/* Remove */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemoveMember(member.characterId)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}

                  {memberCharacters.length === 0 && (
                    <div className="text-xs text-muted-foreground text-center py-6 border-2 border-dashed rounded-lg">
                      <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p>Sin miembros aún</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Strategy & Settings */}
            <div className="space-y-4">
              {/* Strategy Settings */}
              <div className="space-y-3">
                <h3 className="font-medium text-sm flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4" />
                  Estrategia de Respuesta
                </h3>

                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(strategyInfo).map(([key, info]) => (
                    <button
                      key={key}
                      onClick={() => setActivationStrategy(key as GroupActivationStrategy)}
                      className={cn(
                        "p-2.5 rounded-lg border text-left transition-colors",
                        activationStrategy === key 
                          ? "border-primary bg-primary/10" 
                          : "hover:bg-muted/50"
                      )}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        {info.icon}
                        <span className="text-xs font-medium">{info.name}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">{info.description}</p>
                    </button>
                  ))}
                </div>

                <div className="p-2.5 rounded-lg bg-muted/50 border">
                  <p className="text-xs text-primary">
                    💡 {strategyInfo[activationStrategy].tip}
                  </p>
                </div>

                {activationStrategy !== 'all' && (
                  <div>
                    <Label htmlFor="maxResponses" className="text-xs">Máx. Respuestas por Turno</Label>
                    <Input
                      id="maxResponses"
                      type="number"
                      min={1}
                      max={10}
                      value={maxResponsesPerTurn}
                      onChange={(e) => setMaxResponsesPerTurn(parseInt(e.target.value) || 1)}
                      className="mt-1 w-20 h-8"
                    />
                  </div>
                )}
              </div>

              {/* Mentions */}
              <label className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50">
                <div>
                  <Label className="text-sm">Detección de Menciones</Label>
                  <p className="text-xs text-muted-foreground">Detectar nombres en mensajes</p>
                </div>
                <Switch
                  checked={allowMentions}
                  onCheckedChange={setAllowMentions}
                />
              </label>

              {/* Custom System Prompt */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="systemPrompt" className="text-xs">Prompt de Sistema Personalizado</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Instrucciones adicionales para todos los personajes del grupo.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Textarea
                  id="systemPrompt"
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="Instrucciones adicionales para el grupo..."
                  rows={4}
                  className="text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t p-3 bg-background flex justify-between items-center flex-shrink-0">
          {!isNewGroup && (
            <Button variant="destructive" onClick={handleDelete} size="sm">
              <Trash2 className="w-4 h-4 mr-1" />
              Eliminar
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={onClose} size="sm">
              Cancelar
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={!name.trim() || memberCharacters.length === 0}
              size="sm"
            >
              {isNewGroup ? 'Crear Grupo' : 'Guardar'}
            </Button>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

// Button component to open group editor
export function CreateGroupButton() {
  const [editorOpen, setEditorOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        className="w-full justify-start gap-2"
        onClick={() => setEditorOpen(true)}
      >
        <Users className="w-4 h-4" />
        Crear Grupo
      </Button>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-4xl w-[95vw] h-[80vh] overflow-hidden flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 py-3 border-b">
            <DialogTitle className="text-base">Crear Nuevo Grupo</DialogTitle>
          </DialogHeader>
          <GroupEditor groupId={null} onClose={() => setEditorOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
