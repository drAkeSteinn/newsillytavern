'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useTavernStore } from '@/store/tavern-store';

// Debounce time for auto-save (in milliseconds)
const DEBOUNCE_TIME = 2000;

// Data types that should be persisted to files
const PERSIST_KEYS = ['characters', 'sessions', 'groups', 'personas', 'settings', 'lorebooks'] as const;

/**
 * Hook to synchronize store data with server-side JSON files
 * - Loads data from server on mount
 * - Auto-saves data to server when store changes (with debounce)
 */
export function usePersistenceSync() {
  const isInitialized = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSaving = useRef(false);

  // Get store state and actions
  const store = useTavernStore();

  // Load data from server
  const loadFromServer = useCallback(async () => {
    try {
      const response = await fetch('/api/persistence');
      if (!response.ok) {
        console.error('Failed to load persistent data');
        return false;
      }

      const { data } = await response.json();

      // Use store.setState to update all data at once
      if (data) {
        const updates: Record<string, unknown> = {};

        if (data.characters && Array.isArray(data.characters)) {
          updates.characters = data.characters;
        }
        if (data.sessions && Array.isArray(data.sessions)) {
          updates.sessions = data.sessions;
        }
        if (data.groups && Array.isArray(data.groups)) {
          updates.groups = data.groups;
        }
        if (data.personas && Array.isArray(data.personas)) {
          updates.personas = data.personas;
        }
        if (data.settings) {
          updates.settings = data.settings;
        }
        if (data.lorebooks && Array.isArray(data.lorebooks)) {
          updates.lorebooks = data.lorebooks;
        }

        // Apply updates to store
        if (Object.keys(updates).length > 0) {
          useTavernStore.setState(updates);
        }
      }

      return true;
    } catch (error) {
      console.error('Error loading persistent data:', error);
      return false;
    }
  }, []);

  // Save data to server
  const saveToServer = useCallback(async () => {
    if (isSaving.current) return;

    try {
      isSaving.current = true;

      const state = useTavernStore.getState();

      const dataToSave = {
        characters: state.characters,
        sessions: state.sessions,
        groups: state.groups,
        personas: state.personas,
        settings: state.settings,
        lorebooks: state.lorebooks,
      };

      const response = await fetch('/api/persistence', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSave),
      });

      if (!response.ok) {
        console.error('Failed to save persistent data');
      }
    } catch (error) {
      console.error('Error saving persistent data:', error);
    } finally {
      isSaving.current = false;
    }
  }, []);

  // Debounced save
  const debouncedSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveToServer();
    }, DEBOUNCE_TIME);
  }, [saveToServer]);

  // Initialize: load data from server on first mount
  useEffect(() => {
    if (!isInitialized.current) {
      isInitialized.current = true;
      loadFromServer();
    }
  }, [loadFromServer]);

  // Subscribe to store changes and auto-save
  useEffect(() => {
    const unsubscribe = useTavernStore.subscribe((state, prevState) => {
      // Check if any persistent data has changed
      const hasChanges = PERSIST_KEYS.some(key => {
        return JSON.stringify(state[key]) !== JSON.stringify(prevState[key]);
      });

      if (hasChanges) {
        debouncedSave();
      }
    });

    return () => {
      unsubscribe();
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [debouncedSave]);

  // Manual save function
  const forceSave = useCallback(async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    await saveToServer();
  }, [saveToServer]);

  // Manual reload function
  const forceReload = useCallback(async () => {
    return await loadFromServer();
  }, [loadFromServer]);

  return {
    forceSave,
    forceReload,
    isLoading: !isInitialized.current,
  };
}

export default usePersistenceSync;
