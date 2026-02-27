'use client';

import { memo, useMemo } from 'react';
import { cn } from '@/lib/utils';

interface TextFormatterProps {
  content: string;
  className?: string;
  isUser?: boolean;
}

/**
 * Formats text in SillyTavern style:
 * - *text* or _text_ = italic (actions/narration)
 * - "text" = dialogue (different color)
 * - **text** = bold
 * - ***text*** = bold italic
 * - `text` = code
 * - Emojis are rendered naturally
 */
export const TextFormatter = memo(function TextFormatter({ 
  content, 
  className,
  isUser = false 
}: TextFormatterProps) {
  const formattedContent = useMemo(() => {
    return parseSillyTavernFormat(content, isUser);
  }, [content, isUser]);

  return (
    <div className={cn('whitespace-pre-wrap break-words', className)}>
      {formattedContent}
    </div>
  );
});

function parseSillyTavernFormat(text: string, isUser: boolean): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  let key = 0;
  
  // Combined regex for all patterns
  const patterns = [
    // Bold italic ***text***
    { regex: /\*\*\*(.+?)\*\*\*/g, type: 'bold-italic' },
    // Bold **text**
    { regex: /\*\*(.+?)\*\*/g, type: 'bold' },
    // Italic *text* or _text_
    { regex: /(?:\*|_)(.+?)(?:\*|_)/g, type: 'italic' },
    // Dialogue "text" - with smart quotes support
    { regex: /["«]([^"»]+)["»]/g, type: 'dialogue' },
    // Code `text`
    { regex: /`([^`]+)`/g, type: 'code' },
  ];
  
  // Create a combined pattern that captures all
  const combinedRegex = /(\*\*\*.+?\*\*\*)|(\*\*.+?\*\*)|(\*.+?\*)|(_.+?_)|(["«][^"»]+["»])|(`[^`]+`)/g;
  
  let lastIndex = 0;
  let match;
  
  // Reset regex
  combinedRegex.lastIndex = 0;
  
  while ((match = combinedRegex.exec(text)) !== null) {
    // Add text before this match
    if (match.index > lastIndex) {
      elements.push(
        <span key={key++}>{text.slice(lastIndex, match.index)}</span>
      );
    }
    
    const matchedText = match[0];
    
    // Determine type and extract content
    if (match[1]) {
      // Bold italic ***text***
      elements.push(
        <strong key={key++} className="italic font-bold">
          {matchedText.slice(3, -3)}
        </strong>
      );
    } else if (match[2]) {
      // Bold **text**
      elements.push(
        <strong key={key++} className="font-bold">
          {matchedText.slice(2, -2)}
        </strong>
      );
    } else if (match[3] || match[4]) {
      // Italic *text* or _text_
      elements.push(
        <em key={key++} className="italic text-emerald-600 dark:text-emerald-400">
          {matchedText.slice(1, -1)}
        </em>
      );
    } else if (match[5]) {
      // Dialogue "text"
      const dialogueText = matchedText.slice(1, -1);
      elements.push(
        <span key={key++} className={cn(
          "font-medium",
          isUser 
            ? "text-yellow-200" 
            : "text-amber-600 dark:text-amber-400"
        )}>
          "{dialogueText}"
        </span>
      );
    } else if (match[6]) {
      // Code `text`
      elements.push(
        <code key={key++} className="px-1.5 py-0.5 rounded bg-muted font-mono text-sm">
          {matchedText.slice(1, -1)}
        </code>
      );
    }
    
    lastIndex = match.index + matchedText.length;
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    elements.push(
      <span key={key++}>{text.slice(lastIndex)}</span>
    );
  }
  
  return elements.length > 0 ? elements : [<span key={0}>{text}</span>];
}

/**
 * Alternative parser using a state machine approach for more complex formatting
 */
export function parseMessageContent(content: string, isUser: boolean = false): React.ReactNode {
  // Handle multiline content
  const lines = content.split('\n');
  
  return lines.map((line, index) => (
    <span key={index}>
      <TextFormatter content={line} isUser={isUser} />
      {index < lines.length - 1 && <br />}
    </span>
  ));
}
