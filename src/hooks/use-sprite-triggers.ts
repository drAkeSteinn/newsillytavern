'use client';

/**
 * useSpriteTriggers Hook
 * 
 * Advanced sprite trigger system based on DOP Tirano Suite.
 * 
 * Features:
 * - Sprite Pack matching (ANY pack keyword + ALL item keys)
 * - Sprite Libraries (actions/poses/clothes with prefix-based keys)
 * - Return to Idle timer system (store-managed)
 * - Sprite Lock (keep sprite fixed with optional interval reapply)
 * - Realtime streaming support
 * 
 * FASE 2: Enhanced integration with store
 */

import { useCallback, useEffect } from 'react';
import { useTavernStore } from '@/store';
import { setReturnToIdleCallback } from '@/store/slices/spriteSlice';
import type {
  SpriteTriggerHit,
  SpritePack,
  SpritePackItem,
  SpriteLibraryEntry,
  SpriteIndexEntry,
  CharacterCard,
  CharacterSpriteTrigger,
  StateSpriteCollection,
  SpriteState,
  CollectionBehavior,
} from '@/types';

// ============================================
// Token Extraction Utilities
// ============================================

/**
 * Normalize a token for matching (lowercase, remove accents)
 */
export function normalizeToken(s: string): string {
  const raw = (s ?? '').toString().trim().toLowerCase();
  if (!raw) return '';

  const deacc = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Remove accents

  // Keep letters/numbers/space/_/-
  const kept = deacc.replace(/[^\p{L}\p{N}\s_-]/gu, '');

  // If we removed everything (e.g., emoji token), keep the raw token
  return kept || raw;
}

/**
 * Extract pipe tokens from text (|keyword|)
 */
export function extractPipeTokens(text: string, tagDelimiters = { start: '|', end: '|' }): string[] {
  const tokens: string[] = [];
  const { start, end } = tagDelimiters;

  const escapedStart = start.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedEnd = end.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const re = new RegExp(`${escapedStart}([^\\n]{1,80}?)${escapedEnd}`, 'g');

  for (const m of text.matchAll(re)) {
    if (m && m[1]) tokens.push(m[1]);
  }

  return tokens;
}

/**
 * Remove pipe segments from text for plain word scanning
 */
export function removePipeSegments(text: string, tagDelimiters = { start: '|', end: '|' }): string {
  const { start, end } = tagDelimiters;
  const escapedStart = start.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedEnd = end.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`${escapedStart}[^\\n]{1,80}?${escapedEnd}`, 'g');
  return text.replace(re, ' ');
}

/**
 * Extract word tokens from plain text
 */
export function extractWordTokens(text: string): string[] {
  const tokens: string[] = [];
  const wordRe = /[\p{L}\p{N}_-]{2,40}/gu;

  for (const m of text.matchAll(wordRe)) {
    if (m && m[0]) tokens.push(m[0]);
  }

  // Emoji / pictographs
  try {
    const emojiRe = /\p{Extended_Pictographic}/gu;
    for (const m of text.matchAll(emojiRe)) {
      if (m && m[0]) tokens.push(m[0]);
    }
  } catch {
    // Older JS engines might not support Extended_Pictographic
  }

  return tokens;
}

/**
 * Extract HUD tokens [key=value|key2]
 */
export function extractHudTokens(text: string): string[] {
  const out: string[] = [];
  const re = /\[([^\]]{1,400})\]/g;
  let m;

  while ((m = re.exec(text)) !== null) {
    const inside = (m[1] ?? '').toString();
    if (!inside) continue;

    for (const part of inside.split('|')) {
      const p = part.trim();
      if (p) out.push(p);

      // If token looks like key=value, also push value and key separately
      const eq = p.indexOf('=');
      if (eq > 0 && eq < p.length - 1) {
        const k = p.slice(0, eq).trim();
        const v = p.slice(eq + 1).trim();
        if (k) out.push(k);
        if (v) out.push(v);
      }
    }
  }

  return out;
}

// ============================================
// Token Set Builder
// ============================================

interface TokenSetOptions {
  pipeTokens?: string[];
  wordTokens?: string[];
  hudTokens?: string[];
}

/**
 * Build a set of normalized tokens for matching
 */
export function buildTokenSet(
  { pipeTokens = [], wordTokens = [], hudTokens = [] }: TokenSetOptions,
  caseSensitive: boolean
): Set<string> {
  const set = new Set<string>();

  const norm = (s: string) => {
    const t = (s ?? '').toString().trim();
    if (!t) return '';
    return caseSensitive ? t : t.toLowerCase();
  };

  for (const t of [...pipeTokens, ...wordTokens, ...hudTokens]) {
    const v = norm(t);
    if (v) set.add(v);
  }

  return set;
}

/**
 * Find first index of a keyword in text
 */
export function findFirstIndex(
  text: string,
  keyword: string,
  caseSensitive: boolean
): number {
  const h = caseSensitive ? text : text.toLowerCase();
  const n = caseSensitive ? keyword : keyword.toLowerCase();
  if (!h || !n) return -1;
  return h.indexOf(n);
}

// ============================================
// Sprite Library Helpers
// ============================================

/**
 * Build sprite key from library entry
 */
export function spriteLibKey(entry: SpriteLibraryEntry | null | undefined): string {
  if (!entry) return '';
  const prefix = (entry.prefix ?? '').toString().trim();
  const name = (entry.name ?? '').toString().trim();
  if (!prefix || !name) return '';
  return `${prefix}${name}`;
}

/**
 * Get library entry by ID
 */
export function spriteLibEntryById(
  libraries: { actions: SpriteLibraryEntry[]; poses: SpriteLibraryEntry[]; clothes: SpriteLibraryEntry[] },
  kind: 'actions' | 'poses' | 'clothes',
  id: string
): SpriteLibraryEntry | null {
  try {
    const arr = libraries?.[kind] ?? [];
    return arr.find(e => e?.id === id) || null;
  } catch {
    return null;
  }
}

/**
 * Parse CSV keys
 */
export function parseKeysCsv(raw: string): string[] {
  return (raw ?? '')
    .toString()
    .split(',')
    .map(x => x.trim())
    .filter(Boolean);
}

/**
 * Build all keys for a sprite pack item
 * Combines library references + manual keys
 */
export function spriteItemBuiltKeys(
  libraries: { actions: SpriteLibraryEntry[]; poses: SpriteLibraryEntry[]; clothes: SpriteLibraryEntry[] },
  item: SpritePackItem
): string[] {
  const out: string[] = [];

  const a = spriteLibEntryById(libraries, 'actions', item.actionId || '');
  const p = spriteLibEntryById(libraries, 'poses', item.poseId || '');
  const c = spriteLibEntryById(libraries, 'clothes', item.clothesId || '');

  // Library keys
  for (const e of [a, p, c]) {
    const k = spriteLibKey(e);
    if (k) out.push(k);
  }

  // Manual keys
  out.push(...parseKeysCsv(item.keys));

  // De-duplicate
  const seen = new Set<string>();
  return out.filter(k => {
    const kk = k.toString().trim();
    if (!kk) return false;
    if (seen.has(kk)) return false;
    seen.add(kk);
    return true;
  });
}

// ============================================
// Sprite URL Lookup
// ============================================

/**
 * Get sprite URL by label from index
 */
export function getSpriteUrlByLabel(
  spriteIndex: { sprites: SpriteIndexEntry[] },
  label: string
): string | null {
  const entry = spriteIndex.sprites.find(s => s.label === label);
  return entry?.url || null;
}

/**
 * Get sprite URL from pack item (resolve from index or use direct URL)
 */
export function resolveSpriteUrl(
  item: SpritePackItem,
  spriteIndex: { sprites: SpriteIndexEntry[] }
): string | null {
  if (item.spriteUrl) return item.spriteUrl;
  if (item.spriteLabel) return getSpriteUrlByLabel(spriteIndex, item.spriteLabel);
  return null;
}

// ============================================
// State Collection Sprite Selection
// ============================================

/**
 * Get sprite URL from a state collection based on behavior mode
 * 
 * @param collection - The state collection to select from
 * @param updateIndex - Whether to update the collection's currentIndex (for list mode)
 * @returns The selected sprite URL and updated collection (if index changed)
 */
export function getSpriteFromCollection(
  collection: StateSpriteCollection | undefined,
  updateIndex: boolean = true
): { url: string | null; label: string | null; updatedCollection?: StateSpriteCollection } {
  if (!collection || collection.entries.length === 0) {
    return { url: null, label: null };
  }

  const { entries, behavior, currentIndex } = collection;
  const sortedEntries = [...entries].sort((a, b) => a.order - b.order);

  let selectedEntry;
  let newIndex = currentIndex;

  switch (behavior) {
    case 'principal':
      // Always use the principal sprite
      selectedEntry = sortedEntries.find(e => e.role === 'principal') || sortedEntries[0];
      break;

    case 'random':
      // Random selection from all entries
      const randomIndex = Math.floor(Math.random() * sortedEntries.length);
      selectedEntry = sortedEntries[randomIndex];
      break;

    case 'list':
      // Rotate through entries in order
      selectedEntry = sortedEntries[currentIndex % sortedEntries.length];
      newIndex = (currentIndex + 1) % sortedEntries.length;
      break;

    default:
      selectedEntry = sortedEntries[0];
  }

  if (!selectedEntry) {
    return { url: null, label: null };
  }

  const result: { url: string | null; label: string | null; updatedCollection?: StateSpriteCollection } = {
    url: selectedEntry.spriteUrl,
    label: selectedEntry.spriteLabel,
  };

  // Return updated collection if index changed (list mode)
  if (behavior === 'list' && updateIndex && newIndex !== currentIndex) {
    result.updatedCollection = {
      ...collection,
      currentIndex: newIndex,
    };
  }

  return result;
}

/**
 * Get sprite URL for a specific state (idle, talk, thinking)
 * Falls back to legacy sprites if state collection is not configured
 */
export function getStateSpriteUrl(
  state: SpriteState,
  spriteConfig: {
    sprites?: { [key in SpriteState]?: string };
    stateCollections?: { [key in SpriteState]?: StateSpriteCollection };
  },
  avatar?: string
): { url: string | null; label: string | null } {
  // First, try state collections (new system)
  const stateCollection = spriteConfig.stateCollections?.[state];
  if (stateCollection && stateCollection.entries.length > 0) {
    return getSpriteFromCollection(stateCollection, false);
  }

  // Fall back to legacy sprites
  const legacyUrl = spriteConfig.sprites?.[state];
  if (legacyUrl) {
    return { url: legacyUrl, label: null };
  }

  // Additional fallbacks
  if (state === 'talk') {
    // Talk falls back to idle
    const idleResult = getStateSpriteUrl('idle', spriteConfig, avatar);
    if (idleResult.url) return idleResult;
  }

  if (state === 'idle' && avatar) {
    // Idle falls back to avatar
    return { url: avatar, label: 'avatar' };
  }

  return { url: null, label: null };
}

// ============================================
// Sprite Pack Matching
// ============================================

/**
 * Match sprite packs against text
 * 
 * Logic:
 * 1. ANY pack keyword must match
 * 2. ALL item keys must match
 * 3. Return best match (earliest keyword occurrence)
 */
export function matchSpritePacks(
  text: string,
  packs: SpritePack[],
  spriteIndex: { sprites: SpriteIndexEntry[] },
  libraries: { actions: SpriteLibraryEntry[]; poses: SpriteLibraryEntry[]; clothes: SpriteLibraryEntry[] },
  options: {
    pipeDelimiters?: { start: string; end: string };
    tagDelimiters?: { start: string; end: string };
  } = {}
): SpriteTriggerHit | null {
  const tagDelimiters = options.tagDelimiters || options.pipeDelimiters || { start: '|', end: '|' };
  const activePacks = packs.filter(p => p.active);

  if (activePacks.length === 0) return null;

  // Extract all tokens
  const pipeTokens = extractPipeTokens(text, tagDelimiters);
  const plainText = removePipeSegments(text, tagDelimiters);
  const wordTokens = extractWordTokens(plainText);
  const hudTokens = extractHudTokens(text);

  let best: SpriteTriggerHit | null = null;

  for (const pack of activePacks) {
    const caseSensitive = pack.caseSensitive;
    const requirePipes = pack.requirePipes;

    // Build token sets
    const tokenSetAny = buildTokenSet({ pipeTokens, wordTokens, hudTokens }, caseSensitive);
    const tokenSetPipes = buildTokenSet({ pipeTokens, wordTokens: [], hudTokens: [] }, caseSensitive);

    // 1) Pack keyword match (ANY)
    let kwHitIdx = Infinity;
    let kwMatched = '';

    for (const kw of pack.keywords) {
      const needle = caseSensitive ? kw : kw.toLowerCase();
      const ok = requirePipes
        ? tokenSetPipes.has(needle)
        : (tokenSetAny.has(needle) || findFirstIndex(text, kw, caseSensitive) !== -1);

      if (!ok) continue;

      const idx = findFirstIndex(text, kw, caseSensitive);
      if (idx !== -1 && idx < kwHitIdx) {
        kwHitIdx = idx;
        kwMatched = kw;
      }
    }

    if (!kwMatched) continue;

    // 2) Item keys match (ALL keys must match)
    const items = pack.items || [];
    let chosen: SpritePackItem | null = null;
    let chosenKeyCount = 0;

    for (const item of items) {
      if (!item || item.enabled === false) continue;

      const label = (item.spriteLabel ?? '').toString().trim();
      if (!label) continue;

      const keys = spriteItemBuiltKeys(libraries, item);
      if (keys.length === 0) continue; // Items without keys don't auto-trigger

      // ALL keys must match
      let okAll = true;
      for (const k of keys) {
        const needle = caseSensitive ? k : k.toLowerCase();
        const ok = requirePipes
          ? tokenSetPipes.has(needle)
          : (tokenSetAny.has(needle) || findFirstIndex(text, k, caseSensitive) !== -1);

        if (!ok) {
          okAll = false;
          break;
        }
      }

      if (!okAll) continue;

      // Prefer more specific items (more keys)
      if (!chosen || keys.length > chosenKeyCount) {
        chosen = item;
        chosenKeyCount = keys.length;
      }
    }

    if (!chosen) continue;

    // Resolve sprite URL
    const spriteUrl = resolveSpriteUrl(chosen, spriteIndex);
    if (!spriteUrl) continue;

    const score = kwHitIdx;
    const hit: SpriteTriggerHit = {
      packId: pack.id,
      pack,
      item: chosen,
      spriteLabel: chosen.spriteLabel,
      spriteUrl,
      idleSpriteLabel: chosen.idleSpriteLabel,
      returnToIdleMs: chosen.returnToIdleMs,
      score,
    };

    if (!best || (hit.score ?? Infinity) < (best.score ?? Infinity)) {
      best = hit;
    }
  }

  return best;
}

// ============================================
// Simple Sprite Trigger Matching
// ============================================

/**
 * Match simple character sprite triggers (CharacterSpriteTrigger)
 * 
 * Logic: ANY keyword matches
 */
export function matchSimpleSpriteTriggers(
  text: string,
  triggers: CharacterSpriteTrigger[],
  options: {
    tagDelimiters?: { start: string; end: string };
  } = {}
): CharacterSpriteTrigger | null {
  const tagDelimiters = options.tagDelimiters || { start: '|', end: '|' };
  const activeTriggers = triggers.filter(t => t.active);

  if (activeTriggers.length === 0) return null;

  const pipeTokens = extractPipeTokens(text, tagDelimiters);
  const plainText = removePipeSegments(text, tagDelimiters);
  const wordTokens = extractWordTokens(plainText);

  let best: CharacterSpriteTrigger | null = null;
  let bestIdx = Infinity;

  for (const trigger of activeTriggers) {
    const caseSensitive = trigger.caseSensitive;
    const requirePipes = trigger.requirePipes;

    const tokenSetAny = buildTokenSet({ pipeTokens, wordTokens }, caseSensitive);
    const tokenSetPipes = buildTokenSet({ pipeTokens }, caseSensitive);

    for (const kw of trigger.keywords) {
      const needle = caseSensitive ? kw : kw.toLowerCase();
      const ok = requirePipes
        ? tokenSetPipes.has(needle)
        : (tokenSetAny.has(needle) || findFirstIndex(text, kw, caseSensitive) !== -1);

      if (!ok) continue;

      const idx = findFirstIndex(text, kw, caseSensitive);
      if (idx !== -1 && idx < bestIdx) {
        bestIdx = idx;
        best = trigger;
      }
    }
  }

  return best;
}

// ============================================
// Cooldown Management
// ============================================

interface CooldownState {
  lastPackTriggerAt: Map<string, number>;
  lastGlobalTriggerAt: number;
}

const cooldownState: CooldownState = {
  lastPackTriggerAt: new Map(),
  lastGlobalTriggerAt: 0,
};

/**
 * Check if trigger is ready (cooldown elapsed)
 */
export function isCooldownReady(
  packId: string,
  cooldownMs: number,
  globalCooldownMs: number
): boolean {
  const now = Date.now();

  // Check pack-specific cooldown
  const lastPack = cooldownState.lastPackTriggerAt.get(packId) || 0;
  if (cooldownMs > 0 && now - lastPack < cooldownMs) {
    return false;
  }

  // Check global cooldown
  if (globalCooldownMs > 0 && now - cooldownState.lastGlobalTriggerAt < globalCooldownMs) {
    return false;
  }

  return true;
}

/**
 * Mark trigger as fired
 */
export function markTriggerFired(packId: string): void {
  const now = Date.now();
  cooldownState.lastPackTriggerAt.set(packId, now);
  cooldownState.lastGlobalTriggerAt = now;
}

// ============================================
// Main Hook
// ============================================

interface UseSpriteTriggersOptions {
  globalCooldownMs?: number;
  enabled?: boolean;
  realtimeEnabled?: boolean;
  tagDelimiters?: { start: string; end: string };
}

export function useSpriteTriggers(options: UseSpriteTriggersOptions = {}) {
  const {
    globalCooldownMs = 250,
    enabled = true,
    tagDelimiters = { start: '|', end: '|' },
  } = options;

  const store = useTavernStore();

  /**
   * Scan text for sprite triggers and apply them
   */
  const scanForSpriteTriggers = useCallback(
    (text: string, character: CharacterCard | null) => {
      if (!enabled || !text.trim()) return null;

      // Check if sprite is locked
      if (store.isSpriteLocked && store.isSpriteLocked()) {
        return null;
      }

      // Check if return to idle is scheduled - allow it to be interrupted by new triggers
      // (this is intentional behavior - new triggers can override pending idle return)

      // Try sprite packs first (priority)
      const packs = character?.spritePacks || store.spritePacks || [];
      const hit = matchSpritePacks(
        text,
        packs,
        store.spriteIndex,
        store.spriteLibraries,
        { tagDelimiters }
      );

      if (hit && hit.pack) {
        const cooldown = hit.pack.cooldownMs || 0;
        if (isCooldownReady(hit.packId, cooldown, globalCooldownMs)) {
          markTriggerFired(hit.packId);
          return hit;
        }
      }

      // Try simple triggers
      const simpleTriggers = character?.spriteTriggers || [];
      if (simpleTriggers.length > 0) {
        const simpleHit = matchSimpleSpriteTriggers(text, simpleTriggers, { tagDelimiters });
        if (simpleHit) {
          // Check cooldown for simple trigger
          const triggerId = `simple_${simpleHit.id}`;
          if (isCooldownReady(triggerId, simpleHit.cooldownMs || 0, globalCooldownMs)) {
            markTriggerFired(triggerId);
            return {
              packId: triggerId,
              spriteLabel: simpleHit.spriteState || null,
              spriteUrl: simpleHit.spriteUrl,
              idleSpriteLabel: null,
              returnToIdleMs: simpleHit.returnToIdleMs,
              returnToMode: simpleHit.returnToMode || 'idle_collection',
              returnToSpriteUrl: simpleHit.returnToSpriteUrl,
              cooldownMs: simpleHit.cooldownMs,
              item: undefined,
              pack: undefined,
            } as SpriteTriggerHit;
          }
        }
      }

      return null;
    },
    [enabled, globalCooldownMs, store, tagDelimiters]
  );

  /**
   * Apply a sprite trigger hit for a specific character
   * Uses the UNIFIED system with per-character state
   */
  const applyTrigger = useCallback(
    (hit: SpriteTriggerHit, character?: CharacterCard | null) => {
      if (!hit.spriteUrl || !character?.id) return;

      const characterId = character.id;

      // Apply the sprite using the UNIFIED per-character system
      store.applyTriggerForCharacter(characterId, hit);

      // Schedule return to idle if configured
      if (hit.returnToIdleMs && hit.returnToIdleMs > 0) {
        let returnToUrl: string | null = null;
        let returnToLabel: string | null = null;

        if (hit.returnToMode === 'custom_sprite' && hit.returnToSpriteUrl) {
          // Return to custom sprite
          returnToUrl = hit.returnToSpriteUrl;
          returnToLabel = 'custom_return';
        } else {
          // Return to idle collection - get the sprite from the idle collection
          const idleCollection = character?.spriteConfig?.stateCollections?.['idle'];
          if (idleCollection && idleCollection.entries.length > 0) {
            const result = getSpriteFromCollection(idleCollection, false);
            returnToUrl = result.url;
            returnToLabel = result.label;
          }
          // Fall back to legacy idle sprite
          if (!returnToUrl && character?.spriteConfig?.sprites?.['idle']) {
            returnToUrl = character.spriteConfig.sprites['idle'];
            returnToLabel = 'idle';
          }
          // Fall back to avatar
          if (!returnToUrl && character?.avatar) {
            returnToUrl = character.avatar;
            returnToLabel = 'avatar';
          }
        }
        
        if (returnToUrl) {
          store.scheduleReturnToIdleForCharacter(
            characterId,
            hit.spriteUrl,
            returnToUrl,
            returnToLabel,
            hit.returnToIdleMs
          );
        }
      }
      
      return hit;
    },
    [store]
  );

  /**
   * Scan and apply triggers in one call
   * Returns the hit if a trigger was applied
   */
  const scanAndApply = useCallback(
    (text: string, character: CharacterCard | null) => {
      const hit = scanForSpriteTriggers(text, character);
      if (hit && character) {
        applyTrigger(hit, character);
      }
      return hit;
    },
    [scanForSpriteTriggers, applyTrigger]
  );

  /**
   * Reset trigger state for a specific character
   */
  const resetTriggerStateForCharacter = useCallback((characterId: string) => {
    store.cancelReturnToIdleForCharacter(characterId);
  }, [store]);

  /**
   * Reset trigger state for new message (legacy - uses active character)
   */
  const resetTriggerState = useCallback(() => {
    // Cancel any pending return to idle
    store.cancelReturnToIdle();
  }, [store]);

  /**
   * Get sprite state for a specific character
   */
  const getCharacterSpriteState = useCallback((characterId: string) => {
    return store.getCharacterSpriteState(characterId);
  }, [store]);

  /**
   * Get return to idle countdown for a specific character
   */
  const getReturnToIdleCountdownForCharacter = useCallback((characterId: string) => {
    return store.getReturnToIdleCountdownForCharacter(characterId);
  }, [store]);

  /**
   * Check if return to idle is scheduled for a specific character
   */
  const isReturnToIdleScheduledForCharacter = useCallback((characterId: string) => {
    return store.isReturnToIdleScheduledForCharacter(characterId);
  }, [store]);

  /**
   * Lock sprite (prevent trigger changes)
   */
  const lockSprite = useCallback(
    (url: string, durationMs: number = 0, intervalMs: number = 0) => {
      store.applySpriteLock(url, durationMs, intervalMs);
    },
    [store]
  );

  /**
   * Unlock sprite
   */
  const unlockSprite = useCallback(() => {
    store.clearSpriteLock();
  }, [store]);

  /**
   * Cancel pending return to idle
   */
  const cancelIdleReturn = useCallback(() => {
    store.cancelReturnToIdle();
  }, [store]);

  /**
   * Force immediate return to idle
   */
  const forceIdleReturn = useCallback(() => {
    store.executeReturnToIdle();
  }, [store]);

  // Set up callback for return to idle (for external listeners)
  useEffect(() => {
    setReturnToIdleCallback(() => {
      // Can be used to trigger animations or other effects
      // when return to idle executes
    });

    return () => {
      setReturnToIdleCallback(null);
    };
  }, []);

  return {
    // Core functions
    scanForSpriteTriggers,
    applyTrigger,
    scanAndApply,

    // Per-character functions (UNIFIED SYSTEM)
    getCharacterSpriteState,
    getReturnToIdleCountdownForCharacter,
    isReturnToIdleScheduledForCharacter,
    resetTriggerStateForCharacter,

    // State management (legacy)
    resetTriggerState,
    lockSprite,
    unlockSprite,
    cancelIdleReturn,
    forceIdleReturn,

    // Current state (from store - legacy, for single chat)
    currentSpriteUrl: store.currentSpriteUrl,
    currentSpriteLabel: store.currentSpriteLabel,
    isLocked: store.isSpriteLocked(),
    isReturnToIdleScheduled: store.isReturnToIdleScheduled(),
    returnToIdleCountdown: store.getReturnToIdleCountdown(),
    returnToIdleState: store.returnToIdle,
    lockState: store.spriteLock,

    // Utilities (exposed for testing/debugging)
    extractPipeTokens,
    extractWordTokens,
    extractHudTokens,
    matchSpritePacks,
    matchSimpleSpriteTriggers,
  };
}

export default useSpriteTriggers;
