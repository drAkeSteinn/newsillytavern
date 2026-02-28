'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTavernStore } from '@/store/tavern-store';
import { ChatMessageBubble } from './chat-message';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
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
  Sparkles
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { ChatLayoutSettings, CharacterCard, CharacterGroup, Persona } from '@/types';
import { t } from '@/lib/i18n';

interface NovelChatBoxProps {
  onSendMessage: (message: string) => void;
  isGenerating: boolean;
  onResetChat?: () => void;
  onClearChat?: () => void;
  onRegenerate?: (messageId: string) => void;
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
  } = useTavernStore();

  const activeSession = getActiveSession();
  const layout = settings.chatLayout;
  const hotkeys = settings.hotkeys;

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
              {activeSession.messages.filter(m => !m.isDeleted).map((message) => {
                // Determine character for this message
                let messageCharacter: CharacterCard | undefined;
                let displayName: string | undefined;
                let displayAvatar: string | undefined;
                
                if (message.role === 'user') {
                  displayName = activePersona?.name || t('message.you');
                  displayAvatar = activePersona?.avatar || undefined;
                } else if (isGroupMode) {
                  messageCharacter = characters.find(c => c.id === message.characterId);
                  displayName = messageCharacter?.name;
                  displayAvatar = messageCharacter?.avatar;
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
                  />
                );
              })}

              {/* Streaming Message or Typing Indicator */}
              {isGenerating && (
                <div className="flex gap-2 py-2 animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-amber-500 flex-shrink-0 flex items-center justify-center">
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
                    <div className="bg-muted rounded-lg rounded-tl-sm px-3 py-2 max-w-[85%]">
                      {streamingContent ? (
                        <StreamingText 
                          content={streamingContent}
                          isStreaming={true}
                          className="text-xs"
                        />
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

          {/* Input Area - Always visible */}
          <div className="p-2 border-t bg-background/50 flex-shrink-0">
            <div className="flex gap-2 items-end">
              <EmojiPicker onEmojiSelect={(emoji) => setInput(prev => prev + emoji)} />
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('chat.messagePlaceholder')}
                className="min-h-[32px] max-h-[80px] resize-none text-xs flex-1"
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
