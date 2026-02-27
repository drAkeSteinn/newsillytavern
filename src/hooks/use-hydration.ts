import { useTavernStore } from '@/store/tavern-store';
import { useSyncExternalStore, useCallback } from 'react';

/**
 * Hook to check if the Zustand store has finished hydrating from localStorage
 * This prevents hydration mismatches between server and client renders
 * 
 * Uses useSyncExternalStore for SSR-safe hydration detection
 */
export function useHydration() {
  const onStoreChange = useCallback(() => {
    return useTavernStore.persist.onFinishHydration(() => {});
  }, []);

  const getSnapshot = useCallback(() => {
    return useTavernStore.persist.hasHydrated();
  }, []);

  const getServerSnapshot = useCallback(() => {
    return false;
  }, []);

  return useSyncExternalStore(onStoreChange, getSnapshot, getServerSnapshot);
}
