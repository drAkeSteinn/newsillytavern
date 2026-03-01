'use client';

import { cn } from '@/lib/utils';
import type { ChatMessage as ChatMessageType, PromptSection } from '@/types';
import { Copy, Check, Trash2, RefreshCw, ChevronLeft, ChevronRight, Volume2, Eye, Edit2, Play, X, Check as CheckIcon } from 'lucide-react';
import { useState, memo, Fragment } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { formatDistanceToNow } from 'date-fns';
import { TextFormatter } from './text-formatter';
import { PromptViewerDialog } from './prompt-viewer-dialog';
import { t } from '@/lib/i18n';

type MessageDisplayMode = 'bubble' | 'compact' | 'full';

interface ChatMessageProps {
  message: ChatMessageType;
  characterName?: string;
  characterAvatar?: string;
  userName?: string;
  userAvatar?: string;
  showTimestamp?: boolean;
  showTokens?: boolean;
  onSwipe?: (direction: 'left' | 'right') => void;
  onDelete?: () => void;
  onRegenerate?: () => void;
  onSpeak?: () => void;
  onEdit?: (messageId: string, newContent: string) => void;
  onReplay?: (messageId: string, content: string, characterId?: string) => void;
  hasAlternatives?: boolean;
  currentIndex?: number;
  totalAlternatives?: number;
  displayMode?: MessageDisplayMode;
}

export const ChatMessageBubble = memo(function ChatMessageBubble({
  message,
  characterName = t('message.assistant'),
  characterAvatar,
  userName = t('message.you'),
  userAvatar,
  showTimestamp = true,
  showTokens = false,
  onSwipe,
  onDelete,
  onRegenerate,
  onSpeak,
  onEdit,
  onReplay,
  hasAlternatives = false,
  currentIndex = 0,
  totalAlternatives = 1,
  displayMode = 'bubble'
}: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const [showPromptDialog, setShowPromptDialog] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  
  const isCompact = displayMode === 'compact';
  const isFull = displayMode === 'full';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartEdit = () => {
    setEditContent(message.content);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditContent(message.content);
    setIsEditing(false);
  };

  const handleSaveEdit = () => {
    if (editContent.trim()) {
      onEdit?.(message.id, editContent.trim());
    }
    setIsEditing(false);
  };

  const handleReplay = () => {
    onReplay?.(message.id, message.content, message.characterId);
  };

  // Always allow viewing prompt for assistant messages
  const hasPromptData = message.metadata?.promptData && message.metadata.promptData.length > 0;

  if (message.isDeleted) return null;

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <div className="bg-muted/50 px-3 py-1.5 rounded-lg text-xs text-muted-foreground max-w-md text-center">
          {message.content}
        </div>
      </div>
    );
  }

  // Determine display name and avatar
  const displayName = isUser ? userName : characterName;
  const displayAvatar = isUser ? userAvatar : characterAvatar;
  const avatarBorder = isUser ? 'border-blue-500' : 'border-amber-500';
  const avatarGradient = isUser 
    ? 'from-blue-400 to-blue-600' 
    : 'from-amber-400 to-orange-600';

  // Full mode: simpler layout, no bubbles
  if (isFull) {
    return (
      <Fragment>
        <div className={cn(
          'group py-2 px-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-300',
          isUser && 'bg-primary/5'
        )}>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm">{displayName}</span>
            {showTimestamp && (
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })}
              </span>
            )}
            {showTokens && message.metadata?.tokens && (
              <span className="text-xs text-muted-foreground/70">
                • {message.metadata.tokens} tokens
              </span>
            )}
          </div>
          
          {isEditing ? (
            <div className="space-y-2">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[80px] text-sm"
                autoFocus
              />
              <div className="flex gap-1">
                <Button size="sm" type="button" onClick={handleSaveEdit}>
                  <CheckIcon className="h-3 w-3 mr-1" />
                  {t('common.save')}
                </Button>
                <Button size="sm" type="button" variant="ghost" onClick={handleCancelEdit}>
                  <X className="h-3 w-3 mr-1" />
                  {t('common.cancel')}
                </Button>
              </div>
            </div>
          ) : (
            <TextFormatter 
              content={message.content} 
              isUser={isUser}
              className="text-sm leading-relaxed"
            />
          )}
          
          <div className={cn(
            'flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity'
          )}>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleCopy}
            >
              {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
            </Button>
            {!isUser && (
              <>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6"
                  onClick={() => setShowPromptDialog(true)}
                  title={t('message.viewPrompt')}
                >
                  <Eye className="h-3 w-3" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6"
                  onClick={handleStartEdit}
                  title={t('message.edit')}
                >
                  <Edit2 className="h-3 w-3" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6"
                  onClick={handleReplay}
                  title={t('message.replay')}
                >
                  <Play className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onSpeak}>
                  <Volume2 className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onRegenerate}>
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </>
            )}
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onDelete}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
        {/* Prompt Viewer Dialog for full mode */}
        <PromptViewerDialog
          open={showPromptDialog}
          onOpenChange={setShowPromptDialog}
          sections={message.metadata?.promptData || []}
        />
      </Fragment>
    );
  }

  return (
    <div
      className={cn(
        'group flex gap-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-300',
        isCompact ? 'py-2 px-1' : 'py-3 px-4',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* Avatar - Circular */}
      <div className="flex-shrink-0 self-start">
        <div className={cn(
          'rounded-full overflow-hidden border-2 flex items-center justify-center',
          isCompact ? 'w-8 h-8' : 'w-10 h-10',
          avatarBorder
        )}>
          {displayAvatar ? (
            <img 
              src={displayAvatar} 
              alt={displayName} 
              className="w-full h-full object-cover" 
            />
          ) : (
            <div className={cn(
              'w-full h-full flex items-center justify-center bg-gradient-to-br',
              avatarGradient
            )}>
              <span className="text-white font-bold text-sm">
                {displayName?.[0]?.toUpperCase() || '?'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Message Content */}
      <div className={cn(
        'flex-1 max-w-[80%]',
        isUser ? 'items-end' : 'items-start',
        'flex flex-col'
      )}>
        {/* Name and Timestamp - Above the bubble */}
        <div className={cn(
          'flex items-center gap-2 mb-1',
          isUser ? 'flex-row-reverse' : 'flex-row'
        )}>
          <span className={cn(
            'font-medium',
            isCompact ? 'text-xs' : 'text-sm'
          )}>
            {displayName}
          </span>
          {showTimestamp && !isCompact && (
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })}
            </span>
          )}
          {showTokens && !isCompact && message.metadata?.tokens && (
            <span className="text-xs text-muted-foreground/70">
              • {message.metadata.tokens} tokens
            </span>
          )}
        </div>

        {/* Message Bubble */}
        <div className={cn(
          'rounded-2xl relative group/message',
          isCompact ? 'px-3 py-2' : 'px-4 py-3',
          isUser 
            ? 'bg-primary text-primary-foreground rounded-tr-sm' 
            : 'bg-muted rounded-tl-sm'
        )}>
          {isEditing ? (
            <div className="space-y-2 min-w-[200px]">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[80px] text-sm bg-background/50"
                autoFocus
              />
              <div className="flex gap-1">
                <Button size="sm" type="button" className="h-6 text-xs" onClick={handleSaveEdit}>
                  <CheckIcon className="h-3 w-3 mr-1" />
                  {t('common.save')}
                </Button>
                <Button size="sm" type="button" variant="ghost" className="h-6 text-xs" onClick={handleCancelEdit}>
                  <X className="h-3 w-3 mr-1" />
                  {t('common.cancel')}
                </Button>
              </div>
            </div>
          ) : (
            <TextFormatter 
              content={message.content} 
              isUser={isUser}
              className={cn(
                'text-sm leading-relaxed',
                isCompact && 'text-xs'
              )}
            />
          )}

          {/* Swipe Indicators */}
          {!isUser && !isCompact && !isEditing && (
            <div className="absolute -left-8 top-1/2 -translate-y-1/2 flex flex-col gap-1">
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-6 w-6 transition-opacity",
                  hasAlternatives && currentIndex > 0 
                    ? "opacity-0 group-hover:opacity-100" 
                    : "opacity-0 cursor-default"
                )}
                onClick={() => onSwipe?.('left')}
                disabled={currentIndex === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className={cn(
                "text-xs text-center transition-opacity",
                hasAlternatives ? "text-muted-foreground" : "opacity-0"
              )}>
                {currentIndex + 1}/{totalAlternatives}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-6 w-6 transition-opacity",
                  "opacity-0 group-hover:opacity-100"
                )}
                onClick={() => {
                  // If at last swipe, generate new alternative
                  if (currentIndex === totalAlternatives - 1) {
                    onRegenerate?.();
                  } else {
                    onSwipe?.('right');
                  }
                }}
                title={currentIndex === totalAlternatives - 1 ? t('message.swipe.generate') : t('message.swipe.next')}
              >
                {currentIndex === totalAlternatives - 1 ? (
                  <RefreshCw className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {!isCompact && !isEditing && (
          <div className={cn(
            'flex gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity',
            isUser ? 'justify-end' : 'justify-start'
          )}>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleCopy}
            >
              {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
            {!isUser && (
              <>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7"
                  onClick={() => setShowPromptDialog(true)}
                  title={t('message.viewPrompt')}
                >
                  <Eye className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleStartEdit}
                  title={t('message.edit')}
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleReplay}
                  title={t('message.replay')}
                >
                  <Play className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={onSpeak}
                >
                  <Volume2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={onRegenerate}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
      {/* Prompt Viewer Dialog for bubble mode */}
      <PromptViewerDialog
        open={showPromptDialog}
        onOpenChange={setShowPromptDialog}
        sections={message.metadata?.promptData || []}
      />
    </div>
  );
});
