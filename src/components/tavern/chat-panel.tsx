'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTavernStore } from '@/store/tavern-store';
import { BackgroundWithOverlays } from './background-layer';
import { NovelChatBox } from './novel-chat-box';
import { CharacterSprite } from './character-sprite';
import { useSoundTriggers } from '@/hooks/use-sound-triggers';
import { useBackgroundTriggers } from '@/hooks/use-background-triggers';
import { Sparkles } from 'lucide-react';
import type { CharacterCard } from '@/types';

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

  const handleSend = useCallback(async (userMessage: string) => {
    if (!userMessage.trim() || isGenerating || !activeSessionId) return;
    
    // For group mode, we don't need activeCharacter
    if (!isGroupMode && !activeCharacter) return;

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

      // Handle group chat
      if (isGroupMode && activeGroup) {
        // Get group characters
        const groupCharacterIds = activeGroup.members?.map(m => m.characterId) || activeGroup.characterIds || [];
        const groupCharacters = characters.filter(c => groupCharacterIds.includes(c.id));
        
        if (groupCharacters.length === 0) {
          throw new Error('No characters in this group. Add characters to the group first.');
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
            persona: activePersona
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to start group streaming');
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';
        let currentCharacterContent = '';
        let currentCharacter: CharacterCard | null = null;

        try {
          while (true) {
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
                  if (parsed.fullContent && activeSessionId) {
                    addMessage(activeSessionId, {
                      characterId: parsed.characterId,
                      role: 'assistant',
                      content: parsed.fullContent,
                      isDeleted: false,
                      swipeId: crypto.randomUUID(),
                      swipeIndex: 0
                    });
                  }
                  setStreamingContent('');
                  setStreamingCharacter(null);
                } else if (parsed.type === 'character_error') {
                  console.error(`Character ${parsed.characterName} error:`, parsed.error);
                  if (activeSessionId) {
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
                console.warn('Failed to parse SSE data:', data);
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
        let buffer = '';

        try {
          while (true) {
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
                if (parseError instanceof Error && !parseError.message.includes('JSON')) {
                  throw parseError;
                }
                console.warn('Failed to parse SSE data:', data);
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
            persona: activePersona
          })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to generate response');
        }

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
      addMessage(activeSessionId, {
        characterId: activeCharacter?.id || 'system',
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
  }, [isGenerating, activeSessionId, activeCharacter, activePersona, isGroupMode, activeGroup, characters, addMessage, setGenerating, resetSoundDetection, scanSoundTriggers, resetBgDetection, scanForBackgroundTriggers, activeGroupId]);

  const handleResetChat = () => {
    if (!activeSessionId || !activeCharacter) return;
    
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
      
      updateSession(activeSessionId, { 
        messages: [firstMessage],
        updatedAt: new Date().toISOString()
      });
    }
  };

  const handleClearChat = () => {
    if (activeSessionId && confirm('Are you sure you want to clear all messages?')) {
      updateSession(activeSessionId, { messages: [] });
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
          <h2 className="text-2xl font-bold">Welcome to TavernFlow</h2>
          <p className="text-muted-foreground max-w-md">
            Select a character from the sidebar to start chatting, or create a new character to begin your adventure.
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

      {/* Character Sprite Area - Draggable and Resizable */}
      {settings.chatLayout.showCharacterSprite && activeCharacter?.avatar && (
        <CharacterSprite
          characterId={activeCharacter.id}
          characterName={activeCharacter.name}
          avatarUrl={activeCharacter.avatar}
        />
      )}

      {/* Floating Chat Box */}
      <NovelChatBox 
        onSendMessage={(msg) => handleSend(msg)}
        isGenerating={isGenerating}
        onResetChat={handleResetChat}
        onClearChat={handleClearChat}
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
