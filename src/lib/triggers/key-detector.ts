// ============================================
// Key Detector - Unified Key Detection System
// ============================================
//
// Detects trigger keys in multiple formats during streaming:
// - [key] - Simple bracketed key
// - [key=value] - Key with value
// - [key: value] - Key with colon and value
// - |key| - Pipe delimited
// - Peticion:key, Peticion=key - Prefix format (solicitudes)
// - Solicitud:key, Solicitud=key - Prefix format
// - key:value, key=value - Standalone key-value
// - plain_word - Simple word (for triggers configured as plain keywords)
//
// Features:
// - Position-based detection (prevents duplicates)
// - Order of appearance preserved
// - Works with character or word streaming
// - Immediate trigger execution
// - Single unified detector for ALL trigger types

// ============================================
// Types
// ============================================

export type KeyFormat =
  | 'bracket'        // [key] or [key=value]
  | 'pipe'           // |key|
  | 'prefix'         // Peticion:key, Solicitud=key
  | 'key_value'      // key:value, key=value
  | 'word';          // Simple word (for triggers configured as plain keywords)

export type KeyCategory = 
  | 'sound'          // Sound trigger keyword
  | 'sprite'         // Sprite trigger keyword
  | 'background'     // Background trigger keyword
  | 'solicitud'      // Peticion/Solicitud activation/completion
  | 'skill'          // Skill activation key
  | 'stats'          // Stats modification key
  | 'hud'            // HUD update key
  | 'quest'          // Quest trigger key
  | 'item'           // Item trigger key
  | 'unknown';       // Not yet classified

export interface DetectedKey {
  key: string;           // Normalized key (lowercase, no accents)
  original: string;      // Original key as appeared in text
  value?: string;        // Value if present (for [key=value] or key:value)
  format: KeyFormat;     // How the key appeared
  prefix?: string;       // Prefix if format is 'prefix' (Peticion, Solicitud)
  position: number;      // Character position in text
  length: number;        // Length of the full match in text
  fullMatch: string;     // The complete matched string
}

// ============================================
// Normalization
// ============================================

/**
 * Normalize a key for matching
 * - Lowercase
 * - Remove accents (NFD normalization)
 * - Keep only letters, numbers, underscores, hyphens
 */
export function normalizeKey(text: string): string {
  if (!text) return '';
  
  let result = text.trim().toLowerCase();
  
  // Remove accents
  result = result
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  
  // Keep only alphanumeric, underscores, hyphens
  result = result.replace(/[^a-z0-9_-]/g, '');
  
  return result;
}

/**
 * Check if a normalized key matches a pattern
 * Supports exact match only (no partials to avoid false positives)
 */
export function keyMatches(
  detectedKey: string,
  triggerKey: string,
  caseSensitive: boolean = false
): boolean {
  if (!detectedKey || !triggerKey) return false;
  
  if (caseSensitive) {
    return detectedKey === triggerKey;
  }
  
  return detectedKey.toLowerCase() === triggerKey.toLowerCase();
}

/**
 * Check if a detected key matches any of the trigger keys
 */
export function keyMatchesAny(
  detectedKey: string,
  triggerKeys: string[],
  caseSensitive: boolean = false
): boolean {
  return triggerKeys.some(k => keyMatches(detectedKey, k, caseSensitive));
}

// ============================================
// Key Detector Class
// ============================================

export class KeyDetector {
  // Track processed positions per message to avoid duplicates
  private processedPositions: Map<string, Set<number>> = new Map();
  
  // Track last processed length per message for incremental detection
  private lastProcessedLength: Map<string, number> = new Map();
  
  // All detected keys per message (for debugging)
  private allKeys: Map<string, DetectedKey[]> = new Map();

  /**
   * Detect keys incrementally in streaming text
   * Returns only NEW keys detected since last call
   */
  detectKeys(text: string, messageKey: string): DetectedKey[] {
    const processed = this.processedPositions.get(messageKey) ?? new Set();
    const allKeys = this.allKeys.get(messageKey) ?? [];
    
    const newKeys: DetectedKey[] = [];
    
    // Pattern 1: [key] or [key=value] or [key: value]
    // Allows: [sonido], [vida=100], [vida: 100], [peticion_madera], [sprite:alegre]
    const bracketPattern = /\[([a-zA-Z][a-zA-Z0-9_-]*)(?:\s*[:=]\s*([^\]]+))?\]/g;
    
    // Pattern 2: |key|
    const pipePattern = /\|([a-zA-Z][a-zA-Z0-9_-]+)\|/g;
    
    // Pattern 3: Peticion:key, Peticion=key, Peticion: key, Solicitud:key, etc.
    const prefixPattern = /(Peticion|Solicitud)\s*[:=]?\s*([a-zA-Z][a-zA-Z0-9_-]+)/gi;
    
    // Pattern 4: key:value or key=value (standalone, must be preceded by space/start)
    // This captures patterns like "sprite:happy" or "mision:test"
    const keyValuePattern = /(?:^|[\s\n])([a-zA-Z][a-zA-Z0-9_-]{1,30})\s*[:=]\s*([a-zA-Z][a-zA-Z0-9_-]{1,30})/g;
    
    // Process all patterns
    this.processPattern(text, bracketPattern, 'bracket', processed, newKeys, (match) => {
      return {
        key: normalizeKey(match[1]),
        original: match[1],
        value: match[2]?.trim() || undefined,
      };
    });
    
    this.processPattern(text, pipePattern, 'pipe', processed, newKeys, (match) => {
      return {
        key: normalizeKey(match[1]),
        original: match[1],
        value: undefined,
      };
    });
    
    this.processPattern(text, prefixPattern, 'prefix', processed, newKeys, (match) => {
      return {
        key: normalizeKey(match[2]),
        original: match[2],
        value: undefined,
        prefix: match[1], // Peticion or Solicitud
      };
    });
    
    this.processPattern(text, keyValuePattern, 'key_value', processed, newKeys, (match) => {
      return {
        key: normalizeKey(match[1]),
        original: match[1],
        value: match[2],
      };
    });
    
    // Sort by position (order of appearance)
    newKeys.sort((a, b) => a.position - b.position);
    
    // Update state
    this.lastProcessedLength.set(messageKey, text.length);
    this.processedPositions.set(messageKey, processed);
    this.allKeys.set(messageKey, [...allKeys, ...newKeys]);
    
    return newKeys;
  }
  
  /**
   * Process a regex pattern and extract keys
   */
  private processPattern(
    text: string,
    pattern: RegExp,
    format: KeyFormat,
    processed: Set<number>,
    results: DetectedKey[],
    extractor: (match: RegExpMatchArray) => Partial<DetectedKey>
  ): void {
    // Reset regex lastIndex
    pattern.lastIndex = 0;
    
    for (const match of text.matchAll(pattern)) {
      const position = match.index ?? 0;
      const fullMatch = match[0];
      const length = fullMatch.length;
      
      // Skip if this position was already processed
      // Use position range to avoid overlaps
      let hasOverlap = false;
      for (let i = position; i < position + length; i++) {
        if (processed.has(i)) {
          hasOverlap = true;
          break;
        }
      }
      if (hasOverlap) continue;
      
      // Extract key data
      const extracted = extractor(match);
      if (!extracted.key) continue;
      
      // Mark all positions in this match as processed
      for (let i = position; i < position + length; i++) {
        processed.add(i);
      }
      
      // Add to results
      results.push({
        key: extracted.key,
        original: extracted.original ?? extracted.key,
        value: extracted.value,
        format,
        prefix: extracted.prefix,
        position,
        length,
        fullMatch,
      });
    }
  }
  
  /**
   * Detect plain word keys (for triggers configured without special format)
   * This is for backward compatibility with simple keyword triggers
   * 
   * IMPORTANT: Only matches words that are registered as trigger keywords
   */
  detectWordKeys(
    text: string, 
    messageKey: string, 
    registeredKeys: string[]
  ): DetectedKey[] {
    if (registeredKeys.length === 0) return [];
    
    const processed = this.processedPositions.get(messageKey) ?? new Set();
    const newKeys: DetectedKey[] = [];
    
    // Normalize registered keys for matching
    const normalizedRegistered = registeredKeys.map(k => normalizeKey(k)).filter(k => k);
    if (normalizedRegistered.length === 0) return [];
    
    // Build pattern from registered keys
    const escapedKeys = normalizedRegistered
      .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|');
    
    // Word boundary pattern to match exact words
    const wordPattern = new RegExp(`\\b(${escapedKeys})\\b`, 'gi');
    
    for (const match of text.matchAll(wordPattern)) {
      const position = match.index ?? 0;
      const fullMatch = match[0];
      const length = fullMatch.length;
      
      // Skip if already processed
      let hasOverlap = false;
      for (let i = position; i < position + length; i++) {
        if (processed.has(i)) {
          hasOverlap = true;
          break;
        }
      }
      if (hasOverlap) continue;
      
      // Mark positions as processed
      for (let i = position; i < position + length; i++) {
        processed.add(i);
      }
      
      newKeys.push({
        key: normalizeKey(match[1]),
        original: match[1],
        format: 'word',
        position,
        length,
        fullMatch,
      });
    }
    
    this.processedPositions.set(messageKey, processed);
    
    return newKeys;
  }
  
  /**
   * Get all detected keys for a message
   */
  getAllKeys(messageKey: string): DetectedKey[] {
    return this.allKeys.get(messageKey) ?? [];
  }
  
  /**
   * Check if a position has been processed
   */
  isProcessed(messageKey: string, position: number): boolean {
    const processed = this.processedPositions.get(messageKey);
    return processed?.has(position) ?? false;
  }
  
  /**
   * Mark a position range as processed (for external use)
   */
  markProcessed(messageKey: string, position: number, length: number): void {
    const processed = this.processedPositions.get(messageKey) ?? new Set();
    for (let i = position; i < position + length; i++) {
      processed.add(i);
    }
    this.processedPositions.set(messageKey, processed);
  }
  
  /**
   * Reset state for a new message
   */
  reset(messageKey: string): void {
    this.processedPositions.delete(messageKey);
    this.lastProcessedLength.delete(messageKey);
    this.allKeys.delete(messageKey);
  }
  
  /**
   * Clear all state
   */
  clearAll(): void {
    this.processedPositions.clear();
    this.lastProcessedLength.clear();
    this.allKeys.clear();
  }
}

// ============================================
// Singleton Instance
// ============================================

let detectorInstance: KeyDetector | null = null;

export function getKeyDetector(): KeyDetector {
  if (!detectorInstance) {
    detectorInstance = new KeyDetector();
  }
  return detectorInstance;
}

export function resetKeyDetector(): void {
  detectorInstance = null;
}

// ============================================
// Utility Functions
// ============================================

/**
 * Classify a detected key into a category based on its format and content
 * This is a hint - handlers should do their own classification
 */
export function classifyKey(key: DetectedKey): KeyCategory {
  // Prefix-based classification
  if (key.format === 'prefix') {
    if (key.prefix?.toLowerCase() === 'peticion' || key.prefix?.toLowerCase() === 'solicitud') {
      return 'solicitud';
    }
  }
  
  // Value-based hints (if key has a value)
  if (key.value) {
    const valueLower = key.value.toLowerCase();
    if (valueLower.includes('sprite') || valueLower.includes('expresion')) {
      return 'sprite';
    }
    if (valueLower.includes('sound') || valueLower.includes('sonido')) {
      return 'sound';
    }
    if (valueLower.includes('bg') || valueLower.includes('background') || valueLower.includes('fondo')) {
      return 'background';
    }
  }
  
  // Key name hints
  const keyLower = key.key.toLowerCase();
  
  // Solicitud patterns
  if (keyLower.startsWith('pedir_') || keyLower.startsWith('solicitar_') || 
      keyLower.startsWith('peticion_') || keyLower.startsWith('solicitud_')) {
    return 'solicitud';
  }
  
  // Skill patterns
  if (keyLower.includes('skill') || keyLower.includes('habilidad') || 
      keyLower.includes('accion') || keyLower.includes('action')) {
    return 'skill';
  }
  
  // Stats patterns
  if (keyLower.includes('stat') || keyLower.includes('atributo') ||
      keyLower.includes('hp') || keyLower.includes('mp') || keyLower.includes('vida')) {
    return 'stats';
  }
  
  // Quest patterns
  if (keyLower.includes('quest') || keyLower.includes('mision') || 
      keyLower.includes('objetivo')) {
    return 'quest';
  }
  
  return 'unknown';
}
