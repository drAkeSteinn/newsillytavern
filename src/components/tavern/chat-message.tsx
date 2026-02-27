'use client';

import { cn } from '@/lib/utils';
import type { ChatMessage as ChatMessageType } from '@/types';
import { User, Bot, Copy, Check, Trash2, RefreshCw, ChevronLeft, ChevronRight, Volume2 } from 'lucide-react';
import { useState, memo } from 'react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { TextFormatter } from './text-formatter';

interface ChatMessageProps {
  message: ChatMessageType;
  characterName?: string;
  characterAvatar?: string;
  userName?: string;
  userAvatar?: string;
  showTimestamp?: boolean;
  onSwipe?: (direction: 'left' | 'right') => void;
  onDelete?: () => void;
  onRegenerate?: () => void;
  onSpeak?: () => void;
  hasAlternatives?: boolean;
  currentIndex?: number;
  totalAlternatives?: number;
  compact?: boolean;
}

export const ChatMessageBubble = memo(function ChatMessageBubble({
  message,
  characterName = 'Assistant',
  characterAvatar,
  userName = 'You',
  userAvatar,
  showTimestamp = true,
  onSwipe,
  onDelete,
  onRegenerate,
  onSpeak,
  hasAlternatives = false,
  currentIndex = 0,
  totalAlternatives = 1,
  compact = false
}: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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

  return (
    <div
      className={cn(
        'group flex gap-2 animate-in fade-in-0 slide-in-from-bottom-2 duration-300',
        compact ? 'py-2 px-1' : 'py-4 px-4',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* Avatar */}
      <div className="flex-shrink-0">
        <div className={cn(
          'rounded-full overflow-hidden border-2 flex items-center justify-center',
          compact ? 'w-8 h-8' : 'w-10 h-10',
          isUser ? 'border-primary' : 'border-amber-500'
        )}>
          {isUser ? (
            userAvatar ? (
              <img src={userAvatar} alt={userName} className="w-full h-full object-cover" />
            ) : (
              <User className={cn('text-primary', compact ? 'w-4 h-4' : 'w-5 h-5')} />
            )
          ) : (
            characterAvatar ? (
              <img src={characterAvatar} alt={characterName} className="w-full h-full object-cover" />
            ) : (
              <Bot className={cn('text-amber-500', compact ? 'w-4 h-4' : 'w-5 h-5')} />
            )
          )}
        </div>
      </div>

      {/* Message Content */}
      <div className={cn(
        'flex-1 max-w-[80%]',
        isUser ? 'items-end' : 'items-start'
      )}>
        {/* Name and Timestamp */}
        {!compact && (
          <div className={cn(
            'flex items-center gap-2 mb-1',
            isUser ? 'flex-row-reverse' : 'flex-row'
          )}>
            <span className="font-medium text-sm">
              {isUser ? userName : characterName}
            </span>
            {showTimestamp && (
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })}
              </span>
            )}
          </div>
        )}

        {/* Message Bubble */}
        <div className={cn(
          'rounded-2xl relative group/message',
          compact ? 'px-3 py-2' : 'px-4 py-3',
          isUser 
            ? 'bg-primary text-primary-foreground rounded-tr-sm' 
            : 'bg-muted rounded-tl-sm'
        )}>
          <TextFormatter 
            content={message.content} 
            isUser={isUser}
            className={cn(
              'text-sm leading-relaxed',
              compact && 'text-xs'
            )}
          />

          {/* Swipe Indicators */}
          {!isUser && hasAlternatives && !compact && (
            <div className="absolute -left-8 top-1/2 -translate-y-1/2 flex flex-col gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => onSwipe?.('left')}
                disabled={currentIndex === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-center text-muted-foreground">
                {currentIndex + 1}/{totalAlternatives}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => onSwipe?.('right')}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {!compact && (
          <div className={cn(
            'flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity',
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
    </div>
  );
});
