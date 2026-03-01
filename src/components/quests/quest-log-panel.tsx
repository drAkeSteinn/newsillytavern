'use client';

import { useState, useCallback, useMemo } from 'react';
import { useTavernStore } from '@/store/tavern-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Target,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  Pause,
  Star,
  LayoutList,
  Filter,
  ChevronDown,
  ChevronUp,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { QuestCard } from './quest-card';
import { QuestEditor } from './quest-editor';
import type { Quest, QuestStatus, QuestPriority } from '@/types';

// ============================================
// Quest Log Panel Props
// ============================================

interface QuestLogPanelProps {
  sessionId: string;
  className?: string;
  showSettings?: boolean;
  onOpenSettings?: () => void;
}

// ============================================
// Quest Log Panel Component
// ============================================

export function QuestLogPanel({
  sessionId,
  className,
  showSettings = false,
  onOpenSettings,
}: QuestLogPanelProps) {
  const {
    quests,
    questSettings,
    startQuest,
    updateQuest,
    deleteQuest,
    completeQuest,
    failQuest,
    pauseQuest,
    resumeQuest,
    completeObjective,
    getSessionQuests,
  } = useTavernStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<QuestStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<QuestPriority | 'all'>('all');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingQuest, setEditingQuest] = useState<Quest | undefined>();
  const [sortBy, setSortBy] = useState<'priority' | 'progress' | 'startedAt'>('priority');
  const [sortAsc, setSortAsc] = useState(false);
  
  // Get session quests
  const sessionQuests = useMemo(() => 
    getSessionQuests(sessionId), 
    [getSessionQuests, sessionId]
  );
  
  // Filter and sort quests
  const filteredQuests = useMemo(() => {
    let filtered = sessionQuests;
    
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(q => 
        q.title.toLowerCase().includes(query) ||
        q.description.toLowerCase().includes(query) ||
        q.objectives.some(o => o.description.toLowerCase().includes(query))
      );
    }
    
    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(q => q.status === statusFilter);
    }
    
    // Priority filter
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(q => q.priority === priorityFilter);
    }
    
    // Sort
    filtered = [...filtered].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'priority':
          const priorityOrder = { main: 3, side: 2, hidden: 1 };
          comparison = priorityOrder[b.priority] - priorityOrder[a.priority];
          break;
        case 'progress':
          comparison = b.progress - a.progress;
          break;
        case 'startedAt':
          comparison = new Date(a.startedAt || 0).getTime() - new Date(b.startedAt || 0).getTime();
          break;
      }
      
      return sortAsc ? -comparison : comparison;
    });
    
    return filtered;
  }, [sessionQuests, searchQuery, statusFilter, priorityFilter, sortBy, sortAsc]);
  
  // Stats
  const stats = useMemo(() => {
    const active = sessionQuests.filter(q => q.status === 'active').length;
    const completed = sessionQuests.filter(q => q.status === 'completed').length;
    const failed = sessionQuests.filter(q => q.status === 'failed').length;
    
    return { active, completed, failed };
  }, [sessionQuests]);
  
  // Handlers
  const handleCreateQuest = useCallback((questData: Omit<Quest, 'id' | 'updatedAt'>) => {
    startQuest(questData);
    setEditorOpen(false);
  }, [startQuest]);
  
  const handleEditQuest = useCallback((quest: Quest) => {
    setEditingQuest(quest);
    setEditorOpen(true);
  }, []);
  
  const handleSaveEdit = useCallback((questData: Omit<Quest, 'id' | 'updatedAt'>) => {
    if (editingQuest) {
      updateQuest(editingQuest.id, questData);
    }
    setEditingQuest(undefined);
    setEditorOpen(false);
  }, [editingQuest, updateQuest]);
  
  const handleDeleteQuest = useCallback((questId: string) => {
    if (confirm('¿Eliminar esta misión?')) {
      deleteQuest(questId);
    }
  }, [deleteQuest]);
  
  const toggleSort = useCallback((field: typeof sortBy) => {
    if (sortBy === field) {
      setSortAsc(prev => !prev);
    } else {
      setSortBy(field);
      setSortAsc(false);
    }
  }, [sortBy]);
  
  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Registro de Misiones
          </h3>
          <div className="flex items-center gap-2">
            {showSettings && onOpenSettings && (
              <Button variant="ghost" size="icon" onClick={onOpenSettings}>
                <Settings className="w-4 h-4" />
              </Button>
            )}
            <Button size="sm" onClick={() => { setEditingQuest(undefined); setEditorOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" />
              Nueva
            </Button>
          </div>
        </div>
        
        {/* Stats */}
        <div className="flex items-center gap-3 text-sm">
          <Badge variant="outline" className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
            <Play className="w-3 h-3 mr-1" />
            {stats.active} Activas
          </Badge>
          <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            {stats.completed} Completadas
          </Badge>
          {stats.failed > 0 && (
            <Badge variant="outline" className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20">
              <XCircle className="w-3 h-3 mr-1" />
              {stats.failed} Fallidas
            </Badge>
          )}
        </div>
        
        {/* Search and Filters */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar misiones..."
              className="pl-8 h-8"
            />
          </div>
          
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as QuestStatus | 'all')}>
            <SelectTrigger className="w-28 h-8">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Activas</SelectItem>
              <SelectItem value="completed">Completadas</SelectItem>
              <SelectItem value="paused">Pausadas</SelectItem>
              <SelectItem value="failed">Fallidas</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as QuestPriority | 'all')}>
            <SelectTrigger className="w-28 h-8">
              <SelectValue placeholder="Prioridad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="main">Principal</SelectItem>
              <SelectItem value="side">Secundaria</SelectItem>
              <SelectItem value="hidden">Oculta</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Sort */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Ordenar:</span>
          <Button
            variant={sortBy === 'priority' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => toggleSort('priority')}
          >
            Prioridad
            {sortBy === 'priority' && (
              sortAsc ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />
            )}
          </Button>
          <Button
            variant={sortBy === 'progress' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => toggleSort('progress')}
          >
            Progreso
            {sortBy === 'progress' && (
              sortAsc ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />
            )}
          </Button>
          <Button
            variant={sortBy === 'startedAt' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => toggleSort('startedAt')}
          >
            Fecha
            {sortBy === 'startedAt' && (
              sortAsc ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />
            )}
          </Button>
        </div>
      </div>
      
      {/* Quest List */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {filteredQuests.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center">
                <Target className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-muted-foreground text-sm">
                  {searchQuery || statusFilter !== 'all' || priorityFilter !== 'all'
                    ? 'No se encontraron misiones con esos filtros.'
                    : 'No hay misiones aún. ¡Crea una para empezar!'}
                </p>
                {!searchQuery && statusFilter === 'all' && priorityFilter === 'all' && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-3"
                    onClick={() => { setEditingQuest(undefined); setEditorOpen(true); }}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Crear Misión
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            filteredQuests.map(quest => (
              <QuestCard
                key={quest.id}
                quest={quest}
                onEdit={handleEditQuest}
                onDelete={handleDeleteQuest}
                onComplete={completeQuest}
                onPause={pauseQuest}
                onResume={resumeQuest}
                onFail={failQuest}
                onObjectiveComplete={completeObjective}
              />
            ))
          )}
        </div>
      </ScrollArea>
      
      {/* Quest Editor Modal */}
      <QuestEditor
        open={editorOpen}
        onOpenChange={(open) => { 
          setEditorOpen(open);
          if (!open) setEditingQuest(undefined);
        }}
        onSave={editingQuest ? handleSaveEdit : handleCreateQuest}
        quest={editingQuest}
        sessionId={sessionId}
      />
    </div>
  );
}

// Need to import Play icon
const Play = Target;

export default QuestLogPanel;
