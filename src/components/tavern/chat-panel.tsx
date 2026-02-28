'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTavernStore } from '@/store/tavern-store';
import { BackgroundWithOverlays } from './background-layer';
import { NovelChatBox } from './novel-chat-box';
import { CharacterSprite } from './character-sprite';
import { useSoundTriggers } from '@/hooks/use-sound-triggers';
import { useBackgroundTriggers } from '@/hooks/use-background-triggers';
import { GroupSprites } from './group-sprites';
import { Sparkles } from 'lucide-react';
import type { CharacterCard } from '@/types';
import { t } from '@/lib/i18n';
import { chatLogger } from '@/lib/logger';

export function ChatPanel() {
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingCharacter, setStreamingCharacter] = useState<CharacterCard | null>(null);
  const [streamingProgress, setStreamingProgress] = useState<{ current: number; total: number } | null>(null);

  // Use proper selectors to subscribe to store changes
  const activeSessionId = useTavernStore((state) => state.activeSessionId);
  const activeCharacterId = useTavernStore((state) => state.activeCharacterId);
  const activeGroupId = useTavernStore((state) => state.activeGroupId);
  const sessions = useTavernStore((state) => state.sessions);
  const characters = useTavernStore((state) => state.characters);
  const groups = useTavernStore((state) => state.groups);
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
  const updateSession = useTavernStore((state) => state.updateSession);
  const addSwipeAlternative = useTavernStore((state) => state.addSwipeAlternative);

  // Ref to track ongoing generation and prevent race conditions
  const generationIdRef = useRef<string | null>(null);
  const isGenerationInProgressRef = useRef(false);
  
  // Get derived values from subscribed state
  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const activeCharacter = characters.find((c) => c.id === activeCharacterId);
  const activeGroup = groups.find((g) => g.id === activeGroupId);
  const activePersona = personas.find((p) => p.id === activePersonaId);
  
  // Determine if we're in group mode
  const isGroupMode = !!activeGroupId && !!activeGroup;

  // Sound triggers hook
  const { scanStreamingContent: scanSoundTriggers, resetDetection: resetSoundDetection } = useSoundTriggers();
  
  // Background triggers hook
  const { scanForBackgroundTriggers, resetDetection: resetBgDetection } = useBackgroundTriggers();
  
  // Track current streaming message key for triggers
  const streamingMessageKeyRef = useRef<string>('');

  // Sync ref with store state
  useEffect(() => {
    if (!isGenerating && isGenerationInProgressRef.current) {
      // Store says not generating but we think we are - cleanup
      isGenerationInProgressRef.current = false;
      generationIdRef.current = null;
    }
  }, [isGenerating]);

  const handleSend = useCallback(async (userMessage: string) => {
    // Double-check using both state and ref to prevent race conditions
    if (!userMessage.trim()) return;
    if (isGenerating || isGenerationInProgressRef.current) return;
    if (!activeSessionId) return;
    
    // For group mode, we don't need activeCharacter
    if (!isGroupMode && !activeCharacter) return;

    // Generate a unique ID for this generation
    const generationId = `gen_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    generationIdRef.current = generationId;
    isGenerationInProgressRef.current = true;

    setGenerating(true);
    setStreamingContent('');
    setStreamingCharacter(null);
    setStreamingProgress(null);
    
    // Generate a unique message key for this streaming session
    const messageKey = `stream_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    streamingMessageKeyRef.current = messageKey;
    resetSoundDetection(messageKey);
    resetBgDetection(messageKey);

    // Add user message
    addMessage(activeSessionId, {
      characterId: activeCharacter?.id || 'user',
      role: 'user',
      content: userMessage.trim(),
      isDeleted: false,
      swipeId: crypto.randomUUID(),
      swipeIndex: 0
    });

    // Helper to check if this generation is still the active one
    const isStillActive = () => generationIdRef.current === generationId;

    try {
      // Get the active LLM config
      const { llmConfigs } = useTavernStore.getState();
      const activeLLMConfig = llmConfigs.find(c => c.isActive);
      
      if (!activeLLMConfig) {
        throw new Error(t('chat.noLLM'));
      }

      // Get current session messages (before adding the user message, since we just added it)
      const currentSession = useTavernStore.getState().sessions.find(s => s.id === activeSessionId);
      const currentMessages = currentSession?.messages || [];

      // Check if streaming is enabled
      const useStreaming = activeLLMConfig.parameters.stream;
      
      // Get context settings from store
      const contextConfig = settings.context;

      // Handle group chat
      if (isGroupMode && activeGroup) {
        // Get group characters
        const groupCharacterIds = activeGroup.members?.map(m => m.characterId) || activeGroup.characterIds || [];
        const groupCharacters = characters.filter(c => groupCharacterIds.includes(c.id));
        
        if (groupCharacters.length === 0) {
          throw new Error(t('chat.noGroupCharacters'));
        }

        // Use group streaming endpoint
        const response = await fetch('/api/chat/group-stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userMessage.trim(),
            sessionId: activeSessionId,
            groupId: activeGroupId,
            group: activeGroup,
            characters: groupCharacters,
            messages: currentMessages.filter((m: { isDeleted: boolean }) => !m.isDeleted),
            llmConfig: activeLLMConfig,
            userName: activePersona?.name || 'User',
            persona: activePersona,
            contextConfig
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || t('chat.error.streaming'));
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';
        let currentCharacterContent = '';
        let currentCharacter: CharacterCard | null = null;

        try {
          while (true) {
            // Check if generation was cancelled
            if (!isStillActive()) {
              reader.cancel();
              break;
            }
            
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const messages = buffer.split('\n\n');
            buffer = messages.pop() || '';

            for (const message of messages) {
              const dataMatch = message.match(/^data: (.+)$/s);
              if (!dataMatch) continue;
              
              const data = dataMatch[1];
              
              try {
                const parsed = JSON.parse(data);
                
                if (parsed.type === 'character_start') {
                  currentCharacterContent = '';
                  const char = groupCharacters.find(c => c.id === parsed.characterId);
                  currentCharacter = char || null;
                  setStreamingCharacter(currentCharacter);
                  setStreamingProgress({
                    current: parsed.responseIndex,
                    total: parsed.totalResponses
                  });
                  setStreamingContent('');
                } else if (parsed.type === 'token' && parsed.content) {
                  currentCharacterContent += parsed.content;
                  setStreamingContent(currentCharacterContent);
                  scanSoundTriggers(currentCharacterContent, streamingMessageKeyRef.current);
                  scanForBackgroundTriggers(currentCharacterContent, streamingMessageKeyRef.current);
                } else if (parsed.type === 'character_done') {
                  if (parsed.fullContent && activeSessionId && isStillActive()) {
                    addMessage(activeSessionId, {
                      characterId: parsed.characterId,
                      role: 'assistant',
                      content: parsed.fullContent,
                      isDeleted: false,
                      swipeId: crypto.randomUUID(),
                      swipeIndex: 0,
                      metadata: {
                        promptData: parsed.promptSections || []
                      }
                    });
                  }
                  setStreamingContent('');
                  setStreamingCharacter(null);
                } else if (parsed.type === 'character_error') {
                  chatLogger.error(`Character ${parsed.characterName} error`, { error: parsed.error });
                  if (activeSessionId && isStillActive()) {
                    addMessage(activeSessionId, {
                      characterId: parsed.characterId,
                      role: 'system',
                      content: `⚠️ ${parsed.characterName}: ${parsed.error}`,
                      isDeleted: false,
                      swipeId: crypto.randomUUID(),
                      swipeIndex: 0
                    });
                  }
                } else if (parsed.type === 'error') {
                  throw new Error(parsed.error);
                }
              } catch (parseError) {
                if (parseError instanceof Error && !parseError.message.includes('JSON')) {
                  throw parseError;
                }
                chatLogger.debug('Failed to parse SSE data (group)', { data });
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
        
        setStreamingProgress(null);
        return;
      }

      // Single character chat
      if (!activeCharacter) return;

      if (useStreaming) {
        const response = await fetch('/api/chat/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userMessage.trim(),
            sessionId: activeSessionId,
            characterId: activeCharacter.id,
            character: activeCharacter,
            messages: currentMessages.filter((m: { isDeleted: boolean }) => !m.isDeleted),
            llmConfig: activeLLMConfig,
            userName: activePersona?.name || 'User',
            persona: activePersona,
            contextConfig
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || t('chat.error.streaming'));
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let accumulatedContent = '';
        let buffer = '';
        let promptSections: { type: string; label: string; content: string; color: string }[] = [];

        try {
          while (true) {
            // Check if generation was cancelled
            if (!isStillActive()) {
              reader.cancel();
              break;
            }
            
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const messages = buffer.split('\n\n');
            buffer = messages.pop() || '';

            for (const message of messages) {
              const dataMatch = message.match(/^data: (.+)$/s);
              if (!dataMatch) continue;
              
              const data = dataMatch[1];
              
              try {
                const parsed = JSON.parse(data);
                
                if (parsed.type === 'prompt_data' && parsed.promptSections) {
                  // Capture prompt sections for metadata
                  promptSections = parsed.promptSections;
                } else if (parsed.type === 'token' && parsed.content) {
                  accumulatedContent += parsed.content;
                  setStreamingContent(accumulatedContent);
                  scanSoundTriggers(accumulatedContent, streamingMessageKeyRef.current);
                  scanForBackgroundTriggers(accumulatedContent, streamingMessageKeyRef.current);
                } else if (parsed.type === 'error') {
                  throw new Error(parsed.error);
                } else if (parsed.type === 'done') {
                  let cleanedMessage = accumulatedContent.trim();
                  
                  const namePrefix = `${activeCharacter.name}:`;
                  if (cleanedMessage.startsWith(namePrefix)) {
                    cleanedMessage = cleanedMessage.slice(namePrefix.length).trim();
                  }
                  
                  if (cleanedMessage && isStillActive()) {
                    addMessage(activeSessionId, {
                      characterId: activeCharacter.id,
                      role: 'assistant',
                      content: cleanedMessage,
                      isDeleted: false,
                      swipeId: crypto.randomUUID(),
                      swipeIndex: 0,
                      metadata: {
                        promptData: promptSections
                      }
                    });
                  }
                  setStreamingContent('');
                }
              } catch (parseError) {
                if (parseError instanceof Error && !parseError.message.includes('JSON')) {
                  throw parseError;
                }
                chatLogger.debug('Failed to parse SSE data (single)', { data });
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      } else {
        const response = await fetch('/api/chat/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userMessage.trim(),
            sessionId: activeSessionId,
            characterId: activeCharacter.id,
            character: activeCharacter,
            messages: currentMessages.filter((m: { isDeleted: boolean }) => !m.isDeleted),
            llmConfig: activeLLMConfig,
            userName: activePersona?.name || 'User',
            persona: activePersona,
            contextConfig
          })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || t('chat.error.generation'));
        }

        if (isStillActive()) {
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
      }
    } catch (error) {
      chatLogger.error('Generation error', { error });
      if (isStillActive() && activeSessionId) {
        addMessage(activeSessionId, {
          characterId: activeCharacter?.id || 'system',
          role: 'system',
          content: `⚠️ ${error instanceof Error ? error.message : t('chat.error.generation')}`,
          isDeleted: false,
          swipeId: crypto.randomUUID(),
          swipeIndex: 0
        });
      }
    } finally {
      // Only clear generation state if this is still the active generation
      if (isStillActive()) {
        setGenerating(false);
        setStreamingContent('');
        isGenerationInProgressRef.current = false;
        generationIdRef.current = null;
      }
    }
  }, [isGenerating, activeSessionId, activeCharacter, activePersona, isGroupMode, activeGroup, characters, addMessage, setGenerating, resetSoundDetection, scanSoundTriggers, resetBgDetection, scanForBackgroundTriggers, activeGroupId, settings.context]);

  // Handle regenerate - create a new swipe alternative for an existing message
  const handleRegenerate = useCallback(async (messageId: string) => {
    if (isGenerating || isGenerationInProgressRef.current || !activeSessionId) return;
    
    // Generate a unique ID for this regeneration
    const generationId = `regen_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    generationIdRef.current = generationId;
    isGenerationInProgressRef.current = true;

    setGenerating(true);
    setStreamingContent('');

    // Helper to check if this generation is still the active one
    const isStillActive = () => generationIdRef.current === generationId;

    try {
      // Get the active LLM config
      const { llmConfigs } = useTavernStore.getState();
      const activeLLMConfig = llmConfigs.find(c => c.isActive);
      
      if (!activeLLMConfig) {
        throw new Error(t('chat.error.noConfig'));
      }

      // Get current session messages
      const currentSession = useTavernStore.getState().sessions.find(s => s.id === activeSessionId);
      const currentMessages = currentSession?.messages || [];
      const contextConfig = settings.context;

      // Use regenerate endpoint
      const response = await fetch('/api/chat/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: activeSessionId,
          messageId,
          character: activeCharacter,
          messages: currentMessages.filter((m: { isDeleted: boolean }) => !m.isDeleted),
          llmConfig: activeLLMConfig,
          userName: activePersona?.name || 'User',
          persona: activePersona,
          contextConfig
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t('chat.error.regeneration'));
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let accumulatedContent = '';
      let buffer = '';

      try {
        while (true) {
          if (!isStillActive()) {
            reader.cancel();
            break;
          }
          
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const messages = buffer.split('\n\n');
          buffer = messages.pop() || '';

          for (const message of messages) {
            const dataMatch = message.match(/^data: (.+)$/s);
            if (!dataMatch) continue;
            
            const data = dataMatch[1];
            
            try {
              const parsed = JSON.parse(data);
              
              if (parsed.type === 'token' && parsed.content) {
                accumulatedContent += parsed.content;
                setStreamingContent(accumulatedContent);
              } else if (parsed.type === 'error') {
                throw new Error(parsed.error);
              } else if (parsed.type === 'done' && parsed.content && isStillActive()) {
                // Add the regenerated content as a new swipe alternative
                addSwipeAlternative(activeSessionId, messageId, parsed.content);
              }
            } catch (parseError) {
              if (parseError instanceof Error && !parseError.message.includes('JSON')) {
                throw parseError;
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      chatLogger.error('Regeneration error', { error });
    } finally {
      if (isStillActive()) {
        setGenerating(false);
        setStreamingContent('');
        isGenerationInProgressRef.current = false;
        generationIdRef.current = null;
      }
    }
  }, [isGenerating, activeSessionId, activeCharacter, activePersona, addSwipeAlternative, setGenerating, settings.context]);

  const handleResetChat = () => {
    if (!activeSessionId) return;
    
    // Group mode reset
    if (isGroupMode && activeGroup) {
      if (confirm(t('chat.resetConfirm'))) {
        updateSession(activeSessionId, { 
          messages: [],
          updatedAt: new Date().toISOString()
        });
      }
      return;
    }
    
    // Single character mode reset
    if (!activeCharacter) return;
    
    if (confirm(t('chat.resetFirstConfirm'))) {
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
      
      updateSession(activeSessionId, { 
        messages: [firstMessage],
        updatedAt: new Date().toISOString()
      });
    }
  };

  const handleClearChat = () => {
    if (!activeSessionId) return;
    
    if (confirm(t('chat.clearConfirm'))) {
      updateSession(activeSessionId, { 
        messages: [],
        updatedAt: new Date().toISOString()
      });
    }
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
          <h2 className="text-2xl font-bold">{t('chat.welcome.title')}</h2>
          <p className="text-muted-foreground max-w-md">
            {t('chat.welcome.subtitle')}
          </p>
        </div>
      </div>
    );
  }

  // Novel Mode - Always active
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

      {/* Character Sprite Area - Single Character Mode */}
      {!isGroupMode && settings.chatLayout.showCharacterSprite && activeCharacter?.avatar && (
        <CharacterSprite
          characterId={activeCharacter.id}
          characterName={activeCharacter.name}
          avatarUrl={activeCharacter.avatar}
          spriteConfig={activeCharacter.spriteConfig}
          isStreaming={isGenerating && !!streamingContent}
        />
      )}

      {/* Group Sprites - Multiple Characters */}
      {isGroupMode && settings.chatLayout.showCharacterSprite && activeGroup && (
        <GroupSprites
          characters={characters.filter(c => 
            (activeGroup.members?.map(m => m.characterId) || activeGroup.characterIds || []).includes(c.id)
          )}
          activeCharacterId={streamingCharacter?.id || null}
          isStreaming={isGenerating && !!streamingContent}
        />
      )}

      {/* Floating Chat Box */}
      <NovelChatBox 
        onSendMessage={(msg) => handleSend(msg)}
        isGenerating={isGenerating}
        onResetChat={handleResetChat}
        onClearChat={handleClearChat}
        onRegenerate={handleRegenerate}
        streamingContent={streamingContent}
        streamingCharacter={streamingCharacter}
        streamingProgress={streamingProgress}
        isGroupMode={isGroupMode}
        activeGroup={activeGroup}
        activeCharacter={activeCharacter}
        characters={characters}
        activePersona={activePersona}
      />
    </div>
  );
}
