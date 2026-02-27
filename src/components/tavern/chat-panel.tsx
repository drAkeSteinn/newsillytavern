'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTavernStore } from '@/store/tavern-store';
import { ChatMessageBubble } from './chat-message';
import { NovelChatBox } from './novel-chat-box';
import { BackgroundWithOverlays } from './background-layer';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { EmojiPicker } from './emoji-picker';
import { StreamingText } from './streaming-text';
import { useSoundTriggers } from '@/hooks/use-sound-triggers';
import { useBackgroundTriggers } from '@/hooks/use-background-triggers';
import { 
  Send, 
  Loader2, 
  Settings, 
  Image as ImageIcon, 
  Users, 
  ChevronDown,
  Sparkles,
  MessageSquare,
  RotateCcw,
  Eraser,
  User,
  Check
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export function ChatPanel() {
  const [input, setInput] = useState('');
  const [streamingContent, setStreamingContent] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Use proper selectors to subscribe to store changes
  const activeSessionId = useTavernStore((state) => state.activeSessionId);
  const activeCharacterId = useTavernStore((state) => state.activeCharacterId);
  const sessions = useTavernStore((state) => state.sessions);
  const characters = useTavernStore((state) => state.characters);
  const settings = useTavernStore((state) => state.settings);
  const isGenerating = useTavernStore((state) => state.isGenerating);
  const activeBackground = useTavernStore((state) => state.activeBackground);
  const activeOverlayBack = useTavernStore((state) => state.activeOverlayBack);
  const activeOverlayFront = useTavernStore((state) => state.activeOverlayFront);
  const personas = useTavernStore((state) => state.personas);
  const activePersonaId = useTavernStore((state) => state.activePersonaId);
  
  const setGenerating = useTavernStore((state) => state.setGenerating);
  const addMessage = useTavernStore((state) => state.addMessage);
  const deleteMessage = useTavernStore((state) => state.deleteMessage);
  const updateSettings = useTavernStore((state) => state.updateSettings);
  const updateSession = useTavernStore((state) => state.updateSession);
  const setActivePersona = useTavernStore((state) => state.setActivePersona);

  // Get derived values from subscribed state
  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const activeCharacter = characters.find((c) => c.id === activeCharacterId);
  const activePersona = personas.find((p) => p.id === activePersonaId);
  const isNovelMode = settings.chatLayout.novelMode;

  // Sound triggers hook
  const { scanStreamingContent: scanSoundTriggers, resetDetection: resetSoundDetection } = useSoundTriggers();
  
  // Background triggers hook
  const { scanForBackgroundTriggers, resetDetection: resetBgDetection } = useBackgroundTriggers();
  
  // Track current streaming message key for triggers
  const streamingMessageKeyRef = useRef<string>('');

  // Auto-scroll to bottom when new messages arrive or during streaming
  useEffect(() => {
    if (settings.autoScroll && messagesEndRef.current && !isNovelMode) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeSession?.messages, settings.autoScroll, isNovelMode, isGenerating, streamingContent]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSend = useCallback(async (userMessage?: string) => {
    const messageToSend = userMessage || input.trim();
    if (!messageToSend || isGenerating || !activeSessionId || !activeCharacter) return;

    if (!userMessage) {
      setInput('');
    }
    setGenerating(true);
    setStreamingContent('');
    
    // Generate a unique message key for this streaming session
    const messageKey = `stream_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    streamingMessageKeyRef.current = messageKey;
    resetSoundDetection(messageKey); // Reset sound trigger detection for new message
    resetBgDetection(messageKey); // Reset background trigger detection for new message

    // Add user message
    addMessage(activeSessionId, {
      characterId: activeCharacter.id,
      role: 'user',
      content: messageToSend,
      isDeleted: false,
      swipeId: crypto.randomUUID(),
      swipeIndex: 0
    });

    try {
      // Get the active LLM config
      const { llmConfigs } = useTavernStore.getState();
      const activeLLMConfig = llmConfigs.find(c => c.isActive);
      
      if (!activeLLMConfig) {
        throw new Error('No active LLM configuration. Please configure an LLM connection in settings.');
      }

      // Get current session messages (before adding the user message, since we just added it)
      const currentSession = useTavernStore.getState().sessions.find(s => s.id === activeSessionId);
      const currentMessages = currentSession?.messages || [];

      // Check if streaming is enabled
      const useStreaming = activeLLMConfig.parameters.stream;

      if (useStreaming) {
        // Use streaming endpoint
        const response = await fetch('/api/chat/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: messageToSend,
            sessionId: activeSessionId,
            characterId: activeCharacter.id,
            character: activeCharacter,
            messages: currentMessages.filter((m: { isDeleted: boolean }) => !m.isDeleted),
            llmConfig: activeLLMConfig,
            userName: activePersona?.name || 'User',
            persona: activePersona
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to start streaming');
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let accumulatedContent = '';
        let buffer = ''; // Buffer for incomplete lines

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // Add new data to buffer
            buffer += decoder.decode(value, { stream: true });
            
            // Split by double newline (SSE message separator)
            const messages = buffer.split('\n\n');
            
            // Keep the last incomplete message in buffer
            buffer = messages.pop() || '';

            for (const message of messages) {
              // Look for data: prefix
              const dataMatch = message.match(/^data: (.+)$/s);
              if (!dataMatch) continue;
              
              const data = dataMatch[1];
              
              try {
                const parsed = JSON.parse(data);
                
                if (parsed.type === 'token' && parsed.content) {
                  accumulatedContent += parsed.content;
                  setStreamingContent(accumulatedContent);
                  // Scan for sound triggers during streaming with message key
                  scanSoundTriggers(accumulatedContent, streamingMessageKeyRef.current);
                  // Scan for background triggers during streaming
                  scanForBackgroundTriggers(accumulatedContent, streamingMessageKeyRef.current);
                } else if (parsed.type === 'error') {
                  throw new Error(parsed.error);
                } else if (parsed.type === 'done') {
                  // Finalize the message
                  let cleanedMessage = accumulatedContent.trim();
                  
                  // Remove character name prefix if present
                  const namePrefix = `${activeCharacter.name}:`;
                  if (cleanedMessage.startsWith(namePrefix)) {
                    cleanedMessage = cleanedMessage.slice(namePrefix.length).trim();
                  }
                  
                  // Only add if there's content
                  if (cleanedMessage) {
                    addMessage(activeSessionId, {
                      characterId: activeCharacter.id,
                      role: 'assistant',
                      content: cleanedMessage,
                      isDeleted: false,
                      swipeId: crypto.randomUUID(),
                      swipeIndex: 0
                    });
                  }
                  setStreamingContent('');
                }
              } catch (parseError) {
                // If it's our thrown error, re-throw it
                if (parseError instanceof Error && !parseError.message.includes('JSON')) {
                  throw parseError;
                }
                // Skip invalid JSON but log it
                console.warn('Failed to parse SSE data:', data);
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      } else {
        // Use non-streaming endpoint
        const response = await fetch('/api/chat/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: messageToSend,
            sessionId: activeSessionId,
            characterId: activeCharacter.id,
            character: activeCharacter,
            messages: currentMessages.filter((m: { isDeleted: boolean }) => !m.isDeleted),
            llmConfig: activeLLMConfig,
            userName: activePersona?.name || 'User',
            persona: activePersona
          })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to generate response');
        }

        // Add assistant message
        addMessage(activeSessionId, {
          characterId: activeCharacter.id,
          role: 'assistant',
          content: data.message,
          isDeleted: false,
          swipeId: crypto.randomUUID(),
          swipeIndex: 0,
          metadata: {
            tokens: data.usage?.totalTokens,
            model: data.model
          }
        });
      }
    } catch (error) {
      console.error('Generation error:', error);
      // Add error message
      addMessage(activeSessionId, {
        characterId: activeCharacter.id,
        role: 'system',
        content: `⚠️ ${error instanceof Error ? error.message : 'Failed to generate response. Please check your LLM configuration.'}`,
        isDeleted: false,
        swipeId: crypto.randomUUID(),
        swipeIndex: 0
      });
    } finally {
      setGenerating(false);
      setStreamingContent('');
    }
  }, [input, isGenerating, activeSessionId, activeCharacter, activePersona, addMessage, setGenerating, resetSoundDetection, scanSoundTriggers, resetBgDetection, scanForBackgroundTriggers]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickReply = (reply: string) => {
    setInput(reply);
    textareaRef.current?.focus();
  };

  const handleClearChat = () => {
    if (activeSessionId && confirm('Are you sure you want to clear all messages?')) {
      useTavernStore.getState().updateSession(activeSessionId, { messages: [] });
    }
  };

  const handleResetChat = () => {
    if (!activeSessionId || !activeCharacter) return;
    
    const options = [
      { label: 'Clear all messages', value: 'clear' },
      { label: 'Reset to first message', value: 'reset' }
    ];
    
    // Simple reset - restore first message
    if (confirm('Reset chat to the first message from the character?')) {
      const firstMessage = {
        id: crypto.randomUUID(),
        characterId: activeCharacter.id,
        role: 'assistant' as const,
        content: activeCharacter.firstMes || `*${activeCharacter.name} looks at you expectantly, waiting for you to speak.*`,
        timestamp: new Date().toISOString(),
        isDeleted: false,
        swipeId: crypto.randomUUID(),
        swipeIndex: 0
      };
      
      useTavernStore.getState().updateSession(activeSessionId, { 
        messages: [firstMessage],
        updatedAt: new Date().toISOString()
      });
    }
  };

  const handleInsertEmoji = (emoji: string) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newInput = input.slice(0, start) + emoji + input.slice(end);
      setInput(newInput);
      
      // Move cursor after emoji
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
        textarea.focus();
      }, 0);
    } else {
      setInput(prev => prev + emoji);
    }
  };

  const toggleNovelMode = () => {
    updateSettings({
      chatLayout: {
        ...settings.chatLayout,
        novelMode: !isNovelMode
      }
    });
  };

  if (!activeSession) {
    return (
      <div className="flex-1 flex items-center justify-center relative">
        <BackgroundWithOverlays 
          background={activeBackground} 
          overlayBack={activeOverlayBack}
          overlayFront={activeOverlayFront}
          fit={settings.backgroundFit} 
          overlay 
          blur 
          transitionDuration={settings.backgroundTriggers?.transitionDuration || 500}
        />
        <div className="relative z-10 text-center space-y-4 p-8">
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold">Welcome to TavernFlow</h2>
          <p className="text-muted-foreground max-w-md">
            Select a character from the sidebar to start chatting, or create a new character to begin your adventure.
          </p>
        </div>
      </div>
    );
  }

  // Novel Mode - Background with floating chat box
  if (isNovelMode) {
    return (
      <div className="flex-1 h-full relative">
        <BackgroundWithOverlays 
          background={activeBackground} 
          overlayBack={activeOverlayBack}
          overlayFront={activeOverlayFront}
          fit={settings.backgroundFit}
          overlay={!!activeBackground && settings.chatLayout.blurBackground}
          transitionDuration={settings.backgroundTriggers?.transitionDuration || 500}
        />

        {/* Character Sprite Area (placeholder for future sprite support) */}
        {settings.chatLayout.showCharacterSprite && activeCharacter?.avatar && (
          <div className="absolute bottom-0 left-0 right-0 h-2/3 flex items-end justify-center pointer-events-none">
            <img 
              src={activeCharacter.avatar}
              alt={activeCharacter.name}
              className="max-h-full max-w-[40%] object-contain drop-shadow-2xl opacity-90"
            />
          </div>
        )}

        {/* Novel Mode Toggle Button */}
        <div className="absolute top-4 right-4 z-30 flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="gap-2 bg-background/80 backdrop-blur-sm"
            onClick={toggleNovelMode}
          >
            <MessageSquare className="w-4 h-4" />
            Normal Mode
          </Button>
        </div>

        {/* Floating Chat Box */}
        <NovelChatBox 
          onSendMessage={(msg) => handleSend(msg)}
          isGenerating={isGenerating}
          onResetChat={handleResetChat}
          onClearChat={handleClearChat}
          streamingContent={streamingContent}
        />
      </div>
    );
  }

  // Normal Mode - Full screen chat
  return (
    <div className="flex-1 flex flex-col h-full relative overflow-hidden">
      <BackgroundWithOverlays 
        background={activeBackground} 
        overlayBack={activeOverlayBack}
        overlayFront={activeOverlayFront}
        fit={settings.backgroundFit} 
        overlay 
        blur 
        transitionDuration={settings.backgroundTriggers?.transitionDuration || 500}
      />

      {/* Chat Header */}
      <div className="relative z-20 border-b bg-background/95 backdrop-blur-sm px-4 py-2 flex-shrink-0">
        <div className="flex items-center justify-between gap-4">
          {/* Character Info */}
          <div className="flex items-center gap-3 min-w-0">
            {activeCharacter?.avatar && (
              <img 
                src={activeCharacter.avatar} 
                alt={activeCharacter.name}
                className="w-10 h-10 rounded-full object-cover border-2 border-amber-500"
              />
            )}
            <div className="min-w-0">
              <h2 className="font-semibold truncate">{activeCharacter?.name || 'Unknown'}</h2>
              <p className="text-xs text-muted-foreground">
                {activeSession.messages.length} messages
              </p>
            </div>
          </div>

          {/* Actions Row */}
          <div className="flex items-center gap-2">
            {/* Persona Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">
                  <User className="w-4 h-4" />
                  <span className="hidden md:inline max-w-[80px] truncate">{activePersona?.name || 'User'}</span>
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <div className="px-2 py-1.5 text-xs text-muted-foreground">Select Persona</div>
                {personas.map((persona) => (
                  <DropdownMenuItem
                    key={persona.id}
                    onClick={() => setActivePersona(persona.id)}
                    className="flex items-center gap-2"
                  >
                    <div className="w-4 h-4 flex items-center justify-center">
                      {persona.id === activePersonaId && (
                        <Check className="w-3 h-3" />
                      )}
                    </div>
                    <span className={persona.id === activePersonaId ? 'font-medium' : ''}>
                      {persona.name}
                    </span>
                    {persona.id === 'default' && (
                      <span className="text-xs text-muted-foreground ml-auto">Default</span>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* More Actions */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Settings className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleResetChat}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset Chat
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleClearChat} className="text-destructive">
                  <Eraser className="w-4 h-4 mr-2" />
                  Clear All Messages
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <ImageIcon className="w-4 h-4 mr-2" />
                  Change Background
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Users className="w-4 h-4 mr-2" />
                  Add to Group
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 relative z-10 flex-shrink" ref={scrollRef}>
        <div className="max-w-4xl mx-auto py-4">
          {activeSession.messages.filter(m => !m.isDeleted).map((message) => (
            <ChatMessageBubble
              key={message.id}
              message={message}
              characterName={activeCharacter?.name}
              characterAvatar={activeCharacter?.avatar}
              showTimestamp={settings.showTimestamps}
              onDelete={() => deleteMessage(activeSessionId!, message.id)}
            />
          ))}

          {/* Streaming Message or Typing Indicator */}
          {isGenerating && (
            <div className="flex gap-3 py-4 px-4">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                {activeCharacter?.avatar ? (
                  <img 
                    src={activeCharacter.avatar} 
                    alt="" 
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-amber-500" />
                )}
              </div>
              <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 max-w-[80%]">
                {streamingContent ? (
                  <StreamingText 
                    content={streamingContent} 
                    isStreaming={true}
                  />
                ) : (
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Auto-scroll anchor */}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Quick Replies */}
      {settings.quickReplies.length > 0 && (
        <div className="relative z-10 px-4 py-2 border-t bg-background/95 backdrop-blur-sm flex-shrink-0">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {settings.quickReplies.map((reply, index) => (
              <Button
                key={index}
                variant="secondary"
                size="sm"
                className="flex-shrink-0 bg-muted/80 hover:bg-muted"
                onClick={() => handleQuickReply(reply)}
              >
                {reply}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="relative z-10 border-t bg-background/95 backdrop-blur-sm p-4 flex-shrink-0">
        <div className="max-w-4xl mx-auto flex gap-3 items-end">
          {/* Emoji Picker */}
          <EmojiPicker onEmojiSelect={(emoji) => setInput(prev => prev + emoji)} />
          
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${activeCharacter?.name || '...'}...`}
              className="min-h-[44px] max-h-[200px] resize-none"
              disabled={isGenerating}
            />
          </div>
          <Button
            size="icon"
            className="h-11 w-11 flex-shrink-0"
            onClick={() => handleSend()}
            disabled={!input.trim() || isGenerating}
          >
            {isGenerating ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
