'use client';

/**
 * QuestTemplateManager Component
 * 
 * Settings tab for managing Quest templates.
 * Allows creating, editing, duplicating, and deleting quest templates.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTavernStore } from '@/store';
import type { 
  QuestTemplate, 
  QuestObjectiveTemplate, 
  QuestReward,
  QuestPriority,
  QuestObjectiveType,
  QuestRewardType,
  QuestActivationMethod,
  QuestValueCondition,
  QuestValueType,
  QuestNumberOperator,
  QuestTextOperator,
  AttributeAction,
  TriggerCategory,
  TriggerTargetMode,
  QuestCharacterFilter,
} from '@/types';
import { cn, generateId } from '@/lib/utils';
import {
  createAttributeReward,
  createTriggerReward,
  describeReward,
  getActionSymbol,
  normalizeReward,
} from '@/lib/quest/quest-reward-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
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
  DialogFooter,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Plus,
  Pencil,
  Copy,
  Trash2,
  ScrollText,
  Target,
  Gift,
  Sparkles,
  ChevronUp,
  ChevronDown,
  X,
  GripVertical,
  Zap,
  Clock,
  Link2,
  Hash,
  List,
  ToggleLeft,
  ToggleRight,
  Check,
  AlertCircle,
  Info,
  Settings2,
  Eye,
  EyeOff,
  Timer,
  Image as ImageIcon,
  Volume2,
  Wallpaper,
  Users,
  User,
  Crosshair,
  ChevronRight,
  Filter,
  GripHorizontal,
  ChevronDown as ChevronDownIcon,
  Music,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ============================================
// Main Component
// ============================================

export function QuestTemplateManager() {
  const [editingTemplate, setEditingTemplate] = useState<QuestTemplate | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const questTemplates = useTavernStore((state) => state.questTemplates);
  const loadTemplates = useTavernStore((state) => state.loadTemplates);
  const saveTemplate = useTavernStore((state) => state.saveTemplate);
  const deleteTemplate = useTavernStore((state) => state.deleteTemplate);
  const duplicateTemplate = useTavernStore((state) => state.duplicateTemplate);

  // Load templates on mount
  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        await loadTemplates();
      } catch (error) {
        console.error('Error loading templates:', error);
      }
      setIsLoading(false);
    };
    load();
  }, [loadTemplates]);

  const handleCreate = () => {
    setIsCreating(true);
    setEditingTemplate(null);
  };
  
  const handleEdit = (template: QuestTemplate) => {
    setIsCreating(false);
    setEditingTemplate(template);
  };
  
  const handleDuplicate = async (template: QuestTemplate) => {
    const newId = `${template.id}-copy-${Date.now().toString(36)}`;
    try {
      duplicateTemplate(template.id, newId);
    } catch (error) {
      console.error('Error duplicating template:', error);
    }
  };
  
  const handleDelete = async (template: QuestTemplate) => {
    if (confirm(`¿Eliminar el template "${template.name}"?`)) {
      try {
        await deleteTemplate(template.id);
      } catch (error) {
        console.error('Error deleting template:', error);
      }
    }
  };
  
  const handleSave = async (template: QuestTemplate) => {
    try {
      await saveTemplate(template);
      setEditingTemplate(null);
      setIsCreating(false);
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Error al guardar el template');
    }
  };

  const handleClose = () => {
    setEditingTemplate(null);
    setIsCreating(false);
  };

  // Priority colors
  const priorityColors: Record<QuestPriority, string> = {
    main: 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30',
    side: 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30',
    hidden: 'bg-slate-500/20 text-slate-600 dark:text-slate-400 border-slate-500/30',
  };

  const priorityLabels: Record<QuestPriority, string> = {
    main: 'Principal',
    side: 'Secundaria',
    hidden: 'Oculta',
  };
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30">
              <ScrollText className="w-5 h-5 text-amber-500" />
            </div>
            Quest Templates
          </h2>
          <p className="text-muted-foreground text-sm ml-12">
            Crea plantillas de misiones para usar en las sesiones de rol
          </p>
        </div>
        <Button 
          onClick={handleCreate}
          className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white shadow-lg shadow-amber-500/25 transition-all duration-200 hover:shadow-amber-500/40"
        >
          <Plus className="w-4 h-4 mr-2" />
          Crear Template
        </Button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <Card className="border-dashed border-2 bg-gradient-to-br from-muted/50 to-muted/30">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
            <p className="text-muted-foreground text-sm mt-4">Cargando templates...</p>
          </CardContent>
        </Card>
      )}
      
      {/* Template List */}
      {!isLoading && questTemplates.length === 0 ? (
        <Card className="border-dashed border-2 bg-gradient-to-br from-muted/50 to-muted/30">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 mb-4">
              <ScrollText className="w-12 h-12 text-amber-400" />
            </div>
            <p className="text-muted-foreground text-center mb-2 font-medium">
              No hay templates de quest creados
            </p>
            <p className="text-muted-foreground/60 text-sm text-center max-w-xs mb-6">
              Los templates definen misiones que pueden activarse automáticamente durante el rol
            </p>
            <Button variant="outline" className="gap-2" onClick={handleCreate}>
              <Sparkles className="w-4 h-4" />
              Crear primer template
            </Button>
          </CardContent>
        </Card>
      ) : !isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {questTemplates.map((template) => (
            <Card 
              key={template.id} 
              className={cn(
                "group relative overflow-hidden transition-all duration-300",
                "hover:shadow-xl hover:shadow-amber-500/10 hover:-translate-y-1",
                "border border-border/60 bg-gradient-to-br from-card to-muted/30 hover:border-amber-500/30"
              )}
            >
              {/* Background decoration */}
              <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-gradient-to-br from-amber-500/5 to-orange-500/5 group-hover:scale-150 transition-transform duration-500" />
              
              <CardHeader className="pb-3 relative">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{template.icon || '📜'}</span>
                      <CardTitle className="text-lg truncate">{template.name}</CardTitle>
                    </div>
                    {template.description && (
                      <CardDescription className="mt-1.5 line-clamp-2">
                        {template.description}
                      </CardDescription>
                    )}
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4 relative">
                {/* Priority & Stats */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={priorityColors[template.priority]}>
                    {priorityLabels[template.priority]}
                  </Badge>
                  <Badge variant="outline" className="text-xs bg-muted/50">
                    <Target className="w-3 h-3 mr-1" />
                    {template.objectives.length} objetivos
                  </Badge>
                  <Badge variant="outline" className="text-xs bg-muted/50">
                    <Gift className="w-3 h-3 mr-1" />
                    {template.rewards.length} recompensas
                  </Badge>
                </div>

                {/* Activation Info */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {template.activation.method === 'keyword' && (
                    <>
                      <Zap className="w-3.5 h-3.5" />
                      <span>Key: <code className="bg-muted px-1 rounded">{template.activation.key}</code></span>
                    </>
                  )}
                  {template.activation.method === 'turn' && (
                    <>
                      <Clock className="w-3.5 h-3.5" />
                      <span>Cada {template.activation.turnInterval} turnos</span>
                    </>
                  )}
                  {template.activation.method === 'manual' && (
                    <>
                      <ToggleRight className="w-3.5 h-3.5" />
                      <span>Activación manual</span>
                    </>
                  )}
                  {template.activation.method === 'chain' && (
                    <>
                      <Link2 className="w-3.5 h-3.5" />
                      <span>En cadena</span>
                    </>
                  )}
                </div>

                {/* Behavior badges */}
                <div className="flex items-center gap-2">
                  {template.isRepeatable && (
                    <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-600 dark:text-green-400">
                      Repetible
                    </Badge>
                  )}
                  {template.isHidden && (
                    <Badge variant="secondary" className="text-xs bg-slate-500/10 text-slate-600 dark:text-slate-400">
                      <EyeOff className="w-3 h-3 mr-1" />
                      Oculta
                    </Badge>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t border-border/50">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 hover:bg-amber-500/10 hover:text-amber-600 hover:border-amber-500/30 transition-colors"
                    onClick={() => handleEdit(template)}
                  >
                    <Pencil className="w-3.5 h-3.5 mr-1.5" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 hover:bg-slate-500/10 hover:text-slate-600 hover:border-slate-500/30 transition-colors"
                    onClick={() => handleDuplicate(template)}
                  >
                    <Copy className="w-3.5 h-3.5 mr-1.5" />
                    Duplicar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="hover:bg-red-500/10 hover:text-red-600 hover:border-red-500/30 transition-colors"
                    onClick={() => handleDelete(template)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      {/* Editor Dialog */}
      {(editingTemplate || isCreating) && (
        <QuestTemplateEditorDialog
          template={editingTemplate}
          isNew={isCreating}
          onSave={handleSave}
          onClose={handleClose}
          existingIds={questTemplates.map(t => t.id)}
        />
      )}
    </div>
  );
}

// ============================================
// Sortable Objective Item Component
// ============================================

interface SortableObjectiveItemProps {
  objective: QuestObjectiveTemplate;
  index: number;
  totalObjectives: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (updates: Partial<QuestObjectiveTemplate>) => void;
  onRemove: () => void;
  allCharacters: Array<{ id: string; name: string }>;
}

function SortableObjectiveItem({
  objective,
  index,
  totalObjectives,
  isExpanded,
  onToggleExpand,
  onUpdate,
  onRemove,
  allCharacters,
}: SortableObjectiveItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: objective.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Helper to get objective summary for collapsed view
  const getObjectiveSummary = (obj: QuestObjectiveTemplate): string => {
    const parts: string[] = [];
    if (obj.description) {
      parts.push(obj.description.substring(0, 50) + (obj.description.length > 50 ? '...' : ''));
    }
    if (obj.completion?.key) {
      parts.push(`Key: ${obj.completion.key}`);
    }
    if (obj.targetCount > 1) {
      parts.push(`x${obj.targetCount}`);
    }
    return parts.join(' | ') || 'Sin configurar';
  };

  const typeLabels: Record<QuestObjectiveType, string> = {
    collect: 'Coleccionar',
    reach: 'Alcanzar',
    defeat: 'Derrotar',
    talk: 'Hablar',
    discover: 'Descubrir',
    custom: 'Personalizado',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "border rounded-lg overflow-hidden transition-all duration-200",
        isDragging ? "border-primary/50 shadow-lg shadow-primary/10 z-50" : "border-border/60",
        isExpanded ? "bg-card" : "bg-muted/30 hover:bg-muted/50"
      )}
    >
      {/* Accordion Header */}
      <div
        className={cn(
          "flex items-center gap-2 p-3 cursor-pointer select-none",
          isExpanded && "border-b border-border/50 bg-muted/30"
        )}
        onClick={onToggleExpand}
      >
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </div>

        {/* Index Badge */}
        <div className="flex items-center justify-center w-6 h-6 rounded bg-primary/10 text-primary text-xs font-medium">
          {index + 1}
        </div>

        {/* Type Icon */}
        <Target className="w-4 h-4 text-muted-foreground" />

        {/* Title Area */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-medium truncate">
              {objective.id}
            </span>
            <Badge variant="outline" className="text-[10px] h-5">
              {typeLabels[objective.type]}
            </Badge>
            {objective.isOptional && (
              <Badge variant="secondary" className="text-[10px] h-5 bg-blue-500/10 text-blue-600 dark:text-blue-400">
                Opcional
              </Badge>
            )}
            {objective.characterFilter?.enabled && objective.characterFilter.characterIds.length > 0 && (
              <Badge variant="secondary" className="text-[10px] h-5 gap-1">
                <Users className="w-3 h-3" />
                {objective.characterFilter.characterIds.length}
              </Badge>
            )}
          </div>
          {!isExpanded && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {getObjectiveSummary(objective)}
            </p>
          )}
        </div>

        {/* Expand/Collapse Icon */}
        <ChevronDownIcon
          className={cn(
            "w-4 h-4 text-muted-foreground transition-transform duration-200",
            isExpanded && "rotate-180"
          )}
        />

        {/* Delete Button */}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-red-500 hover:bg-red-500/10"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Accordion Content */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Basic Fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">ID</Label>
              <Input
                value={objective.id}
                onChange={(e) => onUpdate({ id: e.target.value })}
                className="bg-background font-mono text-xs h-8"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Tipo</Label>
              <Select 
                value={objective.type} 
                onValueChange={(v) => onUpdate({ type: v as QuestObjectiveType })}
              >
                <SelectTrigger className="bg-background h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="collect">Coleccionar</SelectItem>
                  <SelectItem value="reach">Alcanzar</SelectItem>
                  <SelectItem value="defeat">Derrotar</SelectItem>
                  <SelectItem value="talk">Hablar</SelectItem>
                  <SelectItem value="discover">Descubrir</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Descripción</Label>
            <Input
              value={objective.description}
              onChange={(e) => onUpdate({ description: e.target.value })}
              placeholder="Descripción del objetivo..."
              className="bg-background h-8"
            />
          </div>

          {/* Completion Keys */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Key de Completado</Label>
              <Input
                value={objective.completion.key}
                onChange={(e) => onUpdate({ 
                  completion: { ...objective.completion, key: e.target.value } 
                })}
                placeholder="resistencia"
                className="bg-background font-mono text-xs h-8"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Keys Alternativas</Label>
              <Input
                value={(objective.completion.keys || []).join(', ')}
                onChange={(e) => onUpdate({ 
                  completion: { ...objective.completion, keys: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } 
                })}
                placeholder="resistance, Resistance"
                className="bg-background font-mono text-xs h-8"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Cantidad</Label>
              <Input
                type="number"
                min={1}
                value={objective.targetCount}
                onChange={(e) => onUpdate({ targetCount: Number(e.target.value) })}
                className="bg-background h-8"
              />
            </div>
          </div>

          {/* Switches */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <Switch
                checked={objective.completion.caseSensitive}
                onCheckedChange={(v) => onUpdate({ 
                  completion: { ...objective.completion, caseSensitive: v } 
                })}
              />
              <span className="text-xs text-muted-foreground">Case Sensitive</span>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={objective.isOptional}
                onCheckedChange={(v) => onUpdate({ isOptional: v })}
              />
              <span className="text-xs text-muted-foreground">Opcional</span>
            </div>
          </div>

          {/* Character Filter Section */}
          <div className="space-y-2 pt-2 border-t border-border/50">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Filter className="w-3 h-3" />
                Filtro de Personajes
              </Label>
              <Switch
                checked={objective.characterFilter?.enabled || false}
                onCheckedChange={(v) => onUpdate({ 
                  characterFilter: { 
                    enabled: v, 
                    mode: objective.characterFilter?.mode || 'include',
                    characterIds: objective.characterFilter?.characterIds || []
                  } 
                })}
              />
            </div>
            
            {objective.characterFilter?.enabled && (
              <div className="space-y-2 p-2 rounded bg-muted/30">
                <div className="space-y-1">
                  <Label className="text-[9px] text-muted-foreground">Modo de Filtro</Label>
                  <Select 
                    value={objective.characterFilter.mode} 
                    onValueChange={(v) => onUpdate({ 
                      characterFilter: { 
                        ...objective.characterFilter!, 
                        mode: v as 'include' | 'exclude'
                      } 
                    })}
                  >
                    <SelectTrigger className="bg-background h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="include">
                        <div className="flex items-center gap-2">
                          <User className="w-3 h-3" />
                          Incluir (solo estos personajes)
                        </div>
                      </SelectItem>
                      <SelectItem value="exclude">
                        <div className="flex items-center gap-2">
                          <Users className="w-3 h-3" />
                          Excluir (todos menos estos)
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-1">
                  <Label className="text-[9px] text-muted-foreground">
                    {objective.characterFilter.mode === 'include' ? 'Personajes que verán este objetivo' : 'Personajes que NO verán este objetivo'}
                  </Label>
                  <div className="flex flex-wrap gap-1 p-2 rounded bg-background min-h-[32px]">
                    {objective.characterFilter.characterIds.length === 0 ? (
                      <span className="text-xs text-muted-foreground italic">
                        Selecciona personajes...
                      </span>
                    ) : (
                      objective.characterFilter.characterIds.map(charId => {
                        const char = allCharacters.find(c => c.id === charId);
                        if (!char) return null;
                        return (
                          <Badge 
                            key={charId} 
                            variant="secondary"
                            className="text-[10px] gap-1 pr-1"
                          >
                            {char.name}
                            <button
                              type="button"
                              className="ml-1 hover:text-red-500"
                              onClick={() => onUpdate({ 
                                characterFilter: { 
                                  ...objective.characterFilter!, 
                                  characterIds: objective.characterFilter!.characterIds.filter(id => id !== charId)
                                } 
                              })}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        );
                      })
                    )}
                  </div>
                  <Select 
                    value="" 
                    onValueChange={(v) => {
                      if (v && !objective.characterFilter?.characterIds.includes(v)) {
                        onUpdate({ 
                          characterFilter: { 
                            ...objective.characterFilter!, 
                            characterIds: [...(objective.characterFilter?.characterIds || []), v]
                          } 
                        });
                      }
                    }}
                  >
                    <SelectTrigger className="bg-background h-7 text-xs">
                      <SelectValue placeholder="+ Agregar personaje" />
                    </SelectTrigger>
                    <SelectContent>
                      {allCharacters
                        .filter(c => !objective.characterFilter?.characterIds.includes(c.id))
                        .map(c => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <p className="text-[9px] text-muted-foreground flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  {objective.characterFilter.mode === 'include' 
                    ? 'Solo los personajes seleccionados verán este objetivo en su prompt'
                    : 'Todos los personajes verán este objetivo EXCEPTO los seleccionados'}
                </p>
              </div>
            )}
          </div>

          {/* Value Condition Section */}
          <div className="space-y-2 pt-2 border-t border-border/50">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] text-muted-foreground">Condición de Valor</Label>
              <Switch
                checked={!!objective.completion.valueCondition}
                onCheckedChange={(v) => onUpdate({ 
                  completion: { 
                    ...objective.completion, 
                    valueCondition: v ? { valueType: 'presence' } : undefined 
                  } 
                })}
              />
            </div>
            
            {objective.completion.valueCondition && (
              <div className="grid grid-cols-3 gap-2 p-2 rounded bg-muted/30">
                <div className="space-y-1">
                  <Label className="text-[9px] text-muted-foreground">Tipo de Valor</Label>
                  <Select 
                    value={objective.completion.valueCondition.valueType} 
                    onValueChange={(v) => onUpdate({ 
                      completion: { 
                        ...objective.completion, 
                        valueCondition: { 
                          ...objective.completion.valueCondition, 
                          valueType: v as QuestValueType 
                        } 
                      } 
                    })}
                  >
                    <SelectTrigger className="bg-background h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="presence">Presencia</SelectItem>
                      <SelectItem value="number">Número</SelectItem>
                      <SelectItem value="text">Texto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {objective.completion.valueCondition.valueType !== 'presence' && (
                  <>
                    <div className="space-y-1">
                      <Label className="text-[9px] text-muted-foreground">Operador</Label>
                      <Select 
                        value={objective.completion.valueCondition.operator || (objective.completion.valueCondition.valueType === 'number' ? '==' : 'equals')} 
                        onValueChange={(v) => onUpdate({ 
                          completion: { 
                            ...objective.completion, 
                            valueCondition: { 
                              ...objective.completion.valueCondition, 
                              operator: v as any 
                            } 
                          } 
                        })}
                      >
                        <SelectTrigger className="bg-background h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {objective.completion.valueCondition.valueType === 'number' ? (
                            <>
                              <SelectItem value=">">&gt; Mayor que</SelectItem>
                              <SelectItem value="<">&lt; Menor que</SelectItem>
                              <SelectItem value=">=">≥ Mayor o igual</SelectItem>
                              <SelectItem value="<=">≤ Menor o igual</SelectItem>
                              <SelectItem value="==">= Igual</SelectItem>
                              <SelectItem value="!=">≠ Diferente</SelectItem>
                            </>
                          ) : (
                            <>
                              <SelectItem value="equals">Igual a</SelectItem>
                              <SelectItem value="contains">Contiene</SelectItem>
                              <SelectItem value="startsWith">Empieza con</SelectItem>
                              <SelectItem value="endsWith">Termina con</SelectItem>
                              <SelectItem value="notEquals">Diferente de</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[9px] text-muted-foreground">Valor Objetivo</Label>
                      <Input
                        value={String(objective.completion.valueCondition.targetValue || '')}
                        onChange={(e) => onUpdate({ 
                          completion: { 
                            ...objective.completion, 
                            valueCondition: { 
                              ...objective.completion.valueCondition, 
                              targetValue: objective.completion.valueCondition?.valueType === 'number' 
                ? Number(e.target.value) 
                : e.target.value 
            } 
          } 
        })}
                        placeholder={objective.completion.valueCondition.valueType === 'number' ? '50' : 'texto'}
                        className="bg-background h-7 text-xs"
                      />
                    </div>
                  </>
                )}

                {objective.completion.valueCondition.valueType === 'presence' && (
                  <div className="col-span-2 flex items-center text-xs text-muted-foreground">
                    <Info className="w-3 h-3 mr-1" />
                    Detecta si la key existe en el texto
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Objective Rewards Section */}
          <div className="space-y-2 pt-2 border-t border-border/50">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Gift className="w-3 h-3" />
                Recompensas del Objetivo
              </Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={() => {
                  const newReward = createAttributeReward('', 0, 'add', { id: `obj-reward-${Date.now().toString(36)}` });
                  onUpdate({ 
                    rewards: [...(objective.rewards || []), newReward] 
                  });
                }}
              >
                <Plus className="w-3 h-3 mr-1" />
                Agregar
              </Button>
            </div>
            
            {(objective.rewards || []).length > 0 && (
              <div className="space-y-2">
                {(objective.rewards || []).map((reward, rewardIdx) => {
                  const normalized = normalizeReward(reward);
                  const isAttr = normalized.type === 'attribute';
                  const isTrig = normalized.type === 'trigger';
                  
                  return (
                    <div key={reward.id} className="p-2 rounded bg-muted/20 space-y-2">
                      {/* Tipo y preview */}
                      <div className="flex items-center gap-2">
                        <Select 
                          value={normalized.type} 
                          onValueChange={(v) => {
                            let newReward: QuestReward;
                            if (v === 'attribute') {
                              newReward = createAttributeReward(
                                normalized.attribute?.key || normalized.key || '',
                                normalized.attribute?.value ?? normalized.value ?? 0,
                                normalized.attribute?.action || 'add',
                                { id: reward.id }
                              );
                            } else {
                              newReward = createTriggerReward(
                                normalized.trigger?.category || 'sprite',
                                normalized.trigger?.key || normalized.key || '',
                                normalized.trigger?.targetMode || 'self',
                                { id: reward.id }
                              );
                            }
                            const updatedRewards = [...(objective.rewards || [])];
                            updatedRewards[rewardIdx] = newReward;
                            onUpdate({ rewards: updatedRewards });
                          }}
                        >
                          <SelectTrigger className="bg-background h-6 text-xs w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="attribute">📊 Atributo</SelectItem>
                            <SelectItem value="trigger">⚡ Trigger</SelectItem>
                          </SelectContent>
                        </Select>
                        <Badge variant="outline" className="text-[10px]">
                          {describeReward(normalized)}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-red-500 hover:bg-red-500/10 ml-auto"
                          onClick={() => {
                            const updatedRewards = (objective.rewards || []).filter((_, i) => i !== rewardIdx);
                            onUpdate({ rewards: updatedRewards });
                          }}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                      
                      {/* Config según tipo */}
                      {isAttr && normalized.attribute && (
                        <div className="grid grid-cols-3 gap-2">
                          <Input
                            value={normalized.attribute.key}
                            onChange={(e) => {
                              const updatedRewards = [...(objective.rewards || [])];
                              updatedRewards[rewardIdx] = {
                                ...reward,
                                attribute: { ...normalized.attribute!, key: e.target.value }
                              };
                              onUpdate({ rewards: updatedRewards });
                            }}
                            placeholder="Key"
                            className="bg-background h-6 text-xs"
                          />
                          <Input
                            type="number"
                            value={normalized.attribute.value}
                            onChange={(e) => {
                              const updatedRewards = [...(objective.rewards || [])];
                              updatedRewards[rewardIdx] = {
                                ...reward,
                                attribute: { ...normalized.attribute!, value: Number(e.target.value) }
                              };
                              onUpdate({ rewards: updatedRewards });
                            }}
                            placeholder="Valor"
                            className="bg-background h-6 text-xs"
                          />
                          <Select 
                            value={normalized.attribute.action} 
                            onValueChange={(v) => {
                              const updatedRewards = [...(objective.rewards || [])];
                              updatedRewards[rewardIdx] = {
                                ...reward,
                                attribute: { ...normalized.attribute!, action: v as AttributeAction }
                              };
                              onUpdate({ rewards: updatedRewards });
                            }}
                          >
                            <SelectTrigger className="bg-background h-6 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="add">+</SelectItem>
                              <SelectItem value="subtract">-</SelectItem>
                              <SelectItem value="set">=</SelectItem>
                              <SelectItem value="multiply">×</SelectItem>
                              <SelectItem value="divide">÷</SelectItem>
                              <SelectItem value="percent">%</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      
                      {isTrig && normalized.trigger && (
                        <div className="grid grid-cols-3 gap-2">
                          <Select 
                            value={normalized.trigger.category} 
                            onValueChange={(v) => {
                              const updatedRewards = [...(objective.rewards || [])];
                              updatedRewards[rewardIdx] = {
                                ...reward,
                                trigger: { ...normalized.trigger!, category: v as TriggerCategory }
                              };
                              onUpdate({ rewards: updatedRewards });
                            }}
                          >
                            <SelectTrigger className="bg-background h-6 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="sprite">🖼️ Sprite</SelectItem>
                              <SelectItem value="sound">🔊 Sonido</SelectItem>
                              <SelectItem value="background">🌄 Fondo</SelectItem>
                              <SelectItem value="soundSequence">🎵 Secuencia</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            value={normalized.trigger.key}
                            onChange={(e) => {
                              const updatedRewards = [...(objective.rewards || [])];
                              updatedRewards[rewardIdx] = {
                                ...reward,
                                trigger: { ...normalized.trigger!, key: e.target.value }
                              };
                              onUpdate({ rewards: updatedRewards });
                            }}
                            placeholder="Key"
                            className="bg-background h-6 text-xs"
                          />
                          <Select 
                            value={normalized.trigger.targetMode} 
                            onValueChange={(v) => {
                              const updatedRewards = [...(objective.rewards || [])];
                              updatedRewards[rewardIdx] = {
                                ...reward,
                                trigger: { ...normalized.trigger!, targetMode: v as TriggerTargetMode }
                              };
                              onUpdate({ rewards: updatedRewards });
                            }}
                          >
                            <SelectTrigger className="bg-background h-6 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="self">👤 Self</SelectItem>
                              <SelectItem value="all">👥 Todos</SelectItem>
                              <SelectItem value="target">🎯 Target</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            
            {(objective.rewards || []).length === 0 && (
              <p className="text-[10px] text-muted-foreground italic">
                Sin recompensas. Se ejecutarán al completar este objetivo.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Quest Template Editor Dialog
// ============================================

interface QuestTemplateEditorDialogProps {
  template: QuestTemplate | null;
  isNew: boolean;
  onSave: (template: QuestTemplate) => void;
  onClose: () => void;
  existingIds: string[];
}

function QuestTemplateEditorDialog({ template, isNew, onSave, onClose, existingIds }: QuestTemplateEditorDialogProps) {
  // Basic info
  const [id, setId] = useState(template?.id || '');
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [priority, setPriority] = useState<QuestPriority>(template?.priority || 'side');
  const [icon, setIcon] = useState(template?.icon || '📜');
  const [isRepeatable, setIsRepeatable] = useState(template?.isRepeatable ?? false);
  const [isHidden, setIsHidden] = useState(template?.isHidden ?? false);
  const [prerequisites, setPrerequisites] = useState<string[]>(template?.prerequisites || []);
  
  // Activation
  const [activationKey, setActivationKey] = useState(template?.activation?.key || '');
  const [activationKeys, setActivationKeys] = useState<string[]>(template?.activation?.keys || []);
  const [activationCaseSensitive, setActivationCaseSensitive] = useState(template?.activation?.caseSensitive ?? false);
  const [activationMethod, setActivationMethod] = useState<QuestActivationMethod>(template?.activation?.method || 'keyword');
  const [turnInterval, setTurnInterval] = useState(template?.activation?.turnInterval || 5);
  
  // Completion
  const [completionKey, setCompletionKey] = useState(template?.completion?.key || '');
  const [completionKeys, setCompletionKeys] = useState<string[]>(template?.completion?.keys || []);
  const [completionCaseSensitive, setCompletionCaseSensitive] = useState(template?.completion?.caseSensitive ?? false);
  const [completionValueCondition, setCompletionValueCondition] = useState<QuestValueCondition | undefined>(template?.completion?.valueCondition);
  
  // Objectives & Rewards
  const [objectives, setObjectives] = useState<QuestObjectiveTemplate[]>(template?.objectives || []);
  const [rewards, setRewards] = useState<QuestReward[]>(template?.rewards || []);
  
  // Chain config
  const [chainType, setChainType] = useState<'none' | 'specific' | 'random'>(template?.chain?.type || 'none');
  const [chainNextQuestId, setChainNextQuestId] = useState(template?.chain?.nextQuestId || '');
  const [chainAutoStart, setChainAutoStart] = useState(template?.chain?.autoStart ?? false);
  const [chainRandomPool, setChainRandomPool] = useState<string[]>(template?.chain?.randomPool || []);

  // Validation
  const [errors, setErrors] = useState<string[]>([]);

  // Active tab for the editor
  const [activeSection, setActiveSection] = useState<'basic' | 'activation' | 'objectives' | 'completion' | 'rewards'>('basic');

  // Track expanded objectives (for accordion)
  const [expandedObjectives, setExpandedObjectives] = useState<Set<string>>(new Set());

  // Get all characters for the character filter
  const allCharacters = useTavernStore((state) => state.characters);

  // DnD sensors for objectives
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = objectives.findIndex((obj) => obj.id === active.id);
      const newIndex = objectives.findIndex((obj) => obj.id === over.id);
      setObjectives(arrayMove(objectives, oldIndex, newIndex));
    }
  };

  const validate = (): boolean => {
    const newErrors: string[] = [];
    
    if (!id.trim()) newErrors.push('ID es requerido');
    if (!name.trim()) newErrors.push('Nombre es requerido');
    if (!activationKey.trim()) newErrors.push('Key de activación es requerida');
    if (!completionKey.trim()) newErrors.push('Key de completado es requerida');
    
    if (isNew && existingIds.includes(id)) {
      newErrors.push('Ya existe un template con este ID');
    }
    
    // Validate objectives
    objectives.forEach((obj, i) => {
      if (!obj.id) newErrors.push(`Objetivo ${i + 1}: ID requerido`);
      if (!obj.completion?.key) newErrors.push(`Objetivo ${i + 1}: Key de completado requerida`);
    });
    
    // Validate rewards
    rewards.forEach((reward, i) => {
      if (!reward.id) newErrors.push(`Recompensa ${i + 1}: ID requerido`);
      if (!reward.key) newErrors.push(`Recompensa ${i + 1}: Key requerida`);
    });
    
    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    
    const now = new Date().toISOString();
    
    const newTemplate: QuestTemplate = {
      id,
      name,
      description,
      priority,
      icon,
      isRepeatable,
      isHidden,
      prerequisites,
      
      activation: {
        key: activationKey,
        keys: activationKeys,
        caseSensitive: activationCaseSensitive,
        method: activationMethod,
        turnInterval: activationMethod === 'turn' ? turnInterval : undefined,
      },
      
      objectives,
      
      completion: {
        key: completionKey,
        keys: completionKeys,
        caseSensitive: completionCaseSensitive,
        valueCondition: completionValueCondition,
      },
      
      chain: chainType !== 'none' ? {
        type: chainType,
        nextQuestId: chainType === 'specific' ? chainNextQuestId : undefined,
        autoStart: chainAutoStart,
        randomPool: chainType === 'random' ? chainRandomPool : undefined,
      } : undefined,
      
      rewards,
      
      createdAt: template?.createdAt || now,
      updatedAt: now,
    };
    
    onSave(newTemplate);
  };

  // Objective management
  const addObjective = () => {
    const newObjective: QuestObjectiveTemplate = {
      id: `obj-${Date.now().toString(36)}`,
      description: '',
      type: 'custom',
      completion: {
        key: '',
        keys: [],
        caseSensitive: false,
      },
      targetCount: 1,
      isOptional: false,
    };
    setObjectives([...objectives, newObjective]);
  };

  const updateObjective = (index: number, updates: Partial<QuestObjectiveTemplate>) => {
    setObjectives(objectives.map((obj, i) => i === index ? { ...obj, ...updates } : obj));
  };

  const removeObjective = (index: number) => {
    setObjectives(objectives.filter((_, i) => i !== index));
  };

  const moveObjective = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= objectives.length) return;
    const newObjectives = [...objectives];
    [newObjectives[index], newObjectives[newIndex]] = [newObjectives[newIndex], newObjectives[index]];
    setObjectives(newObjectives);
  };

  const toggleObjectiveExpand = (objectiveId: string) => {
    setExpandedObjectives((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(objectiveId)) {
        newSet.delete(objectiveId);
      } else {
        newSet.add(objectiveId);
      }
      return newSet;
    });
  };

  // Helper to get objective summary for collapsed view
  const getObjectiveSummary = (obj: QuestObjectiveTemplate): string => {
    const parts: string[] = [];
    if (obj.description) {
      parts.push(obj.description.substring(0, 40) + (obj.description.length > 40 ? '...' : ''));
    }
    if (obj.completion?.key) {
      parts.push(`Key: ${obj.completion.key}`);
    }
    if (obj.targetCount > 1) {
      parts.push(`x${obj.targetCount}`);
    }
    if (obj.characterFilter?.enabled && obj.characterFilter.characterIds.length > 0) {
      const charNames = obj.characterFilter.characterIds
        .map(id => allCharacters.find(c => c.id === id)?.name)
        .filter(Boolean)
        .slice(0, 2)
        .join(', ');
      const remaining = obj.characterFilter.characterIds.length - 2;
      parts.push(`👥 ${charNames}${remaining > 0 ? ` +${remaining}` : ''}`);
    }
    return parts.join(' | ') || 'Sin configurar';
  };

  // Reward management
  const addReward = () => {
    const newReward = createAttributeReward('', 0, 'add');
    setRewards([...rewards, newReward]);
  };

  const updateReward = (index: number, updates: Partial<QuestReward>) => {
    setRewards(rewards.map((reward, i) => {
      if (i !== index) return reward;
      
      // Si se cambia el tipo, necesitamos crear la estructura correcta
      if (updates.type && updates.type !== reward.type) {
        if (updates.type === 'attribute') {
          return createAttributeReward(
            reward.attribute?.key || reward.key || '',
            reward.attribute?.value ?? reward.value ?? 0,
            reward.attribute?.action || reward.action || 'add'
          );
        }
        if (updates.type === 'trigger') {
          return createTriggerReward(
            'sprite',
            reward.trigger?.key || reward.key || '',
            reward.trigger?.targetMode || 'self'
          );
        }
      }
      
      // Normal update
      const updated = { ...reward, ...updates };
      
      // Si es tipo attribute, actualizar el objeto attribute
      if (updated.type === 'attribute') {
        updated.attribute = {
          key: updates.attribute?.key ?? reward.attribute?.key ?? reward.key ?? '',
          value: updates.attribute?.value ?? reward.attribute?.value ?? reward.value ?? 0,
          action: updates.attribute?.action ?? reward.attribute?.action ?? reward.action ?? 'add',
        };
      }
      
      // Si es tipo trigger, actualizar el objeto trigger
      if (updated.type === 'trigger') {
        updated.trigger = {
          category: updates.trigger?.category ?? reward.trigger?.category ?? 'sprite',
          key: updates.trigger?.key ?? reward.trigger?.key ?? reward.key ?? '',
          targetMode: updates.trigger?.targetMode ?? reward.trigger?.targetMode ?? 'self',
          returnToIdleMs: updates.trigger?.returnToIdleMs ?? reward.trigger?.returnToIdleMs,
          volume: updates.trigger?.volume ?? reward.trigger?.volume,
          transitionDuration: updates.trigger?.transitionDuration ?? reward.trigger?.transitionDuration,
        };
      }
      
      return updated;
    }));
  };

  const removeReward = (index: number) => {
    setRewards(rewards.filter((_, i) => i !== index));
  };

  // Section navigation buttons
  const sections = [
    { id: 'basic', label: 'Info Básica', icon: <Settings2 className="w-4 h-4" /> },
    { id: 'activation', label: 'Activación', icon: <Zap className="w-4 h-4" /> },
    { id: 'objectives', label: 'Objetivos', icon: <Target className="w-4 h-4" /> },
    { id: 'completion', label: 'Completado', icon: <Check className="w-4 h-4" /> },
    { id: 'rewards', label: 'Recompensas', icon: <Gift className="w-4 h-4" /> },
  ] as const;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-4 border-b border-border/50">
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30">
              {isNew ? <Plus className="w-5 h-5 text-amber-500" /> : <Pencil className="w-5 h-5 text-amber-500" />}
            </div>
            {isNew ? 'Crear Nuevo Template' : 'Editar Template'}
          </DialogTitle>
        </DialogHeader>

        {/* Section Tabs */}
        <div className="flex gap-1 py-2 overflow-x-auto">
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => setActiveSection(section.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
                activeSection === section.id
                  ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {section.icon}
              {section.label}
            </button>
          ))}
        </div>

        {/* Error Messages */}
        {errors.length > 0 && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="text-sm text-red-600 dark:text-red-400">
              <ul className="list-disc list-inside">
                {errors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto py-4">
          {/* Basic Info Section */}
          {activeSection === 'basic' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="template-id" className="text-xs text-muted-foreground">ID del Template</Label>
                  <Input
                    id="template-id"
                    value={id}
                    onChange={(e) => setId(e.target.value.replace(/\s+/g, '-').toLowerCase())}
                    placeholder="ejemplo-mision"
                    disabled={!isNew}
                    className="bg-background font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground">Identificador único, sin espacios</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="template-name" className="text-xs text-muted-foreground">Nombre</Label>
                  <Input
                    id="template-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Misión de Ejemplo"
                    className="bg-background"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="template-desc" className="text-xs text-muted-foreground">Descripción</Label>
                <Textarea
                  id="template-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe la misión..."
                  className="bg-background min-h-[80px]"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Prioridad</Label>
                  <Select value={priority} onValueChange={(v) => setPriority(v as QuestPriority)}>
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="main">Principal</SelectItem>
                      <SelectItem value="side">Secundaria</SelectItem>
                      <SelectItem value="hidden">Oculta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="template-icon" className="text-xs text-muted-foreground">Icono (emoji)</Label>
                  <Input
                    id="template-icon"
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                    placeholder="📜"
                    className="bg-background text-center text-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Comportamiento</Label>
                  <div className="flex flex-col gap-2 pt-1">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={isRepeatable}
                        onCheckedChange={setIsRepeatable}
                      />
                      <span className="text-sm">Repetible</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={isHidden}
                        onCheckedChange={setIsHidden}
                      />
                      <span className="text-sm">Oculta</span>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="prerequisites" className="text-xs text-muted-foreground">
                  Prerrequisitos (IDs de misiones requeridas, separadas por coma)
                </Label>
                <Input
                  id="prerequisites"
                  value={prerequisites.join(', ')}
                  onChange={(e) => setPrerequisites(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  placeholder="mision-anterior, otra-mision"
                  className="bg-background font-mono"
                />
                <p className="text-[10px] text-muted-foreground">
                  Esta misión no estará disponible hasta que se completen las misiones listadas
                </p>
              </div>
            </div>
          )}

          {/* Activation Section */}
          {activeSection === 'activation' && (
            <div className="space-y-6">
              <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    La key de activación detecta cuándo la misión debe comenzar. El LLM puede generar esta key en su respuesta.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="activation-key" className="text-xs text-muted-foreground">Key Principal de Activación</Label>
                <Input
                  id="activation-key"
                  value={activationKey}
                  onChange={(e) => setActivationKey(e.target.value)}
                  placeholder="mision:rescate"
                  className="bg-background font-mono"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="activation-keys" className="text-xs text-muted-foreground">Keys Alternativas (separadas por coma)</Label>
                <Input
                  id="activation-keys"
                  value={activationKeys.join(', ')}
                  onChange={(e) => setActivationKeys(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  placeholder="mission:rescue, quest:rescate"
                  className="bg-background font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Método de Activación</Label>
                  <Select value={activationMethod} onValueChange={(v) => setActivationMethod(v as QuestActivationMethod)}>
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="keyword">Por Keyword</SelectItem>
                      <SelectItem value="turn">Por Turnos</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="chain">En Cadena</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {activationMethod === 'turn' && (
                  <div className="space-y-2">
                    <Label htmlFor="turn-interval" className="text-xs text-muted-foreground">Cada cuántos turnos</Label>
                    <Input
                      id="turn-interval"
                      type="number"
                      min={1}
                      value={turnInterval}
                      onChange={(e) => setTurnInterval(Number(e.target.value))}
                      className="bg-background"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={activationCaseSensitive}
                  onCheckedChange={setActivationCaseSensitive}
                />
                <span className="text-sm">Distinguir mayúsculas/minúsculas</span>
              </div>
            </div>
          )}

          {/* Objectives Section */}
          {activeSection === 'objectives' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium">Objetivos de la Misión</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Arrastra los objetivos para reordenarlos • Haz clic para expandir/colapsar
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={addObjective}>
                  <Plus className="w-4 h-4 mr-1.5" />
                  Agregar Objetivo
                </Button>
              </div>

              {objectives.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed rounded-lg bg-muted/20">
                  <Target className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground text-sm">No hay objetivos definidos</p>
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={objectives.map(obj => obj.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {objectives.map((obj, index) => (
                        <SortableObjectiveItem
                          key={obj.id}
                          objective={obj}
                          index={index}
                          totalObjectives={objectives.length}
                          isExpanded={expandedObjectives.has(obj.id)}
                          onToggleExpand={() => toggleObjectiveExpand(obj.id)}
                          onUpdate={(updates) => updateObjective(index, updates)}
                          onRemove={() => removeObjective(index)}
                          allCharacters={allCharacters}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          )}

          {/* Completion Section */}
          {activeSection === 'completion' && (
            <div className="space-y-6">
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-green-600 dark:text-green-400">
                    La key de completado detecta cuándo la misión termina exitosamente. Se ejecutan las recompensas automáticamente.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="completion-key" className="text-xs text-muted-foreground">Key Principal de Completado</Label>
                <Input
                  id="completion-key"
                  value={completionKey}
                  onChange={(e) => setCompletionKey(e.target.value)}
                  placeholder="mision:completada"
                  className="bg-background font-mono"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="completion-keys" className="text-xs text-muted-foreground">Keys Alternativas (separadas por coma)</Label>
                <Input
                  id="completion-keys"
                  value={completionKeys.join(', ')}
                  onChange={(e) => setCompletionKeys(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  placeholder="mission:complete, quest:done"
                  className="bg-background font-mono"
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={completionCaseSensitive}
                  onCheckedChange={setCompletionCaseSensitive}
                />
                <span className="text-sm">Distinguir mayúsculas/minúsculas</span>
              </div>

              {/* Value Condition for Completion */}
              <div className="space-y-3 p-4 rounded-lg border border-border/50 bg-muted/10">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Condición de Valor</Label>
                    <p className="text-xs text-muted-foreground">Detectar y comparar valores después de la key</p>
                  </div>
                  <Switch
                    checked={!!completionValueCondition}
                    onCheckedChange={(v) => setCompletionValueCondition(v ? { valueType: 'presence' } : undefined)}
                  />
                </div>
                
                {completionValueCondition && (
                  <div className="grid grid-cols-3 gap-3 mt-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Tipo de Valor</Label>
                      <Select 
                        value={completionValueCondition.valueType} 
                        onValueChange={(v) => setCompletionValueCondition({ 
                          ...completionValueCondition, 
                          valueType: v as QuestValueType 
                        })}
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="presence">Presencia</SelectItem>
                          <SelectItem value="number">Número</SelectItem>
                          <SelectItem value="text">Texto</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {completionValueCondition.valueType !== 'presence' && (
                      <>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Operador</Label>
                          <Select 
                            value={completionValueCondition.operator || (completionValueCondition.valueType === 'number' ? '==' : 'equals')} 
                            onValueChange={(v) => setCompletionValueCondition({ 
                              ...completionValueCondition, 
                              operator: v as any 
                            })}
                          >
                            <SelectTrigger className="bg-background">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {completionValueCondition.valueType === 'number' ? (
                                <>
                                  <SelectItem value=">">&gt; Mayor que</SelectItem>
                                  <SelectItem value="<">&lt; Menor que</SelectItem>
                                  <SelectItem value=">=">≥ Mayor o igual</SelectItem>
                                  <SelectItem value="<=">≤ Menor o igual</SelectItem>
                                  <SelectItem value="==">= Igual</SelectItem>
                                  <SelectItem value="!=">≠ Diferente</SelectItem>
                                </>
                              ) : (
                                <>
                                  <SelectItem value="equals">Igual a</SelectItem>
                                  <SelectItem value="contains">Contiene</SelectItem>
                                  <SelectItem value="startsWith">Empieza con</SelectItem>
                                  <SelectItem value="endsWith">Termina con</SelectItem>
                                  <SelectItem value="notEquals">Diferente de</SelectItem>
                                </>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Valor Objetivo</Label>
                          <Input
                            value={String(completionValueCondition.targetValue || '')}
                            onChange={(e) => setCompletionValueCondition({ 
                              ...completionValueCondition, 
                              targetValue: completionValueCondition.valueType === 'number' 
                                ? Number(e.target.value) 
                                : e.target.value 
                            })}
                            placeholder={completionValueCondition.valueType === 'number' ? '50' : 'texto'}
                            className="bg-background"
                          />
                        </div>
                      </>
                    )}

                    {completionValueCondition.valueType === 'presence' && (
                      <div className="col-span-2 flex items-center text-sm text-muted-foreground">
                        <Info className="w-4 h-4 mr-2" />
                        Detecta si la key existe en el texto (comportamiento por defecto)
                      </div>
                    )}
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-sm font-medium">Configuración de Cadena</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Tipo de Cadena</Label>
                    <Select value={chainType} onValueChange={(v) => setChainType(v as 'none' | 'specific' | 'random')}>
                      <SelectTrigger className="bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin cadena</SelectItem>
                        <SelectItem value="specific">Siguiente específico</SelectItem>
                        <SelectItem value="random">Pool aleatorio</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {chainType === 'specific' && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">ID de la Siguiente Misión</Label>
                      <Input
                        value={chainNextQuestId}
                        onChange={(e) => setChainNextQuestId(e.target.value)}
                        placeholder="siguiente-mision"
                        className="bg-background font-mono"
                      />
                    </div>
                  )}
                </div>

                {chainType === 'random' && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Pool de Misiones (IDs separados por coma)</Label>
                    <Input
                      value={chainRandomPool.join(', ')}
                      onChange={(e) => setChainRandomPool(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                      placeholder="mision-1, mision-2, mision-3"
                      className="bg-background font-mono"
                    />
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Switch
                    checked={chainAutoStart}
                    onCheckedChange={setChainAutoStart}
                  />
                  <span className="text-sm">Iniciar automáticamente la siguiente misión</span>
                </div>
              </div>
            </div>
          )}

          {/* Rewards Section */}
          {activeSection === 'rewards' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Recompensas al Completar</h3>
                <Button variant="outline" size="sm" onClick={addReward}>
                  <Plus className="w-4 h-4 mr-1.5" />
                  Agregar Recompensa
                </Button>
              </div>

              {rewards.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed rounded-lg bg-muted/20">
                  <Gift className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground text-sm">No hay recompensas definidas</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {rewards.map((reward, index) => {
                    // Normalizar para obtener valores actuales
                    const normalized = normalizeReward(reward);
                    const isAttribute = normalized.type === 'attribute';
                    const isTrigger = normalized.type === 'trigger';
                    
                    return (
                      <Card key={reward.id} className="border-border/60">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="flex-1 space-y-3">
                              {/* Type selector and preview */}
                              <div className="flex items-center gap-3">
                                <div className="flex-1">
                                  <Label className="text-[10px] text-muted-foreground mb-1 block">Tipo de Recompensa</Label>
                                  <Select 
                                    value={normalized.type} 
                                    onValueChange={(v) => updateReward(index, { type: v as QuestRewardType })}
                                  >
                                    <SelectTrigger className="bg-background h-9">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="attribute">
                                        <div className="flex items-center gap-2">
                                          <Hash className="w-4 h-4" />
                                          Atributo
                                        </div>
                                      </SelectItem>
                                      <SelectItem value="trigger">
                                        <div className="flex items-center gap-2">
                                          <Zap className="w-4 h-4" />
                                          Trigger
                                        </div>
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                
                                {/* Preview badge */}
                                <div className="pt-5">
                                  <Badge variant="outline" className="text-xs">
                                    {describeReward(normalized)}
                                  </Badge>
                                </div>
                              </div>

                              {/* ATTRIBUTE CONFIG */}
                              {isAttribute && normalized.attribute && (
                                <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-muted/30">
                                  <div className="space-y-1">
                                    <Label className="text-[10px] text-muted-foreground">Key del Atributo</Label>
                                    <Input
                                      value={normalized.attribute.key}
                                      onChange={(e) => updateReward(index, { 
                                        attribute: { ...normalized.attribute!, key: e.target.value } 
                                      })}
                                      placeholder="HP, oro, exp..."
                                      className="bg-background font-mono text-xs h-8"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-[10px] text-muted-foreground">Valor</Label>
                                    <Input
                                      type="number"
                                      value={normalized.attribute.value}
                                      onChange={(e) => updateReward(index, { 
                                        attribute: { ...normalized.attribute!, value: Number(e.target.value) } 
                                      })}
                                      className="bg-background h-8"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-[10px] text-muted-foreground">Acción</Label>
                                    <Select 
                                      value={normalized.attribute.action} 
                                      onValueChange={(v) => updateReward(index, { 
                                        attribute: { ...normalized.attribute!, action: v as AttributeAction } 
                                      })}
                                    >
                                      <SelectTrigger className="bg-background h-8">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="set">= Establecer</SelectItem>
                                        <SelectItem value="add">+ Sumar</SelectItem>
                                        <SelectItem value="subtract">- Restar</SelectItem>
                                        <SelectItem value="multiply">× Multiplicar</SelectItem>
                                        <SelectItem value="divide">÷ Dividir</SelectItem>
                                        <SelectItem value="percent">% Porcentaje</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                              )}

                              {/* TRIGGER CONFIG */}
                              {isTrigger && normalized.trigger && (
                                <div className="space-y-3 p-3 rounded-lg bg-muted/30">
                                  <div className="grid grid-cols-3 gap-3">
                                    <div className="space-y-1">
                                      <Label className="text-[10px] text-muted-foreground">Categoría</Label>
                                      <Select 
                                        value={normalized.trigger.category} 
                                        onValueChange={(v) => updateReward(index, { 
                                          trigger: { ...normalized.trigger!, category: v as TriggerCategory } 
                                        })}
                                      >
                                        <SelectTrigger className="bg-background h-8">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="sprite">
                                            <div className="flex items-center gap-2">
                                              <ImageIcon className="w-3.5 h-3.5" />
                                              Sprite
                                            </div>
                                          </SelectItem>
                                          <SelectItem value="sound">
                                            <div className="flex items-center gap-2">
                                              <Volume2 className="w-3.5 h-3.5" />
                                              Sonido
                                            </div>
                                          </SelectItem>
                                          <SelectItem value="background">
                                            <div className="flex items-center gap-2">
                                              <Wallpaper className="w-3.5 h-3.5" />
                                              Fondo
                                            </div>
                                          </SelectItem>
                                          <SelectItem value="soundSequence">
                                            <div className="flex items-center gap-2">
                                              <Music className="w-3.5 h-3.5" />
                                              Secuencia
                                            </div>
                                          </SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-[10px] text-muted-foreground">Key del Trigger</Label>
                                      <Input
                                        value={normalized.trigger.key}
                                        onChange={(e) => updateReward(index, { 
                                          trigger: { ...normalized.trigger!, key: e.target.value } 
                                        })}
                                        placeholder="feliz, victory, forest..."
                                        className="bg-background font-mono text-xs h-8"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-[10px] text-muted-foreground">Objetivo</Label>
                                      <Select 
                                        value={normalized.trigger.targetMode} 
                                        onValueChange={(v) => updateReward(index, { 
                                          trigger: { ...normalized.trigger!, targetMode: v as TriggerTargetMode } 
                                        })}
                                      >
                                        <SelectTrigger className="bg-background h-8">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="self">
                                            <div className="flex items-center gap-2">
                                              <User className="w-3.5 h-3.5" />
                                              Mismo personaje
                                            </div>
                                          </SelectItem>
                                          <SelectItem value="all">
                                            <div className="flex items-center gap-2">
                                              <Users className="w-3.5 h-3.5" />
                                              Todos
                                            </div>
                                          </SelectItem>
                                          <SelectItem value="target">
                                            <div className="flex items-center gap-2">
                                              <Crosshair className="w-3.5 h-3.5" />
                                              Objetivo específico
                                            </div>
                                          </SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>

                                  {/* Category-specific options */}
                                  {normalized.trigger.category === 'sprite' && (
                                    <div className="grid grid-cols-2 gap-3">
                                      <div className="space-y-1">
                                        <Label className="text-[10px] text-muted-foreground">Volver a Idle (ms)</Label>
                                        <Input
                                          type="number"
                                          min={0}
                                          value={normalized.trigger.returnToIdleMs || 0}
                                          onChange={(e) => updateReward(index, { 
                                            trigger: { ...normalized.trigger!, returnToIdleMs: Number(e.target.value) } 
                                          })}
                                          placeholder="0 = no volver"
                                          className="bg-background h-8"
                                        />
                                      </div>
                                      <div className="flex items-end pb-1">
                                        <p className="text-[10px] text-muted-foreground">
                                          0 = mantener sprite indefinidamente
                                        </p>
                                      </div>
                                    </div>
                                  )}

                                  {normalized.trigger.category === 'sound' && (
                                    <div className="grid grid-cols-2 gap-3">
                                      <div className="space-y-1">
                                        <Label className="text-[10px] text-muted-foreground">Volumen (0-1)</Label>
                                        <Input
                                          type="number"
                                          min={0}
                                          max={1}
                                          step={0.1}
                                          value={normalized.trigger.volume ?? 0.8}
                                          onChange={(e) => updateReward(index, { 
                                            trigger: { ...normalized.trigger!, volume: Number(e.target.value) } 
                                          })}
                                          className="bg-background h-8"
                                        />
                                      </div>
                                      <div className="flex items-end pb-1">
                                        <p className="text-[10px] text-muted-foreground">
                                          Formato key: "coleccion/archivo"
                                        </p>
                                      </div>
                                    </div>
                                  )}

                                  {normalized.trigger.category === 'soundSequence' && (
                                    <div className="grid grid-cols-2 gap-3">
                                      <div className="space-y-1">
                                        <Label className="text-[10px] text-muted-foreground">Volumen (0-1)</Label>
                                        <Input
                                          type="number"
                                          min={0}
                                          max={1}
                                          step={0.1}
                                          value={normalized.trigger.volume ?? 0.8}
                                          onChange={(e) => updateReward(index, { 
                                            trigger: { ...normalized.trigger!, volume: Number(e.target.value) } 
                                          })}
                                          className="bg-background h-8"
                                        />
                                      </div>
                                      <div className="flex items-end pb-1">
                                        <p className="text-[10px] text-muted-foreground">
                                          Key: activationKey de la secuencia
                                        </p>
                                      </div>
                                    </div>
                                  )}

                                  {normalized.trigger.category === 'background' && (
                                    <div className="grid grid-cols-2 gap-3">
                                      <div className="space-y-1">
                                        <Label className="text-[10px] text-muted-foreground">Duración Transición (ms)</Label>
                                        <Input
                                          type="number"
                                          min={0}
                                          value={normalized.trigger.transitionDuration ?? 500}
                                          onChange={(e) => updateReward(index, { 
                                            trigger: { ...normalized.trigger!, transitionDuration: Number(e.target.value) } 
                                          })}
                                          className="bg-background h-8"
                                        />
                                      </div>
                                      <div className="flex items-end pb-1">
                                        <p className="text-[10px] text-muted-foreground">
                                          Key puede ser URL o nombre
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* ID field (collapsed by default) */}
                              <details className="group">
                                <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground flex items-center gap-1">
                                  <ChevronDown className="w-3 h-3 transition-transform group-open:rotate-180" />
                                  ID: {reward.id}
                                </summary>
                                <div className="mt-2">
                                  <Input
                                    value={reward.id}
                                    onChange={(e) => updateReward(index, { id: e.target.value })}
                                    className="bg-background font-mono text-xs h-7"
                                  />
                                </div>
                              </details>
                            </div>

                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-red-500 hover:bg-red-500/10"
                              onClick={() => removeReward(index)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="pt-4 border-t border-border/50">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSave}
            className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white"
          >
            <Check className="w-4 h-4 mr-2" />
            Guardar Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
