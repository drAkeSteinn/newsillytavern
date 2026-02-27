'use client';

import { useEffect, useCallback } from 'react';

interface HotkeyConfig {
  send: string;
  newLine: string;
  regenerate: string;
  swipeLeft: string;
  swipeRight: string;
}

interface HotkeyActions {
  onSend?: () => void;
  onNewLine?: () => void;
  onRegenerate?: () => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

export function useHotkeys(hotkeys: HotkeyConfig, actions: HotkeyActions, enabled: boolean = true) {
  const parseHotkey = (hotkey: string) => {
    const parts = hotkey.toLowerCase().split('+');
    const key = parts.pop() || '';
    const modifiers = {
      ctrl: parts.includes('ctrl'),
      shift: parts.includes('shift'),
      alt: parts.includes('alt'),
      meta: parts.includes('meta') || parts.includes('cmd'),
    };
    return { key, modifiers };
  };

  const matchesHotkey = useCallback((event: KeyboardEvent, hotkey: string) => {
    const { key, modifiers } = parseHotkey(hotkey);
    
    // Check if key matches
    const eventKey = event.key.toLowerCase();
    if (eventKey !== key) return false;
    
    // Check modifiers
    if (modifiers.ctrl !== (event.ctrlKey || event.metaKey)) return false;
    if (modifiers.shift !== event.shiftKey) return false;
    if (modifiers.alt !== event.altKey) return false;
    
    return true;
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger hotkeys if typing in an input/textarea unless it's a specific combo
      const target = event.target as HTMLElement;
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      
      // Check for regenerate
      if (matchesHotkey(event, hotkeys.regenerate)) {
        event.preventDefault();
        actions.onRegenerate?.();
        return;
      }

      // Check for swipe left
      if (matchesHotkey(event, hotkeys.swipeLeft)) {
        event.preventDefault();
        actions.onSwipeLeft?.();
        return;
      }

      // Check for swipe right
      if (matchesHotkey(event, hotkeys.swipeRight)) {
        event.preventDefault();
        actions.onSwipeRight?.();
        return;
      }

      // For send/newline, only handle when in a textarea
      if (isTyping) {
        // Check for newLine
        if (matchesHotkey(event, hotkeys.newLine)) {
          // This is handled by the textarea's onKeyDown
          return;
        }

        // Check for send
        if (matchesHotkey(event, hotkeys.send)) {
          // This is handled by the textarea's onKeyDown
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hotkeys, actions, enabled, matchesHotkey]);

  return { parseHotkey, matchesHotkey };
}

// Utility function to format hotkey for display
export function formatHotkey(hotkey: string): string {
  const parts = hotkey.split('+');
  return parts.map(part => {
    switch (part.toLowerCase()) {
      case 'ctrl':
        return '⌃';
      case 'shift':
        return '⇧';
      case 'alt':
        return '⌥';
      case 'meta':
      case 'cmd':
        return '⌘';
      case 'enter':
        return '↵';
      case 'arrowleft':
        return '←';
      case 'arrowright':
        return '→';
      case 'arrowup':
        return '↑';
      case 'arrowdown':
        return '↓';
      case 'escape':
        return 'Esc';
      case 'backspace':
        return '⌫';
      case 'delete':
        return '⌦';
      default:
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    }
  }).join(' + ');
}
