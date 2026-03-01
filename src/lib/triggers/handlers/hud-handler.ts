// ============================================
// HUD Handler - Handles HUD Field Updates
// ============================================
//
// This handler processes HUD tokens [key=value] and updates
// the corresponding HUD field values in the store.
//
// The HUD system uses the existing TokenDetector which already
// extracts HUD tokens with their key/value pairs.

import type { TriggerMatch } from '../types';
import type { DetectedToken } from '../token-detector';
import type { TriggerContext } from '../trigger-bus';
import type { HUDTemplate, HUDField } from '@/types';

// ============================================
// HUD Handler State
// ============================================

export interface HUDHandlerState {
  updatedFields: Map<string, Set<string>>; // messageKey -> set of fieldIds updated
}

export function createHUDHandlerState(): HUDHandlerState {
  return {
    updatedFields: new Map(),
  };
}

// ============================================
// HUD Trigger Context
// ============================================

export interface HUDTriggerContext extends TriggerContext {
  activeHUDTemplate: HUDTemplate | null;
  currentValues: Record<string, string | number | boolean>;
}

export interface HUDHandlerResult {
  matched: boolean;
  trigger: TriggerMatch;
  tokens: DetectedToken[];
}

// ============================================
// HUD Handler Functions
// ============================================

/**
 * Check HUD triggers - match HUD tokens to template fields
 * 
 * This function processes HUD tokens [key=value] and matches them
 * against the active HUD template fields.
 * 
 * Logic:
 * 1. Only process tokens of type 'hud'
 * 2. Match token.metadata.hudKey to field.key
 * 3. Validate value based on field type
 * 4. Return first valid match (HUD updates are immediate)
 */
export function checkHUDTriggers(
  tokens: DetectedToken[],
  context: HUDTriggerContext,
  state: HUDHandlerState
): HUDHandlerResult | null {
  const { activeHUDTemplate, currentValues } = context;
  
  // No active HUD template
  if (!activeHUDTemplate) {
    return null;
  }
  
  // Get already updated fields for this message
  const updatedForMessage = state.updatedFields.get(context.messageKey) ?? new Set();
  
  // Filter to only HUD tokens
  const hudTokens = tokens.filter(t => t.type === 'hud');
  
  for (const token of hudTokens) {
    const { hudKey, hudValue } = token.metadata || {};
    
    if (!hudKey || hudValue === undefined) continue;
    
    // Find matching field by key (case-insensitive)
    const field = activeHUDTemplate.fields.find(f => 
      normalizeKey(f.key) === normalizeKey(hudKey)
    );
    
    if (!field) continue;
    
    // Skip if already updated this field in this message
    if (updatedForMessage.has(field.id)) continue;
    
    // Validate and convert value based on field type
    const validatedValue = validateHUDValue(hudValue, field);
    
    if (validatedValue === null) continue;
    
    // Check if value actually changed
    const currentValue = currentValues[field.id];
    if (currentValue === validatedValue) continue;
    
    // Mark as updated
    updatedForMessage.add(field.id);
    state.updatedFields.set(context.messageKey, updatedForMessage);
    
    return {
      matched: true,
      trigger: {
        triggerId: `hud_${field.id}`,
        triggerType: 'hud',
        keyword: hudKey,
        data: {
          fieldId: field.id,
          fieldName: field.name,
          newValue: validatedValue,
          oldValue: currentValue,
        },
      },
      tokens: [token],
    };
  }
  
  return null;
}

/**
 * Execute HUD trigger - update the field value in store
 */
export function executeHUDTrigger(
  match: TriggerMatch,
  context: TriggerContext,
  storeActions: {
    updateHUDFieldValue: (fieldId: string, value: string | number | boolean) => void;
  }
): void {
  const { fieldId, newValue } = match.data as {
    fieldId: string;
    newValue: string | number | boolean;
  };
  
  storeActions.updateHUDFieldValue(fieldId, newValue);
}

/**
 * Reset state for new message
 */
export function resetHUDHandlerState(state: HUDHandlerState, messageKey: string): void {
  state.updatedFields.delete(messageKey);
}

// ============================================
// Helper Functions
// ============================================

/**
 * Normalize a key for matching (case-insensitive, trim)
 */
function normalizeKey(key: string): string {
  return (key ?? '').toString().trim().toLowerCase();
}

/**
 * Validate and convert a HUD value based on field type
 * Returns null if invalid
 */
function validateHUDValue(
  value: string,
  field: HUDField
): string | number | boolean | null {
  switch (field.type) {
    case 'number': {
      const num = Number(value);
      if (isNaN(num)) return null;
      
      // Clamp to min/max if defined
      const min = field.min ?? -Infinity;
      const max = field.max ?? Infinity;
      return Math.max(min, Math.min(max, num));
    }
    
    case 'enum': {
      // Case-insensitive match against options
      const normalized = value.toLowerCase().trim();
      const option = field.options?.find(o => o.toLowerCase() === normalized);
      return option || null;
    }
    
    case 'boolean': {
      const normalized = value.toLowerCase().trim();
      if (['true', '1', 'yes', 'on', 'sí', 'si'].includes(normalized)) return true;
      if (['false', '0', 'no', 'off'].includes(normalized)) return false;
      return null;
    }
    
    case 'string':
    default: {
      // Just return the trimmed string
      return value.trim();
    }
  }
}
