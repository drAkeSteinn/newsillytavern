'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useTavernStore } from '@/store/tavern-store';
import { ChatMessageBubble } from './chat-message';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { EmojiPicker } from './emoji-picker';
import { StreamingText } from './streaming-text';
import { useHotkeys, formatHotkey } from '@/hooks/use-hotkeys';
import {
  Send,
  Loader2,
  GripVertical,
  Settings,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  Eraser,
  Users,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Database,
  ScrollText,
  Check,
  Circle,
  Target,
  Inbox,
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { ChatLayoutSettings, CharacterCard, CharacterGroup, Persona, ChatboxAppearanceSettings } from '@/types';
import { DEFAULT_CHATBOX_APPEARANCE } from '@/types';
import { t } from '@/lib/i18n';
import { QuickPetitions, UserSolicitudesPanel } from './user-solicitudes';

interface NovelChatBoxProps {
  onSendMessage: (message: string) => void;
  isGenerating: boolean;
  onResetChat?: () => void;
  onClearChat?: () => void;
  onRegenerate?: (messageId: string) => void;
  onEdit?: (messageId: string, newContent: string) => void;
  onReplay?: (messageId: string, content: string, characterId?: string) => void;
  streamingContent?: string;
  streamingCharacter?: CharacterCard | null;
  streamingProgress?: { current: number; total: number } | null;
  isGroupMode?: boolean;
  activeGroup?: CharacterGroup | null;
  activeCharacter?: CharacterCard | null;
  characters?: CharacterCard[];
  activePersona?: Persona | null;
}

export function NovelChatBox({ 
  onSendMessage, 
  isGenerating, 
  onResetChat, 
  onClearChat,
  onRegenerate,
  onEdit,
  onReplay,
  streamingContent = '',
  streamingCharacter = null,
  streamingProgress = null,
  isGroupMode = false,
  activeGroup = null,
  activeCharacter = null,
  characters = [],
  activePersona = null
}: NovelChatBoxProps) {
  const [input, setInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showVariables, setShowVariables] = useState(false);
  const [showQuests, setShowQuests] = useState(false);
  const [showSolicitudes, setShowSolicitudes] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0, left: 0, top: 0 });
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 });

  const {
    activeSessionId,
    getActiveSession,
    settings,
    updateSettings,
    deleteMessage,
    swipeMessage,
    getSwipeCount,
    characters: allCharacters,
    questTemplates,
    questSettings,
    activateUserPeticion,
    getPendingUserSolicitudes,
    acceptUserSolicitud,
    rejectUserSolicitud,
  } = useTavernStore();

  const activeSession = getActiveSession();
  const layout = settings.chatLayout;
  const hotkeys = settings.hotkeys;

  // Get appearance settings
  const appearance = settings.chatboxAppearance || DEFAULT_CHATBOX_APPEARANCE;
  const safeAppearance = useMemo(() => ({
    ...DEFAULT_CHATBOX_APPEARANCE,
    ...appearance,
    background: { ...DEFAULT_CHATBOX_APPEARANCE.background, ...appearance?.background },
    font: { ...DEFAULT_CHATBOX_APPEARANCE.font, ...appearance?.font },
    textFormatting: { ...DEFAULT_CHATBOX_APPEARANCE.textFormatting, ...appearance?.textFormatting },
    textColors: { ...DEFAULT_CHATBOX_APPEARANCE.textColors, ...appearance?.textColors },
    bubbles: { ...DEFAULT_CHATBOX_APPEARANCE.bubbles, ...appearance?.bubbles },
    avatars: { ...DEFAULT_CHATBOX_APPEARANCE.avatars, ...appearance?.avatars },
    streaming: { ...DEFAULT_CHATBOX_APPEARANCE.streaming, ...appearance?.streaming },
    input: { ...DEFAULT_CHATBOX_APPEARANCE.input, ...appearance?.input },
  }), [appearance]);

  // Helper function to convert hex color to rgba with transparency
  const hexToRgba = useCallback((hex: string, alpha: number): string => {
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }, []);

  // Get session stats for the variables panel
  const sessionStats = activeSession?.sessionStats;
  
  // Get session quests for the quests panel
  const sessionQuests = activeSession?.sessionQuests || [];

  // Determine display name for header
  const headerName = isGroupMode 
    ? activeGroup?.name || t('chat.groupTitle')
    : activeCharacter?.name || t('chat.title');

  // Auto-scroll to bottom when new messages arrive or during streaming
  useEffect(() => {
    if (settings.autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeSession?.messages, settings.autoScroll, isGenerating, streamingContent]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [input]);

  const updateLayout = useCallback((updates: Partial<ChatLayoutSettings>) => {
    updateSettings({
      chatLayout: {
        ...layout,
        ...updates
      }
    });
  }, [layout, updateSettings]);

  // Drag handlers
  const handleDragStart = (e: React.MouseEvent) => {
    if (isCollapsed) return;
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      left: layout.chatX,
      top: layout.chatY
    };
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleDragMove = (e: MouseEvent) => {
      const container = containerRef.current?.parentElement;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const deltaX = ((e.clientX - dragStartRef.current.x) / rect.width) * 100;
      const deltaY = ((e.clientY - dragStartRef.current.y) / rect.height) * 100;

      let newX = dragStartRef.current.left + deltaX;
      let newY = dragStartRef.current.top + deltaY;

      // Constrain to container bounds
      const halfWidth = layout.chatWidth / 2;
      const halfHeight = layout.chatHeight / 2;
      newX = Math.max(halfWidth, Math.min(100 - halfWidth, newX));
      newY = Math.max(halfHeight, Math.min(100 - halfHeight, newY));

      updateLayout({ chatX: newX, chatY: newY });
    };

    const handleDragEnd = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);

    return () => {
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
    };
  }, [isDragging, layout.chatWidth, layout.chatHeight, updateLayout]);

  // Resize handlers
  const handleResizeStart = (e: React.MouseEvent) => {
    if (isCollapsed) return;
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: layout.chatWidth,
      height: layout.chatHeight
    };
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleResizeMove = (e: MouseEvent) => {
      const container = containerRef.current?.parentElement;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const deltaX = ((e.clientX - resizeStartRef.current.x) / rect.width) * 100;
      const deltaY = ((e.clientY - resizeStartRef.current.y) / rect.height) * 100;

      let newWidth = Math.max(25, Math.min(90, resizeStartRef.current.width + deltaX * 2));
      let newHeight = Math.max(30, Math.min(90, resizeStartRef.current.height + deltaY * 2));

      updateLayout({ chatWidth: newWidth, chatHeight: newHeight });
    };

    const handleResizeEnd = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);

    return () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
    };
  }, [isResizing, updateLayout]);

  const handleSend = () => {
    if (!input.trim() || isGenerating) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const sendKey = hotkeys.send || 'Enter';
    const newLineKey = hotkeys.newLine || 'Shift+Enter';
    
    // Check if this is the send hotkey
    const isSendKey = sendKey.toLowerCase() === 'enter' && e.key === 'Enter' && !e.shiftKey;
    const isNewLineKey = newLineKey.toLowerCase() === 'shift+enter' && e.key === 'Enter' && e.shiftKey;
    
    if (isSendKey) {
      e.preventDefault();
      handleSend();
    } else if (isNewLineKey) {
      // Let the default behavior (new line) happen
      return;
    }
  };

  // Hotkeys for regenerate and swipe (global)
  useHotkeys(hotkeys, {
    onRegenerate: () => {
      if (!isGenerating && activeSession && activeSession.messages.length > 0) {
        // Get last assistant message
        const lastAssistantMsg = [...activeSession.messages].reverse().find(m => m.role === 'assistant' && !m.isDeleted);
        if (lastAssistantMsg) {
          // Trigger regenerate by deleting and resending
          deleteMessage(activeSessionId!, lastAssistantMsg.id);
          setInput('');
        }
      }
    },
    onSwipeLeft: () => {
      // Could be used for message swiping in future
    },
    onSwipeRight: () => {
      // Could be used for message swiping in future
    }
  }, !isGenerating);

  const handleQuickReply = (reply: string) => {
    setInput(reply);
    textareaRef.current?.focus();
  };

  // Get pending user solicitudes
  const pendingUserSolicitudes = activeSessionId 
    ? getPendingUserSolicitudes(activeSessionId)
    : [];

  // Handle user activating a peticion
  const handleActivatePeticion = (
    targetCharacterId: string,
    solicitudKey: string,
    description: string
  ) => {
    if (!activeSessionId) return;
    
    activateUserPeticion(
      activeSessionId,
      targetCharacterId,
      solicitudKey,
      description,
      activePersona?.name || 'Usuario'
    );
  };

  if (!activeSession) return null;

  return (
    <div
      ref={containerRef}
      className={cn(
        "absolute z-20 flex flex-col rounded-lg shadow-2xl overflow-hidden transition-colors",
        isDragging && "cursor-grabbing",
        isResizing && "cursor-nwse-resize"
      )}
      style={{
        left: `${layout.chatX}%`,
        top: `${layout.chatY}%`,
        transform: 'translate(-50%, -50%)',
        width: `${layout.chatWidth}%`,
        height: isCollapsed ? 'auto' : `${layout.chatHeight}%`,
        minHeight: isCollapsed ? 'auto' : '180px',
        maxHeight: isCollapsed ? 'auto' : '95vh',
        backgroundColor: `hsl(var(--background) / ${layout.chatOpacity})`,
        backdropFilter: layout.blurBackground ? 'blur(12px)' : undefined,
      }}
    >
      {/* Drag Handle / Header */}
      <div
        className="flex items-center justify-between px-3 py-2 bg-background/50 border-b cursor-grab active:cursor-grabbing select-none flex-shrink-0"
        onMouseDown={handleDragStart}
      >
        <div className="flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-muted-foreground" />
          
          {/* Avatar in header */}
          <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0">
            {isGroupMode ? (
              <div className="w-full h-full bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center">
                <Users className="w-3 h-3 text-white" />
              </div>
            ) : activeCharacter?.avatar ? (
              <img 
                src={activeCharacter.avatar} 
                alt={activeCharacter.name}
                className="w-full h-full object-cover" 
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center">
                <span className="text-white font-bold text-xs">
                  {activeCharacter?.name?.[0]?.toUpperCase() || '?'}
                </span>
              </div>
            )}
          </div>
          
          <span className="text-sm font-medium truncate max-w-[150px]">
            {headerName}
          </span>
          
          {/* Message count */}
          <span className="text-xs text-muted-foreground">
            {activeSession.messages.filter(m => !m.isDeleted).length}{t('chat.messagesCount')}
          </span>
        </div>
        
        <div className="flex items-center gap-1">
          {/* Session Variables Popover */}
          <Popover open={showVariables} onOpenChange={setShowVariables}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <Database className="w-4 h-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 max-h-96 overflow-y-auto" align="end">
              <div className="space-y-3">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  {t('chatbox.sessionVariables')}
                </h4>
                
                {!sessionStats?.initialized ? (
                  <div className="text-center py-4 text-muted-foreground text-xs">
                    <Database className="w-6 h-6 mx-auto mb-2 opacity-50" />
                    {t('chatbox.noVariables')}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* For each character with stats */}
                    {Object.entries(sessionStats.characterStats).map(([charId, charStats]) => {
                      const character = allCharacters.find(c => c.id === charId);
                      if (!character) return null;
                      
                      const attributeValues = charStats.attributeValues;
                      const attributeDefs = character.statsConfig?.attributes || [];
                      
                      if (Object.keys(attributeValues).length === 0) return null;
                      
                      return (
                        <div key={charId} className="space-y-2">
                          {/* Character Header */}
                          <div className="flex items-center gap-2 pb-1 border-b">
                            <div className="w-5 h-5 rounded-full overflow-hidden">
                              {character.avatar ? (
                                <img src={character.avatar} alt={character.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center">
                                  <span className="text-white font-bold text-[10px]">{character.name?.[0]?.toUpperCase()}</span>
                                </div>
                              )}
                            </div>
                            <span className="text-xs font-medium">{character.name}</span>
                          </div>
                          
                          {/* Attributes Grid */}
                          <div className="grid grid-cols-2 gap-1.5">
                            {Object.entries(attributeValues).map(([key, value]) => {
                              const attrDef = attributeDefs.find(a => a.key === key);
                              const icon = attrDef?.icon;
                              const color = attrDef?.color || 'default';
                              
                              const colorClasses: Record<string, string> = {
                                red: 'bg-red-500/20 border-red-500/30 text-red-400',
                                green: 'bg-green-500/20 border-green-500/30 text-green-400',
                                blue: 'bg-blue-500/20 border-blue-500/30 text-blue-400',
                                yellow: 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400',
                                purple: 'bg-purple-500/20 border-purple-500/30 text-purple-400',
                                orange: 'bg-orange-500/20 border-orange-500/30 text-orange-400',
                                cyan: 'bg-cyan-500/20 border-cyan-500/30 text-cyan-400',
                                default: 'bg-white/10 border-white/20 text-white/80',
                              };
                              
                              return (
                                <div
                                  key={key}
                                  className={cn(
                                    'flex items-center gap-1.5 px-2 py-1 rounded border text-xs',
                                    colorClasses[color] || colorClasses.default
                                  )}
                                >
                                  {icon && <span className="text-xs">{icon}</span>}
                                  <span className="text-muted-foreground truncate">{attrDef?.name || key}:</span>
                                  <span className="font-medium">{String(value)}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                    
                    {/* Session Events Section */}
                    <div className="space-y-2 pt-2 border-t">
                      <div className="flex items-center gap-2 pb-1">
                        <span className="text-xs font-medium text-amber-400">Eventos de Sesión</span>
                      </div>
                      <div className="space-y-1.5">
                        {/* ultimo_objetivo_completado */}
                        <div className="flex items-start gap-1.5 px-2 py-1.5 rounded border bg-amber-500/10 border-amber-500/20 text-xs">
                          <span className="text-muted-foreground shrink-0">Objetivo completado:</span>
                          <span className="text-amber-400">{sessionStats.ultimo_objetivo_completado || 'N/A'}</span>
                        </div>
                        {/* ultima_solicitud_realizada */}
                        <div className="flex items-start gap-1.5 px-2 py-1.5 rounded border bg-emerald-500/10 border-emerald-500/20 text-xs">
                          <span className="text-muted-foreground shrink-0">Solicitud realizada:</span>
                          <span className="text-emerald-400">{sessionStats.ultima_solicitud_realizada || 'N/A'}</span>
                        </div>
                        {/* ultima_solicitud_completada */}
                        <div className="flex items-start gap-1.5 px-2 py-1.5 rounded border bg-cyan-500/10 border-cyan-500/20 text-xs">
                          <span className="text-muted-foreground shrink-0">Solicitud completada:</span>
                          <span className="text-cyan-400">{sessionStats.ultima_solicitud_completada || 'N/A'}</span>
                        </div>
                        {/* ultima_accion_realizada */}
                        <div className="flex items-start gap-1.5 px-2 py-1.5 rounded border bg-purple-500/10 border-purple-500/20 text-xs">
                          <span className="text-muted-foreground shrink-0">Acción realizada:</span>
                          <span className="text-purple-400">{sessionStats.ultima_accion_realizada || 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* Quests Popover */}
          <Popover open={showQuests} onOpenChange={setShowQuests}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 relative">
                <ScrollText className="w-4 h-4" />
                {sessionQuests.filter(q => q.status === 'active').length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-amber-500 rounded-full flex items-center justify-center text-[8px] font-bold text-white">
                    {sessionQuests.filter(q => q.status === 'active').length}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 max-h-96 overflow-y-auto" align="end">
              <div className="space-y-3">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <ScrollText className="w-4 h-4 text-amber-500" />
                  {t('chatbox.quests')}
                </h4>
                
                {!questSettings.enabled ? (
                  <div className="text-center py-4 text-muted-foreground text-xs">
                    <ScrollText className="w-6 h-6 mx-auto mb-2 opacity-50" />
                    {t('chatbox.questsDisabled')}
                  </div>
                ) : sessionQuests.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground text-xs">
                    <ScrollText className="w-6 h-6 mx-auto mb-2 opacity-50" />
                    {t('chatbox.noQuests')}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Active Quests */}
                    {sessionQuests.filter(q => q.status === 'active').map(quest => {
                      const template = questTemplates.find(t => t.id === quest.templateId);
                      if (!template) return null;
                      
                      const completedObjectives = quest.objectives.filter(o => o.isCompleted).length;
                      const totalObjectives = quest.objectives.length;
                      
                      return (
                        <div
                          key={quest.templateId}
                          className="p-2 rounded-lg border bg-amber-500/10 border-amber-500/30"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{template.icon || '📜'}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-medium truncate">{template.name}</span>
                                {template.priority === 'main' && (
                                  <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[8px] px-1">
                                    Main
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <div className="flex-1 h-1 bg-black/20 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-amber-500 rounded-full"
                                    style={{ width: `${quest.progress}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-muted-foreground">
                                  {Math.round(quest.progress)}%
                                </span>
                              </div>
                              <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                                <Target className="w-3 h-3" />
                                <span>{completedObjectives}/{totalObjectives} {t('chatbox.objectives')}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    
                    {/* Available Quests */}
                    {sessionQuests.filter(q => q.status === 'available').length > 0 && (
                      <>
                        <div className="text-[10px] text-muted-foreground mt-2 pt-2 border-t">
                          {t('chatbox.availableQuests')}
                        </div>
                        {sessionQuests.filter(q => q.status === 'available').map(quest => {
                          const template = questTemplates.find(t => t.id === quest.templateId);
                          if (!template) return null;
                          
                          return (
                            <div
                              key={quest.templateId}
                              className="p-2 rounded-lg border bg-muted/50 border-border/50 opacity-70"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{template.icon || '📜'}</span>
                                <span className="text-xs truncate">{template.name}</span>
                                <Circle className="w-3 h-3 text-muted-foreground ml-auto" />
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}
                    
                    {/* Completed Quests */}
                    {sessionQuests.filter(q => q.status === 'completed').length > 0 && (
                      <>
                        <div className="text-[10px] text-muted-foreground mt-2 pt-2 border-t">
                          {t('chatbox.completedQuests')}
                        </div>
                        {sessionQuests.filter(q => q.status === 'completed').slice(0, 3).map(quest => {
                          const template = questTemplates.find(t => t.id === quest.templateId);
                          if (!template) return null;
                          
                          return (
                            <div
                              key={quest.templateId}
                              className="p-2 rounded-lg border bg-green-500/10 border-green-500/30"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{template.icon || '📜'}</span>
                                <span className="text-xs truncate line-through opacity-70">{template.name}</span>
                                <Check className="w-3 h-3 text-green-500 ml-auto" />
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* User Solicitudes Popover */}
          <Popover open={showSolicitudes} onOpenChange={setShowSolicitudes}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 relative">
                <Inbox className="w-4 h-4" />
                {pendingUserSolicitudes.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-amber-500 rounded-full flex items-center justify-center text-[8px] font-bold text-white">
                    {pendingUserSolicitudes.length}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 max-h-96 overflow-y-auto" align="end">
              <div className="space-y-3">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <Inbox className="w-4 h-4 text-amber-500" />
                  Solicitudes Recibidas
                </h4>
                
                {pendingUserSolicitudes.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground text-xs">
                    <Inbox className="w-6 h-6 mx-auto mb-2 opacity-50" />
                    No tienes solicitudes pendientes
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pendingUserSolicitudes.map((solicitud) => (
                      <div
                        key={solicitud.id}
                        className="p-2 rounded-lg border bg-amber-500/10 border-amber-500/30"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-medium text-amber-400">
                                De: {solicitud.fromCharacterName}
                              </span>
                            </div>
                            <p className="text-[10px] text-muted-foreground mb-1">
                              {solicitud.description}
                            </p>
                            <code className="text-[9px] bg-black/20 px-1 py-0.5 rounded font-mono">
                              {solicitud.key}
                            </code>
                          </div>
                        </div>
                        <div className="flex gap-1 mt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-[10px] bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20 flex-1"
                            onClick={() => {
                              if (activeSessionId) {
                                acceptUserSolicitud(activeSessionId, solicitud.id);
                              }
                            }}
                          >
                            ✓ Aceptar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-[10px] bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20 flex-1"
                            onClick={() => {
                              if (activeSessionId) {
                                rejectUserSolicitud(activeSessionId, solicitud.id);
                              }
                            }}
                          >
                            ✗ Rechazar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* Settings Popover */}
          <Popover open={showSettings} onOpenChange={setShowSettings}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <Settings className="w-4 h-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="end">
              <div className="space-y-4">
                <h4 className="font-medium text-sm">{t('chatbox.settings')}</h4>
                
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">{t('chatbox.width')} {Math.round(layout.chatWidth)}%</label>
                  <Slider
                    value={[layout.chatWidth]}
                    onValueChange={([value]) => updateLayout({ chatWidth: value })}
                    min={25}
                    max={90}
                    step={1}
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">{t('chatbox.height')} {Math.round(layout.chatHeight)}%</label>
                  <Slider
                    value={[layout.chatHeight]}
                    onValueChange={([value]) => updateLayout({ chatHeight: value })}
                    min={20}
                    max={90}
                    step={1}
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">{t('chatbox.opacity')} {Math.round(layout.chatOpacity * 100)}%</label>
                  <Slider
                    value={[layout.chatOpacity * 100]}
                    onValueChange={([value]) => updateLayout({ chatOpacity: value / 100 })}
                    min={50}
                    max={100}
                    step={1}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-xs text-muted-foreground">{t('chatbox.blurBackground')}</label>
                  <Button
                    variant={layout.blurBackground ? "default" : "outline"}
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => updateLayout({ blurBackground: !layout.blurBackground })}
                  >
                    {layout.blurBackground ? t('common.on') : t('common.off')}
                  </Button>
                </div>

                {/* Chat Actions */}
                <div className="pt-2 border-t space-y-2">
                  <label className="text-xs text-muted-foreground">{t('chatbox.actions')}</label>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-7 text-xs"
                      onClick={() => {
                        setShowSettings(false);
                        onResetChat?.();
                      }}
                    >
                      <RotateCcw className="w-3 h-3 mr-1" />
                      {t('common.reset')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-7 text-xs text-destructive hover:text-destructive"
                      onClick={() => {
                        setShowSettings(false);
                        onClearChat?.();
                      }}
                    >
                      <Eraser className="w-3 h-3 mr-1" />
                      {t('common.clear')}
                    </Button>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    updateLayout({
                      chatWidth: 60,
                      chatHeight: 70,
                      chatX: 50,
                      chatY: 50,
                      chatOpacity: 0.95
                    });
                  }}
                >
                  {t('chat.resetPosition')}
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Collapse Button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            {isCollapsed ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Messages Area */}
      {!isCollapsed && (
        <>
          <ScrollArea className="flex-1 min-h-0" ref={scrollRef}>
            <div className="p-2 space-y-2">
              {activeSession.messages.filter(m => {
                // Filter deleted messages
                if (m.isDeleted) return false;

                // Check if this is a narrator message and if narrator is hidden from chat
                if (isGroupMode && activeGroup?.narratorSettings?.hiddenFromChat && m.role === 'assistant') {
                  // Find if this character is a narrator
                  const memberInfo = activeGroup.members?.find(mem => mem.characterId === m.characterId);
                  if (memberInfo?.isNarrator) {
                    return false; // Hide narrator messages from chat display
                  }
                }

                return true;
              }).map((message) => {
                // Determine character for this message
                let messageCharacter: CharacterCard | undefined;
                let displayName: string | undefined;
                let displayAvatar: string | undefined;
                let isNarratorMessage = false;

                if (message.role === 'user') {
                  displayName = activePersona?.name || t('message.you');
                  displayAvatar = activePersona?.avatar || undefined;
                } else if (isGroupMode) {
                  // Use allCharacters from store if characters prop is empty
                  const characterList = characters.length > 0 ? characters : allCharacters;
                  messageCharacter = characterList.find(c => c.id === message.characterId);
                  displayName = messageCharacter?.name;
                  displayAvatar = messageCharacter?.avatar;

                  // Check if this character is a narrator in the group
                  if (activeGroup?.members) {
                    const memberInfo = activeGroup.members.find(m => m.characterId === message.characterId);
                    isNarratorMessage = memberInfo?.isNarrator || false;
                  }

                  // Debug: log if character not found
                  if (!messageCharacter && message.characterId) {
                    console.warn('[NovelChatBox] Character not found:', message.characterId, 'Available:', characterList.map(c => c.id));
                  }
                } else {
                  messageCharacter = activeCharacter || undefined;
                  displayName = activeCharacter?.name;
                  displayAvatar = activeCharacter?.avatar;
                }

                return (
                  <ChatMessageBubble
                    key={message.id}
                    message={message}
                    characterName={displayName}
                    characterAvatar={displayAvatar}
                    userName={activePersona?.name || t('message.you')}
                    userAvatar={activePersona?.avatar || undefined}
                    showTimestamp={settings.showTimestamps}
                    showTokens={settings.showTokens}
                    onDelete={() => deleteMessage(activeSessionId!, message.id)}
                    displayMode={settings.messageDisplay}
                    onSwipe={(direction) => swipeMessage(activeSessionId!, message.id, direction)}
                    hasAlternatives={(message.swipes?.length || 1) > 1}
                    currentIndex={message.swipeIndex || 0}
                    totalAlternatives={message.swipes?.length || 1}
                    onRegenerate={() => onRegenerate?.(message.id)}
                    onEdit={onEdit}
                    onReplay={onReplay}
                    isNarrator={isNarratorMessage}
                  />
                );
              })}

              {/* Streaming Message or Typing Indicator */}
              {isGenerating && (
                <div className="flex gap-2 py-2 animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
                  {/* Avatar */}
                  <div 
                    className={cn(
                      'overflow-hidden flex-shrink-0 flex items-center justify-center',
                      safeAppearance.avatars.size === 'sm' ? 'w-8 h-8' : 
                      safeAppearance.avatars.size === 'md' ? 'w-10 h-10' :
                      safeAppearance.avatars.size === 'lg' ? 'w-12 h-12' : 'w-14 h-14',
                      safeAppearance.avatars.shape === 'circle' ? 'rounded-full' :
                      safeAppearance.avatars.shape === 'square' ? 'rounded-none' :
                      safeAppearance.avatars.shape === 'rounded' ? 'rounded-lg' : 'rounded-sm'
                    )}
                    style={{
                      borderWidth: safeAppearance.avatars.showBorder ? safeAppearance.avatars.borderWidth : 0,
                      borderColor: safeAppearance.avatars.borderColor,
                      borderStyle: 'solid',
                    }}
                  >
                    {isGroupMode && streamingCharacter ? (
                      streamingCharacter.avatar ? (
                        <img 
                          src={streamingCharacter.avatar} 
                          alt={streamingCharacter.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center">
                          <span className="text-white font-bold text-xs">
                            {streamingCharacter.name?.[0]?.toUpperCase() || '?'}
                          </span>
                        </div>
                      )
                    ) : activeCharacter?.avatar ? (
                      <img 
                        src={activeCharacter.avatar} 
                        alt={activeCharacter.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center">
                        <span className="text-white font-bold text-xs">
                          {activeCharacter?.name?.[0]?.toUpperCase() || '?'}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    {/* Name above bubble */}
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-xs font-medium">
                        {isGroupMode && streamingCharacter 
                          ? streamingCharacter.name 
                          : activeCharacter?.name || 'Assistant'}
                      </span>
                      {streamingProgress && (
                        <span className="text-[10px] text-muted-foreground">
                          ({streamingProgress.current}/{streamingProgress.total})
                        </span>
                      )}
                    </div>
                    
                    {/* Content bubble */}
                    <div 
                      className="px-3 py-2"
                      style={{
                        backgroundColor: hexToRgba(safeAppearance.bubbles.characterBubbleColor, safeAppearance.bubbles.transparency),
                        borderRadius: safeAppearance.bubbles.borderRadius,
                        borderTopLeftRadius: 4,
                        maxWidth: `${safeAppearance.bubbles.maxWidth}%`,
                        boxShadow: safeAppearance.bubbles.shadowEnabled 
                          ? safeAppearance.bubbles.shadowIntensity === 'soft' ? '0 1px 3px rgba(0,0,0,0.1)' :
                            safeAppearance.bubbles.shadowIntensity === 'medium' ? '0 4px 6px rgba(0,0,0,0.15)' :
                            '0 10px 15px rgba(0,0,0,0.2)' : undefined,
                      }}
                    >
                      {streamingContent ? (
                        <div 
                          className="text-xs"
                          style={{ 
                            color: safeAppearance.bubbles.characterBubbleTextColor,
                          }}
                        >
                          {streamingContent}
                          {safeAppearance.streaming.showCursor && (
                            <span 
                              className="inline-block ml-0.5 animate-pulse"
                              style={{ color: safeAppearance.streaming.cursorColor }}
                            >
                              {safeAppearance.streaming.cursorStyle === 'block' ? '▋' :
                               safeAppearance.streaming.cursorStyle === 'line' ? '|' :
                               safeAppearance.streaming.cursorStyle === 'underscore' ? '_' : '●'}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Auto-scroll anchor */}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Quick Replies - Compact */}
          {settings.quickReplies.length > 0 && (
            <div className="px-2 py-1 flex gap-1 overflow-x-auto border-t bg-background/30 flex-shrink-0">
              {settings.quickReplies.slice(0, 4).map((reply, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-xs flex-shrink-0"
                  onClick={() => handleQuickReply(reply)}
                >
                  {reply}
                </Button>
              ))}
            </div>
          )}

          {/* User Peticiones - Quick Tags */}
          <QuickPetitions
            activePersona={activePersona}
            activeCharacter={activeCharacter}
            characters={isGroupMode ? (characters.length > 0 ? characters : allCharacters) : (activeCharacter ? [activeCharacter] : [])}
            onActivatePeticion={handleActivatePeticion}
          />

          {/* User Solicitudes Panel - Incoming requests for user */}
          {pendingUserSolicitudes.length > 0 && (
            <div className="px-2 py-1 border-t bg-background/30 flex-shrink-0">
              <UserSolicitudesPanel />
            </div>
          )}

          {/* Input Area - Always visible */}
          <div 
            className="p-2 border-t flex-shrink-0"
            style={{
              backgroundColor: safeAppearance.input.backgroundColor,
              borderColor: safeAppearance.input.borderColor,
            }}
          >
            <div className="flex gap-2 items-end">
              <EmojiPicker onEmojiSelect={(emoji) => setInput(prev => prev + emoji)} />
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('chat.messagePlaceholder')}
                className="min-h-[32px] max-h-[80px] resize-none flex-1 placeholder:text-muted-foreground"
                style={{
                  color: safeAppearance.input.textColor,
                  borderColor: safeAppearance.input.borderColor,
                  borderRadius: safeAppearance.input.borderRadius,
                  fontSize: safeAppearance.input.fontSize === 'sm' ? '0.75rem' : 
                           safeAppearance.input.fontSize === 'lg' ? '1.125rem' : '1rem',
                }}
                disabled={isGenerating}
                rows={1}
              />
              <Button
                size="icon"
                className="h-8 w-8 flex-shrink-0"
                onClick={handleSend}
                disabled={!input.trim() || isGenerating}
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Resize Handles */}
          <div
            className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
            onMouseDown={handleResizeStart}
          >
            <div className="absolute bottom-1 right-1 w-2 h-2 border-r-2 border-b-2 border-muted-foreground/30" />
          </div>
        </>
      )}
    </div>
  );
}
