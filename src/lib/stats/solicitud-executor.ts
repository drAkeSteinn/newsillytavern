// ============================================
// Solicitud Executor - Peticiones/Solicitudes Activation & Completion
// ============================================
//
// This module handles:
// 1. Activation: When a peticion's key is detected in LLM response,
//    create a solicitud for the target character
// 2. Completion: When a solicitud's key is detected, mark it as completed
//
// NEW FLOW:
// - Character A has an Invitation (Peticion) pointing to Character B's SolicitudDefinition
// - The activation key comes from SolicitudDefinition.peticionKey (on Character B)
// - When LLM writes that key in Character A's response, a SolicitudInstance is created
// - Character B sees the solicitud with SolicitudDefinition.solicitudKey
// - LLM writes the solicitudKey in Character B's response to complete it

import type {
  CharacterStatsConfig,
  InvitationDefinition,
  SolicitudDefinition,
  SolicitudInstance,
  SessionStats,
  CharacterCard,
  StatRequirement,
  Persona,
} from '@/types';

// Special ID for the user
export const USER_CHARACTER_ID = '__user__';

// ============================================
// Types
// ============================================

export interface SolicitudActivationContext {
  sessionId: string;
  characterId: string;           // Character who sent the peticion
  characterName: string;
  statsConfig: CharacterStatsConfig | undefined;
  sessionStats: SessionStats | undefined;
  allCharacters: CharacterCard[]; // To look up target characters and their solicitudes
  activePersona?: Persona;        // For when target is the user
}

export interface SolicitudCompletionContext {
  sessionId: string;
  characterId: string;           // Character who received the solicitud
  sessionStats: SessionStats | undefined;
}

export interface SolicitudStoreActions {
  createSolicitud: (
    sessionId: string,
    targetCharacterId: string,
    solicitud: Omit<SolicitudInstance, 'id' | 'createdAt' | 'status'>
  ) => SolicitudInstance | null;
  
  completeSolicitud: (
    sessionId: string,
    characterId: string,
    solicitudKey: string
  ) => SolicitudInstance | null;
}

export interface ResolvedPeticion {
  invitation: InvitationDefinition;
  peticionKey: string;
  peticionDescription: string;
  solicitudKey: string;
  solicitudDescription: string;
  targetCharacterId: string;
  targetCharacterName: string;
  solicitudId: string;
}

export interface SolicitudActivationResult {
  activated: boolean;
  peticionKey: string;
  targetCharacterId: string | null;
  targetCharacterName: string | null;
  solicitud: SolicitudInstance | null;
}

export interface SolicitudCompletionResult {
  completed: boolean;
  solicitudKey: string;
  fromCharacterName: string | null;
  solicitud: SolicitudInstance | null;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Evaluate requirements against attribute values
 */
function evaluateRequirements(
  requirements: StatRequirement[],
  attributeValues: Record<string, number | string>
): boolean {
  if (!requirements || requirements.length === 0) {
    return true;
  }
  
  return requirements.every(req => {
    const currentValue = attributeValues[req.attributeKey];
    if (currentValue === undefined) return false;
    
    const currentNum = typeof currentValue === 'number' 
      ? currentValue 
      : parseFloat(String(currentValue));
    const reqNum = typeof req.value === 'number' 
      ? req.value 
      : parseFloat(String(req.value));
    
    if (isNaN(currentNum) || isNaN(reqNum)) {
      return String(currentValue) === String(req.value);
    }
    
    switch (req.operator) {
      case '<': return currentNum < reqNum;
      case '<=': return currentNum <= reqNum;
      case '>': return currentNum > reqNum;
      case '>=': return currentNum >= reqNum;
      case '==': return currentNum === reqNum;
      case '!=': return currentNum !== reqNum;
      case 'between':
        const maxNum = typeof req.valueMax === 'number' 
          ? req.valueMax 
          : parseFloat(String(req.valueMax || 0));
        return currentNum >= reqNum && currentNum <= maxNum;
      default: return false;
    }
  });
}

/**
 * Get resolved peticiones for a character
 * Returns invitations with their actual activation keys from target's solicitudes
 * 
 * Supports special target '__user__' for user-directed peticiones
 */
export function getResolvedPeticiones(
  statsConfig: CharacterStatsConfig | undefined,
  attributeValues: Record<string, number | string>,
  allCharacters: CharacterCard[],
  sessionStats: SessionStats | undefined,
  activePersona?: Persona
): ResolvedPeticion[] {
  if (!statsConfig?.enabled || !statsConfig.invitations) {
    return [];
  }
  
  const resolved: ResolvedPeticion[] = [];
  
  for (const invitation of statsConfig.invitations) {
    // Skip if no target configured
    if (!invitation.objetivo?.characterId || !invitation.objetivo?.solicitudId) {
      continue;
    }
    
    // Check invitation requirements (the sender must meet these)
    if (!evaluateRequirements(invitation.requirements, attributeValues)) {
      continue;
    }
    
    // Special case: target is the user
    if (invitation.objetivo.characterId === USER_CHARACTER_ID) {
      // Find the solicitud on the user's persona
      const solicitud = activePersona?.statsConfig?.solicitudDefinitions?.find(
        s => s.id === invitation.objetivo!.solicitudId
      );
      
      if (!solicitud) {
        continue;
      }
      
      // For user, we don't check requirements (user can always receive)
      // Or we could check user attributes if they had any
      
      resolved.push({
        invitation,
        peticionKey: solicitud.peticionKey,
        peticionDescription: solicitud.peticionDescription,
        solicitudKey: solicitud.solicitudKey,
        solicitudDescription: solicitud.solicitudDescription,
        targetCharacterId: USER_CHARACTER_ID,
        targetCharacterName: activePersona?.name || 'Usuario',
        solicitudId: solicitud.id,
      });
      continue;
    }
    
    // Normal case: find target character
    const targetCharacter = allCharacters.find(c => c.id === invitation.objetivo!.characterId);
    if (!targetCharacter) {
      continue;
    }
    
    // Find the solicitud on the target
    const solicitud = targetCharacter.statsConfig?.solicitudDefinitions?.find(
      s => s.id === invitation.objetivo!.solicitudId
    );
    if (!solicitud) {
      continue;
    }
    
    // Check if target meets the solicitud's requirements
    const targetAttributeValues = sessionStats?.characterStats?.[targetCharacter.id]?.attributeValues || {};
    if (!evaluateRequirements(solicitud.requirements, targetAttributeValues)) {
      continue;
    }
    
    resolved.push({
      invitation,
      peticionKey: solicitud.peticionKey,
      peticionDescription: solicitud.peticionDescription,
      solicitudKey: solicitud.solicitudKey,
      solicitudDescription: solicitud.solicitudDescription,
      targetCharacterId: targetCharacter.id,
      targetCharacterName: targetCharacter.name,
      solicitudId: solicitud.id,
    });
  }
  
  return resolved;
}

// ============================================
// Activation Detection (Peticion Key → Create Solicitud)
// ============================================

/**
 * Build regex pattern to detect peticion keys
 */
export function buildPeticionKeyPattern(
  resolvedPeticiones: ResolvedPeticion[],
  caseSensitive: boolean = false
): RegExp | null {
  if (resolvedPeticiones.length === 0) return null;
  
  const keys = resolvedPeticiones
    .map(p => p.peticionKey)
    .filter(Boolean)
    .map(key => key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  
  if (keys.length === 0) return null;
  
  // Match: [key], key after = or :, or key as a word
  // This handles formats like: [pedir_madera], Peticion=pedir_madera, pedir_madera:
  const patternStr = `(?:\\[(${keys.join('|')})\\]|[=:]\\s*(${keys.join('|')})\\b|\\b(${keys.join('|')})\\b)`;
  
  try {
    return new RegExp(patternStr, caseSensitive ? 'g' : 'gi');
  } catch {
    return null;
  }
}

/**
 * Detect peticion activations in text
 * Returns list of peticiones that should create solicitudes
 */
export function detectPeticionActivations(
  text: string,
  context: SolicitudActivationContext
): SolicitudActivationResult[] {
  const results: SolicitudActivationResult[] = [];
  
  if (!context.statsConfig?.enabled) {
    return results;
  }
  
  // Get current attribute values
  const attributeValues = context.sessionStats?.characterStats?.[context.characterId]?.attributeValues || {};
  
  // Get resolved peticiones (with keys from target's solicitudes)
  const resolvedPeticiones = getResolvedPeticiones(
    context.statsConfig,
    attributeValues,
    context.allCharacters,
    context.sessionStats,
    context.activePersona
  );
  
  if (resolvedPeticiones.length === 0) {
    return results;
  }
  
  // Build pattern and detect
  const pattern = buildPeticionKeyPattern(resolvedPeticiones);
  if (!pattern) return results;
  
  const detectedKeys = new Set<string>();
  let match;
  
  while ((match = pattern.exec(text)) !== null) {
    const key = match[1] || match[2] || match[3]; // [key], key after =/:, or bare key
    if (key && !detectedKeys.has(key.toLowerCase())) {
      detectedKeys.add(key.toLowerCase());
    }
  }
  
  // For each detected key, find the matching peticion
  for (const detectedKey of detectedKeys) {
    const resolved = resolvedPeticiones.find(
      p => p.peticionKey.toLowerCase() === detectedKey
    );
    
    if (!resolved) continue;
    
    results.push({
      activated: false, // Will be set by executeActivation
      peticionKey: resolved.peticionKey,
      targetCharacterId: resolved.targetCharacterId,
      targetCharacterName: resolved.targetCharacterName,
      solicitud: null, // Will be filled by executeActivation
    });
  }
  
  return results;
}

/**
 * Execute peticion activation - create solicitud for target character
 */
export function executePeticionActivation(
  activation: SolicitudActivationResult,
  context: SolicitudActivationContext,
  storeActions: SolicitudStoreActions
): SolicitudActivationResult {
  if (!activation.targetCharacterId) {
    return {
      ...activation,
      activated: false,
    };
  }
  
  // Find the target character and its solicitud definition
  // Find the invitation that triggered this
  const attributeValues = context.sessionStats?.characterStats?.[context.characterId]?.attributeValues || {};
  const resolvedPeticiones = getResolvedPeticiones(
    context.statsConfig,
    attributeValues,
    context.allCharacters,
    context.sessionStats,
    context.activePersona
  );
  
  const resolved = resolvedPeticiones.find(
    p => p.peticionKey === activation.peticionKey && p.targetCharacterId === activation.targetCharacterId
  );
  
  if (!resolved) {
    return {
      ...activation,
      activated: false,
    };
  }
  
  // Special case: target is the user (__user__)
  // Create solicitud in user's pending list
  if (activation.targetCharacterId === USER_CHARACTER_ID) {
    const solicitud = storeActions.createSolicitud(
      context.sessionId,
      USER_CHARACTER_ID,
      {
        key: resolved.solicitudKey,
        fromCharacterId: context.characterId,
        fromCharacterName: context.characterName,
        description: resolved.solicitudDescription,
      }
    );
    
    return {
      ...activation,
      activated: !!solicitud,
      solicitud,
    };
  }
  
  // Normal case: target is a character
  const targetCharacter = context.allCharacters.find(c => c.id === activation.targetCharacterId);
  if (!targetCharacter) {
    return {
      ...activation,
      activated: false,
    };
  }
  
  // Create the solicitud for the target character
  // Use solicitudKey for completion detection
  const solicitud = storeActions.createSolicitud(
    context.sessionId,
    activation.targetCharacterId,
    {
      key: resolved.solicitudKey,  // Key the target will use to complete
      fromCharacterId: context.characterId,
      fromCharacterName: context.characterName,
      description: resolved.solicitudDescription,
    }
  );
  
  return {
    ...activation,
    activated: !!solicitud,
    solicitud,
  };
}

// ============================================
// Completion Detection (Solicitud Key → Mark Completed)
// ============================================

/**
 * Build regex pattern to detect solicitud keys
 */
export function buildSolicitudKeyPattern(
  solicitudes: SolicitudInstance[],
  caseSensitive: boolean = false
): RegExp | null {
  if (solicitudes.length === 0) return null;
  
  const keys = solicitudes
    .map(s => s.key)
    .filter(Boolean)
    .map(key => key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  
  if (keys.length === 0) return null;
  
  // Match: [key], key after = or :, or key as a word
  // This handles formats like: [pedir_madera], Peticion=pedir_madera, pedir_madera:
  const patternStr = `(?:\\[(${keys.join('|')})\\]|[=:]\\s*(${keys.join('|')})\\b|\\b(${keys.join('|')})\\b)`;
  
  try {
    return new RegExp(patternStr, caseSensitive ? 'g' : 'gi');
  } catch {
    return null;
  }
}

/**
 * Detect solicitud completions in text
 * Returns list of solicitudes that should be marked as completed
 */
export function detectSolicitudCompletions(
  text: string,
  context: SolicitudCompletionContext
): SolicitudCompletionResult[] {
  const results: SolicitudCompletionResult[] = [];
  
  // Get pending solicitudes for this character
  const pendingSolicitudes = context.sessionStats?.solicitudes?.characterSolicitudes?.[context.characterId]
    ?.filter(s => s.status === 'pending') || [];
  
  if (pendingSolicitudes.length === 0) {
    return results;
  }
  
  // Build pattern and detect
  const pattern = buildSolicitudKeyPattern(pendingSolicitudes);
  if (!pattern) return results;
  
  const detectedKeys = new Set<string>();
  let match;
  
  while ((match = pattern.exec(text)) !== null) {
    const key = match[1] || match[2] || match[3];
    if (key && !detectedKeys.has(key.toLowerCase())) {
      detectedKeys.add(key.toLowerCase());
    }
  }
  
  // For each detected key, find the matching solicitud
  for (const detectedKey of detectedKeys) {
    const solicitud = pendingSolicitudes.find(
      s => s.key.toLowerCase() === detectedKey
    );
    
    if (solicitud) {
      results.push({
        completed: false,
        solicitudKey: solicitud.key,
        fromCharacterName: solicitud.fromCharacterName,
        solicitud: null, // Will be filled by executeCompletion
      });
    }
  }
  
  return results;
}

/**
 * Execute solicitud completion - mark as completed
 */
export function executeSolicitudCompletion(
  completion: SolicitudCompletionResult,
  context: SolicitudCompletionContext,
  storeActions: SolicitudStoreActions
): SolicitudCompletionResult {
  const solicitud = storeActions.completeSolicitud(
    context.sessionId,
    context.characterId,
    completion.solicitudKey
  );
  
  return {
    ...completion,
    completed: !!solicitud,
    solicitud,
  };
}

// ============================================
// Combined Detection & Execution
// ============================================

export interface SolicitudProcessingResult {
  activations: SolicitudActivationResult[];
  completions: SolicitudCompletionResult[];
  hasChanges: boolean;
}

/**
 * Process text for both peticion activations and solicitud completions
 * This is the main entry point for post-LLM processing
 */
export function processSolicitudes(
  text: string,
  context: SolicitudActivationContext,
  storeActions: SolicitudStoreActions
): SolicitudProcessingResult {
  // Detect and execute activations (peticiones)
  const activationDetections = detectPeticionActivations(text, context);
  const activations = activationDetections.map(activation =>
    executePeticionActivation(activation, context, storeActions)
  );
  
  // Detect and execute completions (solicitudes)
  const completionContext: SolicitudCompletionContext = {
    sessionId: context.sessionId,
    characterId: context.characterId,
    sessionStats: context.sessionStats,
  };
  const completionDetections = detectSolicitudCompletions(text, completionContext);
  const completions = completionDetections.map(completion =>
    executeSolicitudCompletion(completion, completionContext, storeActions)
  );
  
  const hasChanges = 
    activations.some(a => a.activated) || 
    completions.some(c => c.completed);
  
  return {
    activations,
    completions,
    hasChanges,
  };
}

// ============================================
// Streaming Support
// ============================================

/**
 * State for tracking processed solicitudes during streaming
 */
export class SolicitudDetectionState {
  private processedActivations: Set<string> = new Set(); // peticion keys
  private processedCompletions: Set<string> = new Set(); // solicitud keys
  private processedLength: number = 0;
  
  /**
   * Process new text incrementally
   */
  processNewText(
    newText: string,
    context: SolicitudActivationContext,
    storeActions: SolicitudStoreActions
  ): SolicitudProcessingResult {
    // Only process new content
    const newContent = newText.slice(this.processedLength);
    this.processedLength = newText.length;
    
    if (!newContent.trim()) {
      return { activations: [], completions: [], hasChanges: false };
    }
    
    // Get current attribute values
    const attributeValues = context.sessionStats?.characterStats?.[context.characterId]?.attributeValues || {};
    const resolvedPeticiones = getResolvedPeticiones(
      context.statsConfig,
      attributeValues,
      context.allCharacters,
      context.sessionStats,
      context.activePersona
    );
    
    // Filter out already processed peticion keys
    const unprocessedPeticiones = resolvedPeticiones.filter(
      p => !this.processedActivations.has(p.peticionKey.toLowerCase())
    );
    
    // Detect new activations
    const pattern = buildPeticionKeyPattern(unprocessedPeticiones);
    const newActivations: SolicitudActivationResult[] = [];
    
    if (pattern) {
      let match;
      while ((match = pattern.exec(newContent)) !== null) {
        const key = (match[1] || match[2] || match[3]).toLowerCase();
        if (!this.processedActivations.has(key)) {
          this.processedActivations.add(key);
          
          const resolved = resolvedPeticiones.find(
            p => p.peticionKey.toLowerCase() === key
          );
          
          if (resolved) {
            const result = executePeticionActivation(
              {
                activated: false,
                peticionKey: resolved.peticionKey,
                targetCharacterId: resolved.targetCharacterId,
                targetCharacterName: resolved.targetCharacterName,
                solicitud: null,
              },
              context,
              storeActions
            );
            
            newActivations.push(result);
          }
        }
      }
    }
    
    // Get pending solicitudes and filter out already processed
    const pendingSolicitudes = context.sessionStats?.solicitudes?.characterSolicitudes?.[context.characterId]
      ?.filter(s => s.status === 'pending' && !this.processedCompletions.has(s.key.toLowerCase())) || [];
    
    // Detect new completions
    const completionPattern = buildSolicitudKeyPattern(pendingSolicitudes);
    const newCompletions: SolicitudCompletionResult[] = [];
    
    if (completionPattern) {
      let match;
      while ((match = completionPattern.exec(newContent)) !== null) {
        const key = (match[1] || match[2] || match[3]).toLowerCase();
        if (!this.processedCompletions.has(key)) {
          this.processedCompletions.add(key);
          
          const solicitud = pendingSolicitudes.find(
            s => s.key.toLowerCase() === key
          );
          
          if (solicitud) {
            const result = executeSolicitudCompletion(
              {
                completed: false,
                solicitudKey: solicitud.key,
                fromCharacterName: solicitud.fromCharacterName,
                solicitud: null,
              },
              {
                sessionId: context.sessionId,
                characterId: context.characterId,
                sessionStats: context.sessionStats,
              },
              storeActions
            );
            
            newCompletions.push(result);
          }
        }
      }
    }
    
    const hasChanges = 
      newActivations.some(a => a.activated) || 
      newCompletions.some(c => c.completed);
    
    return {
      activations: newActivations,
      completions: newCompletions,
      hasChanges,
    };
  }
  
  /**
   * Reset state for new message
   */
  reset(): void {
    this.processedActivations.clear();
    this.processedCompletions.clear();
    this.processedLength = 0;
  }
}

/**
 * Create a new solicitud detection state
 */
export function createSolicitudDetectionState(): SolicitudDetectionState {
  return new SolicitudDetectionState();
}
