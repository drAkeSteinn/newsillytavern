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
  Sparkles,
  RefreshCw,
  Shuffle,
  Zap,
  Brain,
  Settings,
  Layers,
  BookOpen,
  ScrollText,
  Package,
  Palette,
  Ghost
} from 'lucide-react';
import { useState, useMemo } from 'react';
import type { GroupMember, GroupActivationStrategy, NarratorResponseMode, NarratorSettings } from '@/types';
import { HUDSelector } from './hud-selector';
import { LorebookSelector } from './lorebook-selector';
import { QuestSelector } from './quest-selector';

// Default narrator settings
const DEFAULT_NARRATOR_SETTINGS: NarratorSettings = {
  responseMode: 'turn_end',
  conditional: {
    minTurnInterval: 0,
    onlyWhenNoActiveQuests: false
  },
  hiddenFromChat: false,
  showSprite: false
};

// Narrator response mode info
const narratorModeInfo: Record<NarratorResponseMode, {
  name: string;
  description: string;
  icon: React.ReactNode;
}> = {
  turn_start: {
    name: 'Inicio del Turno',
    description: 'El narrador habla primero, antes que cualquier personaje',
    icon: <RefreshCw className="w-3.5 h-3.5" />
  },
  turn_end: {
    name: 'Final del Turno',
    description: 'El narrador habla último, después de todos los personajes',
    icon: <RefreshCw className="w-3.5 h-3.5" />
  },
  before_each: {
    name: 'Antes de Cada Personaje',
    description: 'El narrador habla antes de cada respuesta de personaje',
    icon: <Users className="w-3.5 h-3.5" />
  },
  after_each: {
    name: 'Después de Cada Personaje',
    description: 'El narrador habla después de cada respuesta de personaje',
    icon: <Users className="w-3.5 h-3.5" />
  }
};

interface GroupEditorProps {
  groupId: string | null;
  onClose: () => void;
}

const strategyInfo: Record<GroupActivationStrategy, { 
  name: string; 
  description: string; 
  icon: React.ReactNode;
  tip: string;
  color: string;
}> = {
  all: { 
    name: 'Todos Responden', 
    description: 'Todos los miembros activos responden',
    icon: <Users className="w-3.5 h-3.5" />,
    tip: 'Ideal para conversaciones grupales animadas.',
    color: 'emerald'
  },
  round_robin: { 
    name: 'Por Turno', 
    description: 'Los miembros responden en orden',
    icon: <RefreshCw className="w-3.5 h-3.5" />,
    tip: 'Útil para mantener un flujo ordenado.',
    color: 'blue'
  },
  random: { 
    name: 'Aleatorio', 
    description: 'Miembro(s) aleatorio(s) responden',
    icon: <Shuffle className="w-3.5 h-3.5" />,
    tip: 'Crea dinamismo y sorpresa.',
    color: 'purple'
  },
  reactive: { 
    name: 'Reactivo', 
    description: 'Solo los mencionados responden',
    icon: <Zap className="w-3.5 h-3.5" />,
    tip: 'Los personajes responden al ser mencionados.',
    color: 'amber'
  },
  smart: { 
    name: 'Inteligente', 
    description: 'La IA decide quién responde',
    icon: <Brain className="w-3.5 h-3.5" />,
    tip: 'El modelo elige el personaje más apropiado.',
    color: 'cyan'
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
    toggleGroupMemberNarrator,
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
        hudTemplateId: existingGroup?.hudTemplateId || null,
        lorebookIds: existingGroup?.lorebookIds || [],
        questTemplateIds: existingGroup?.questTemplateIds || [],
        narratorSettings: existingGroup?.narratorSettings || DEFAULT_NARRATOR_SETTINGS
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
      hudTemplateId: null,
      lorebookIds: [],
      questTemplateIds: [],
      narratorSettings: DEFAULT_NARRATOR_SETTINGS
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
  const [lorebookIds, setLorebookIds] = useState<string[]>(initialValues.lorebookIds);
  const [questTemplateIds, setQuestTemplateIds] = useState<string[]>(initialValues.questTemplateIds);
  const [narratorSettings, setNarratorSettings] = useState<NarratorSettings>(initialValues.narratorSettings);
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
  const handleLocalAddMember = (characterId: string) => {
    const newMember: GroupMember = {
      characterId,
      isActive: true,
      isPresent: true,
      isNarrator: false,
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

  const handleLocalToggleNarrator = (characterId: string) => {
    setLocalMembers(localMembers.map(m =>
      m.characterId === characterId ? { ...m, isNarrator: !m.isNarrator } : m
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

    // Check if there's a narrator in the group
    const hasNarrator = members.some(m => m.isNarrator);

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
      hudTemplateId,
      lorebookIds,
      questTemplateIds,
      // Only include narratorSettings if there's a narrator in the group
      ...(hasNarrator && { narratorSettings })
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
      handleLocalAddMember(selectedCharacterId);
    } else {
      addGroupMember(groupId, selectedCharacterId);
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

  const handleToggleNarrator = (characterId: string) => {
    if (isNewGroup) {
      handleLocalToggleNarrator(characterId);
    } else {
      toggleGroupMemberNarrator(groupId, characterId);
    }
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-4 p-4">
            {/* Banner informativo */}
            <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-lg p-3">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-indigo-500/20 rounded-lg">
                  <Users className="w-5 h-5 text-indigo-500" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-indigo-600">
                    {isNewGroup ? 'Crear Nuevo Grupo' : 'Editar Grupo'}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Los grupos permiten que <strong>múltiples personajes</strong> interactúen en una misma conversación.
                    Configura la <strong>estrategia de respuesta</strong> y los <strong>miembros</strong> del grupo.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Left Column: Basic Info & Members */}
              <div className="space-y-4">
                {/* Sección: Información Básica */}
                <div className="p-3 bg-muted/30 rounded-lg border border-border/40 space-y-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    <Palette className="w-3.5 h-3.5" />
                    <span className="font-medium">Información Básica</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Label htmlFor="name" className="text-xs">Nombre del Grupo *</Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>Un nombre descriptivo para identificar el grupo.</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Nombre..."
                        className="h-8"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Label className="text-xs">Estilo de Conversación</Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p><strong>Secuencial:</strong> Un personaje a la vez. <strong>Paralelo:</strong> Todos responden simultáneamente.</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Select
                        value={conversationStyle}
                        onValueChange={(v) => setConversationStyle(v as 'sequential' | 'parallel')}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sequential">
                            <div className="flex items-center gap-1.5 text-xs">
                              <RefreshCw className="w-3 h-3 text-blue-500" />
                              Secuencial
                            </div>
                          </SelectItem>
                          <SelectItem value="parallel">
                            <div className="flex items-center gap-1.5 text-xs">
                              <Sparkles className="w-3 h-3 text-purple-500" />
                              Paralelo
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Label htmlFor="description" className="text-xs">Descripción / Escenario</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>Describe el escenario o contexto del grupo.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe el escenario del grupo..."
                      rows={2}
                      className="text-sm"
                    />
                  </div>
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
                          <p>Plantilla HUD para mostrar estadísticas del grupo.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <HUDSelector
                      value={hudTemplateId}
                      onChange={setHudTemplateId}
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
                          <p>Lorebooks compartidos por todos los miembros del grupo.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <LorebookSelector
                      value={lorebookIds}
                      onChange={setLorebookIds}
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
                          <p>Misiones disponibles para el grupo.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <QuestSelector
                      value={questTemplateIds}
                      onChange={setQuestTemplateIds}
                      placeholder="Sin misiones asignadas"
                    />
                  </div>
                </div>

                {/* Sección: Miembros */}
                <div className="p-3 bg-muted/30 rounded-lg border border-border/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Users className="w-3.5 h-3.5" />
                      <span className="font-medium">Miembros</span>
                      <Badge variant="secondary" className="text-xs">{memberCharacters.length}</Badge>
                    </div>
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
                  <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1">
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
                          <p className="font-medium text-sm truncate">{member.character?.name}</p>

                          {/* Status */}
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <Badge
                              variant={member.isActive ? 'default' : 'secondary'}
                              className={cn(
                                "text-[10px] cursor-pointer py-0 px-1",
                                member.isActive && "bg-emerald-500/20 text-emerald-600 hover:bg-emerald-500/30"
                              )}
                              onClick={() => handleToggleActive(member.characterId)}
                            >
                              {member.isActive ? 'Activo' : 'Inactivo'}
                            </Badge>
                            <Badge
                              variant={member.isPresent ? 'outline' : 'secondary'}
                              className={cn(
                                "text-[10px] cursor-pointer py-0 px-1",
                                member.isPresent && "border-blue-500/30 text-blue-600"
                              )}
                              onClick={() => handleTogglePresent(member.characterId)}
                            >
                              {member.isPresent ? 'Presente' : 'Ausente'}
                            </Badge>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge
                                  variant={member.isNarrator ? 'default' : 'secondary'}
                                  className={cn(
                                    "text-[10px] cursor-pointer py-0 px-1",
                                    member.isNarrator && "bg-violet-500/20 text-violet-600 hover:bg-violet-500/30"
                                  )}
                                  onClick={() => handleToggleNarrator(member.characterId)}
                                >
                                  <Ghost className="w-2.5 h-2.5 mr-0.5" />
                                  {member.isNarrator ? 'Narrador' : 'Normal'}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p><strong>Narrador:</strong> Un personaje narrador es un "fantasma" que puede dirigir la escena. Sus mensajes no aparecen en el historial para otros personajes, pero pueden activar triggers.</p>
                              </TooltipContent>
                            </Tooltip>
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
                        <p className="text-[10px] mt-1">Agrega personajes al grupo</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Strategy & Settings */}
              <div className="space-y-4">
                {/* Sección: Estrategia de Respuesta */}
                <div className="p-3 bg-muted/30 rounded-lg border border-border/40 space-y-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span className="font-medium">Estrategia de Respuesta</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(strategyInfo).map(([key, info]) => (
                      <button
                        key={key}
                        onClick={() => setActivationStrategy(key as GroupActivationStrategy)}
                        className={cn(
                          "p-2.5 rounded-lg border text-left transition-colors",
                          activationStrategy === key 
                            ? "border-primary bg-primary/10" 
                            : "hover:bg-muted/50 border-border/40"
                        )}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className={cn(
                            activationStrategy === key && key === 'all' && "text-emerald-500",
                            activationStrategy === key && key === 'round_robin' && "text-blue-500",
                            activationStrategy === key && key === 'random' && "text-purple-500",
                            activationStrategy === key && key === 'reactive' && "text-amber-500",
                            activationStrategy === key && key === 'smart' && "text-cyan-500",
                          )}>
                            {info.icon}
                          </span>
                          <span className="text-xs font-medium">{info.name}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">{info.description}</p>
                      </button>
                    ))}
                  </div>

                  <div className={cn(
                    "p-2.5 rounded-lg border",
                    strategyInfo[activationStrategy].color === 'emerald' && "bg-emerald-500/10 border-emerald-500/20",
                    strategyInfo[activationStrategy].color === 'blue' && "bg-blue-500/10 border-blue-500/20",
                    strategyInfo[activationStrategy].color === 'purple' && "bg-purple-500/10 border-purple-500/20",
                    strategyInfo[activationStrategy].color === 'amber' && "bg-amber-500/10 border-amber-500/20",
                    strategyInfo[activationStrategy].color === 'cyan' && "bg-cyan-500/10 border-cyan-500/20"
                  )}>
                    <p className={cn(
                      "text-xs",
                      strategyInfo[activationStrategy].color === 'emerald' && "text-emerald-600",
                      strategyInfo[activationStrategy].color === 'blue' && "text-blue-600",
                      strategyInfo[activationStrategy].color === 'purple' && "text-purple-600",
                      strategyInfo[activationStrategy].color === 'amber' && "text-amber-600",
                      strategyInfo[activationStrategy].color === 'cyan' && "text-cyan-600"
                    )}>
                      💡 {strategyInfo[activationStrategy].tip}
                    </p>
                  </div>

                  {activationStrategy !== 'all' && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Label htmlFor="maxResponses" className="text-xs">Máx. Respuestas por Turno</Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>Número máximo de personajes que responderán por turno.</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Input
                        id="maxResponses"
                        type="number"
                        min={1}
                        max={10}
                        value={maxResponsesPerTurn}
                        onChange={(e) => setMaxResponsesPerTurn(parseInt(e.target.value) || 1)}
                        className="w-20 h-8"
                      />
                    </div>
                  )}
                </div>

                {/* Mentions */}
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/40">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs font-medium">Detección de Menciones</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>Cuando está activo, los personajes responderán cuando sean mencionados por nombre.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">Detectar nombres en mensajes</p>
                  </div>
                  <Switch
                    checked={allowMentions}
                    onCheckedChange={setAllowMentions}
                  />
                </div>

                {/* Custom System Prompt */}
                <div className="p-3 bg-muted/30 rounded-lg border border-border/40 space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-medium">Prompt de Sistema Personalizado</span>
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
                    className="text-sm font-mono text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Este prompt se añadirá a las instrucciones de cada personaje del grupo.
                  </p>
                </div>

                {/* Narrator Settings - Only show if there's a narrator in the group */}
                {members.some(m => m.isNarrator) && (
                  <div className="p-3 bg-violet-500/10 rounded-lg border border-violet-500/20 space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Ghost className="w-4 h-4 text-violet-500" />
                      <span className="text-xs font-medium text-violet-600">Configuración del Narrador</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>Configura cómo y cuándo el narrador interviene en la conversación.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>

                    {/* Response Mode */}
                    <div>
                      <Label className="text-xs mb-1.5 block">Método de Respuesta</Label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {(Object.entries(narratorModeInfo) as [NarratorResponseMode, typeof narratorModeInfo.turn_start][]).map(([mode, info]) => (
                          <button
                            key={mode}
                            onClick={() => setNarratorSettings(prev => ({ ...prev, responseMode: mode }))}
                            className={cn(
                              "p-2 rounded-lg border text-left transition-colors",
                              narratorSettings.responseMode === mode
                                ? "border-violet-500 bg-violet-500/20"
                                : "hover:bg-muted/50 border-border/40"
                            )}
                          >
                            <div className="flex items-center gap-1 mb-0.5">
                              <span className="text-violet-500">{info.icon}</span>
                              <span className="text-[10px] font-medium">{info.name}</span>
                            </div>
                            <p className="text-[9px] text-muted-foreground leading-tight">{info.description}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Custom Narrator Prompt */}
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Label className="text-xs">Prompt del Narrador</Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>Instrucciones específicas para el narrador. Si está vacío, usa el prompt del grupo.</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Textarea
                        value={narratorSettings.customPrompt || ''}
                        onChange={(e) => setNarratorSettings(prev => ({ ...prev, customPrompt: e.target.value }))}
                        placeholder="Eres un narrador omnisciente que describe la escena, ambiente y transiciones..."
                        rows={3}
                        className="text-xs font-mono"
                      />
                    </div>

                    {/* Conditional Settings */}
                    <div className="space-y-2">
                      <Label className="text-xs">Intervención Condicional</Label>

                      {/* Min Turn Interval */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-muted-foreground">Turnos mínimos entre intervenciones</span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="w-2.5 h-2.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>0 = siempre interviene. 1 = cada turno, 2 = cada 2 turnos, etc.</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Input
                          type="number"
                          min={0}
                          max={10}
                          value={narratorSettings.conditional.minTurnInterval}
                          onChange={(e) => setNarratorSettings(prev => ({
                            ...prev,
                            conditional: { ...prev.conditional, minTurnInterval: parseInt(e.target.value) || 0 }
                          }))}
                          className="w-14 h-7 text-xs"
                        />
                      </div>

                      {/* Only when no active quests */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-muted-foreground">Solo cuando no hay misiones activas</span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="w-2.5 h-2.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>El narrador solo interviene cuando no hay misiones en curso.</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Switch
                          checked={narratorSettings.conditional.onlyWhenNoActiveQuests}
                          onCheckedChange={(checked) => setNarratorSettings(prev => ({
                            ...prev,
                            conditional: { ...prev.conditional, onlyWhenNoActiveQuests: checked }
                          }))}
                        />
                      </div>
                    </div>

                    {/* Hidden from Chat */}
                    <div className="flex items-center justify-between pt-1 border-t border-violet-500/20">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-medium">Ocultar mensajes del narrador</span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="w-2.5 h-2.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>Los mensajes del narrador no se mostrarán en el chat (pero siguen activando triggers).</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <p className="text-[9px] text-muted-foreground">Solo funcionan en segundo plano</p>
                      </div>
                      <Switch
                        checked={narratorSettings.hiddenFromChat}
                        onCheckedChange={(checked) => setNarratorSettings(prev => ({ ...prev, hiddenFromChat: checked }))}
                      />
                    </div>

                    {/* Show Sprite */}
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-medium">Mostrar sprite del narrador</span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="w-2.5 h-2.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>Muestra el sprite del personaje narrador en pantalla.</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <p className="text-[9px] text-muted-foreground">El narrador suele ser invisible</p>
                      </div>
                      <Switch
                        checked={narratorSettings.showSprite}
                        onCheckedChange={(checked) => setNarratorSettings(prev => ({ ...prev, showSprite: checked }))}
                      />
                    </div>
                  </div>
                )}
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
