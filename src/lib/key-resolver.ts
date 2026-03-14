// ============================================
// Unified Key Resolver - Single system for all template resolution
// ============================================
//
// This module unifies the resolution of ALL template keys:
// - Template variables: {{user}}, {{char}}, {{userpersona}}, {{description}}, etc.
// - Conditional blocks: {{#if}}, {{#user}}, {{#char}}
// - Stats keys: {{attributeKey}}, {{habilidades}}, {{intenciones}}, {{invitaciones}}
//
// The key resolution happens in two phases:
// 1. Template Phase: Resolve {{user}}, {{char}}, {{userpersona}}, conditionals
// 2. Stats Phase: Resolve attribute values and stat blocks
//
// This ensures that lorebooks injected after template processing
// still get their keys resolved properly.

import type { CharacterCard, Persona, SessionStats } from '@/types';
import type { ResolvedStats } from '@/types';
import { resolveStatsInText } from '@/lib/stats/stats-resolver';

// ============================================
// Types
// ============================================

/**
 * Context for key resolution
 * Contains all data needed to resolve any key type
 */
export interface KeyResolutionContext {
  // Basic template context
  user: string;
  char: string;
  userpersona?: string;

  // Character reference (for {{description}}, {{personality}}, etc.)
  character?: CharacterCard;
  persona?: Persona;

  // Stats resolution
  resolvedStats?: ResolvedStats | null;

  // Session stats for event keys ({{solicitante}}, {{solicitado}}, {{eventos}})
  sessionStats?: SessionStats | null;
  characterId?: string;  // ID of the current character for looking up solicitudes
}

// ============================================
// Phase 1: Template Variable Resolution
// ============================================

/**
 * Resolve template variables in text
 * Handles: {{user}}, {{char}}, {{userpersona}}, {{description}}, {{personality}}, {{scenario}}
 * Also handles conditionals: {{#if}}, {{#user}}, {{#char}}
 */
export function resolveTemplateVariables(
  text: string,
  context: KeyResolutionContext
): string {
  if (!text) return text;

  let result = text;

  // Basic variable replacements
  result = result.replace(/\{\{user\}\}/gi, context.user);
  result = result.replace(/\{\{char\}\}/gi, context.char);

  // User persona (if available)
  if (context.userpersona) {
    result = result.replace(/\{\{userpersona\}\}/gi, context.userpersona);
  } else {
    // Remove {{userpersona}} if not available
    result = result.replace(/\{\{userpersona\}\}/gi, '');
  }

  // Handle conditional blocks {{#if variable}}...{{/if}}
  result = processConditionals(result, context);

  // Handle {{#user}}...{{/user}} blocks (only show if user is set)
  result = result.replace(/\{\{#user\}\}([\s\S]*?)\{\{\/user\}\}/gi, (_, content) => {
    return context.user ? content : '';
  });

  // Handle {{#char}}...{{/char}} blocks (only show if char is set)
  result = result.replace(/\{\{#char\}\}([\s\S]*?)\{\{\/char\}\}/gi, (_, content) => {
    return context.char ? content : '';
  });

  // Character-specific variables
  if (context.character) {
    result = result.replace(/\{\{description\}\}/gi, context.character.description || '');
    result = result.replace(/\{\{personality\}\}/gi, context.character.personality || '');
    result = result.replace(/\{\{scenario\}\}/gi, context.character.scenario || '');
  }

  return result;
}

/**
 * Process conditional blocks {{#if var}}content{{/if}}
 */
function processConditionals(text: string, context: KeyResolutionContext): string {
  const conditionalRegex = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/gi;

  return text.replace(conditionalRegex, (_, varName, content) => {
    const value = getVariableValue(varName.toLowerCase(), context);
    return value ? content : '';
  });
}

/**
 * Get variable value by name
 */
function getVariableValue(varName: string, context: KeyResolutionContext): string | undefined {
  switch (varName) {
    case 'user':
      return context.user;
    case 'char':
      return context.char;
    case 'userpersona':
      return context.userpersona;
    case 'description':
      return context.character?.description;
    case 'personality':
      return context.character?.personality;
    case 'scenario':
      return context.character?.scenario;
    default:
      return undefined;
  }
}

// ============================================
// Phase 2: Stats Key Resolution
// ============================================

/**
 * Resolve stats keys in text
 * Delegates to stats-resolver module
 * Handles: {{attributeKey}}, {{habilidades}}, {{intenciones}}, {{invitaciones}}
 */
export function resolveStatsKeys(
  text: string,
  resolvedStats: ResolvedStats | null | undefined
): string {
  return resolveStatsInText(text, resolvedStats ?? null);
}

// ============================================
// Phase 3: Event Key Resolution
// ============================================

/**
 * Resolve event keys in text
 * Handles: {{solicitante}}, {{solicitado}}, {{eventos}}
 *
 * {{solicitante}} - Name of who made the solicitud (from pending solicitudes)
 * {{solicitado}} - Name of who received the solicitud (current character)
 * {{eventos}} - Recent events summary
 */
export function resolveEventKeys(
  text: string,
  context: KeyResolutionContext
): string {
  if (!text) return text;

  let result = text;
  const { sessionStats, characterId, char } = context;

  // {{solicitante}} - Who made the solicitud
  if (sessionStats?.solicitudes?.characterSolicitudes && characterId) {
    const pendingSolicitudes = sessionStats.solicitudes.characterSolicitudes[characterId]
      ?.filter(s => s.status === 'pending') || [];
    
    if (pendingSolicitudes.length > 0) {
      // Get the name of the first pending solicitud's sender
      const solicitante = pendingSolicitudes[0].fromCharacterName;
      result = result.replace(/\{\{solicitante\}\}/gi, solicitante);
    } else {
      // No pending solicitudes - replace with empty string
      result = result.replace(/\{\{solicitante\}\}/gi, '');
    }
  } else {
    result = result.replace(/\{\{solicitante\}\}/gi, '');
  }

  // {{solicitado}} - Who received the solicitud (current character)
  // This is always the current character's name
  if (char) {
    result = result.replace(/\{\{solicitado\}\}/gi, char);
  } else {
    result = result.replace(/\{\{solicitado\}\}/gi, '');
  }

  // {{eventos}} - Recent events summary
  if (sessionStats) {
    console.log(`[resolveEventKeys] sessionStats received for {{eventos}}:`, {
      hasUltimoObjetivo: !!sessionStats.ultimo_objetivo_completado,
      hasUltimaSolicitudRealizada: !!sessionStats.ultima_solicitud_realizada,
      hasUltimaSolicitudCompletada: !!sessionStats.ultima_solicitud_completada,
      hasUltimaAccion: !!sessionStats.ultima_accion_realizada,
      ultimoObjetivoValue: sessionStats.ultimo_objetivo_completado,
      ultimaSolicitudRealizadaValue: sessionStats.ultima_solicitud_realizada,
    });
    const eventosBlock = buildEventosBlock(sessionStats);
    console.log(`[resolveEventKeys] Built eventosBlock:`, eventosBlock);
    result = result.replace(/\{\{eventos\}\}/gi, eventosBlock);
  } else {
    console.log(`[resolveEventKeys] No sessionStats provided for {{eventos}}`);
    result = result.replace(/\{\{eventos\}\}/gi, '');
  }

  return result;
}

/**
 * Build the eventos block showing recent events
 * Only shows fields that have actual values (not undefined or empty)
 * Format:
 * [ESTADO RECIENTE]
 * - ultimo_objetivo_completado : <value>
 * - ultima_solicitud_realizada : <value>
 * - ultima_solicitud_completada : <value>
 * - ultima_accion_realizada : <value>
 */
function buildEventosBlock(sessionStats: SessionStats): string {
  const lines: string[] = [];
  
  // Only add fields that have actual values
  if (sessionStats.ultimo_objetivo_completado) {
    lines.push(`- ultimo_objetivo_completado : ${sessionStats.ultimo_objetivo_completado}`);
  }
  
  if (sessionStats.ultima_solicitud_realizada) {
    lines.push(`- ultima_solicitud_realizada : ${sessionStats.ultima_solicitud_realizada}`);
  }
  
  if (sessionStats.ultima_solicitud_completada) {
    lines.push(`- ultima_solicitud_completada : ${sessionStats.ultima_solicitud_completada}`);
  }
  
  if (sessionStats.ultima_accion_realizada) {
    lines.push(`- ultima_accion_realizada : ${sessionStats.ultima_accion_realizada}`);
  }
  
  // Return empty string if no events to show
  if (lines.length === 0) {
    return '';
  }
  
  return `[ESTADO RECIENTE]\n${lines.join('\n')}`;
}

// ============================================
// Unified Resolution
// ============================================

/**
 * Resolve ALL keys in text in the correct order
 *
 * Phase 1: Template variables ({{user}}, {{char}}, conditionals)
 * Phase 2: Stats keys ({{resistencia}}, {{habilidades}}, etc.)
 * Phase 3: Event keys ({{solicitante}}, {{solicitado}}, {{eventos}})
 *
 * This is the main function to use for resolving all keys
 */
export function resolveAllKeys(
  text: string,
  context: KeyResolutionContext
): string {
  if (!text) return text;

  // Phase 1: Resolve template variables
  let result = resolveTemplateVariables(text, context);

  // Phase 2: Resolve stats keys
  result = resolveStatsKeys(result, context.resolvedStats);

  // Phase 3: Resolve event keys
  result = resolveEventKeys(result, context);

  return result;
}

/**
 * Resolve all keys with multiple passes
 *
 * Sometimes, after resolving keys, new content may be injected
 * (e.g., lorebooks that contain {{user}} or stats keys)
 * This function runs resolution multiple times to catch those cases
 *
 * @param text - Text to resolve
 * @param context - Resolution context
 * @param maxPasses - Maximum number of resolution passes (default: 2)
 */
export function resolveAllKeysWithPasses(
  text: string,
  context: KeyResolutionContext,
  maxPasses: number = 2
): string {
  if (!text) return text;

  let result = text;
  let previousResult = '';

  for (let i = 0; i < maxPasses; i++) {
    result = resolveAllKeys(result, context);

    // If nothing changed, we're done
    if (result === previousResult) {
      break;
    }
    previousResult = result;
  }

  return result;
}

// ============================================
// Context Builders
// ============================================

/**
 * Build a key resolution context from character and persona
 */
export function buildKeyResolutionContext(
  character: CharacterCard,
  userName: string = 'User',
  persona?: Persona,
  resolvedStats?: ResolvedStats | null,
  sessionStats?: SessionStats | null
): KeyResolutionContext {
  return {
    user: persona?.name || userName,
    char: character.name,
    userpersona: persona?.description,
    character,
    persona,
    resolvedStats,
    sessionStats,
    characterId: character.id,
  };
}

/**
 * Build a key resolution context for group chat
 * Uses the responding character as the main character
 */
export function buildGroupKeyResolutionContext(
  character: CharacterCard,
  userName: string = 'User',
  persona?: Persona,
  resolvedStats?: ResolvedStats | null,
  sessionStats?: SessionStats | null
): KeyResolutionContext {
  return buildKeyResolutionContext(character, userName, persona, resolvedStats, sessionStats);
}

// ============================================
// Convenience Functions for Character Processing
// ============================================

/**
 * Process all character text fields with unified key resolution
 * This replaces processCharacterTemplate from prompt-template.ts
 */
export function processCharacterKeys(
  character: CharacterCard,
  userName: string = 'User',
  persona?: Persona,
  resolvedStats?: ResolvedStats | null
): CharacterCard {
  const context = buildKeyResolutionContext(character, userName, persona, resolvedStats);

  return {
    ...character,
    description: resolveAllKeys(character.description, context),
    personality: resolveAllKeys(character.personality, context),
    scenario: resolveAllKeys(character.scenario, context),
    firstMes: resolveAllKeys(character.firstMes, context),
    mesExample: resolveAllKeys(character.mesExample, context),
    systemPrompt: resolveAllKeys(character.systemPrompt, context),
    postHistoryInstructions: resolveAllKeys(character.postHistoryInstructions, context),
    characterNote: resolveAllKeys(character.characterNote, context),
    // Process alternate greetings
    alternateGreetings: character.alternateGreetings.map(greeting =>
      resolveAllKeys(greeting, context)
    )
  };
}

/**
 * Process a single message with key resolution
 */
export function processMessageKeys(
  message: string,
  characterName: string,
  userName: string = 'User',
  resolvedStats?: ResolvedStats | null
): string {
  const context: KeyResolutionContext = {
    user: userName,
    char: characterName,
    resolvedStats,
  };

  return resolveAllKeys(message, context);
}

// ============================================
// Section Processing
// ============================================

import type { PromptSection } from '@/types';

/**
 * Resolve all keys in a prompt section
 */
export function resolveSectionKeys(
  section: PromptSection,
  context: KeyResolutionContext
): PromptSection {
  return {
    ...section,
    content: resolveAllKeys(section.content, context)
  };
}

/**
 * Resolve all keys in multiple prompt sections
 */
export function resolveSectionsKeys(
  sections: PromptSection[],
  context: KeyResolutionContext
): PromptSection[] {
  return sections.map(section => resolveSectionKeys(section, context));
}

/**
 * Resolve all keys in sections with multiple passes
 * Useful for sections that may contain dynamically injected content
 */
export function resolveSectionsKeysWithPasses(
  sections: PromptSection[],
  context: KeyResolutionContext,
  maxPasses: number = 2
): PromptSection[] {
  return sections.map(section => ({
    ...section,
    content: resolveAllKeysWithPasses(section.content, context, maxPasses)
  }));
}
