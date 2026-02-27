/**
 * Prompt Template Utilities
 * Handles variable replacement for SillyTavern-style templates
 * 
 * Supported variables:
 * - {{user}} - User's name (from active persona)
 * - {{char}} - Character's name
 * - {{userpersona}} - User's persona description
 * - {{#if condition}}...{{/if}} - Conditional blocks (basic support)
 */

import type { CharacterCard, Persona } from '@/types';

export interface TemplateContext {
  user: string;
  char: string;
  userpersona?: string;
  character?: CharacterCard;
  persona?: Persona;
}

/**
 * Replace template variables in a string
 */
export function replaceTemplateVariables(
  text: string, 
  context: TemplateContext
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
 * Process conditional blocks {{#if var}}...{{/if}}
 */
function processConditionals(text: string, context: TemplateContext): string {
  // Handle {{#if variable}}content{{/if}}
  const conditionalRegex = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/gi;
  
  return text.replace(conditionalRegex, (_, varName, content) => {
    const value = getVariableValue(varName.toLowerCase(), context);
    return value ? content : '';
  });
}

/**
 * Get variable value by name
 */
function getVariableValue(varName: string, context: TemplateContext): string | undefined {
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

/**
 * Process all character text fields with template replacement
 */
export function processCharacterTemplate(
  character: CharacterCard, 
  userName: string = 'User',
  persona?: Persona
): CharacterCard {
  const context: TemplateContext = {
    user: userName,
    char: character.name,
    userpersona: persona?.description,
    character,
    persona
  };

  return {
    ...character,
    description: replaceTemplateVariables(character.description, context),
    personality: replaceTemplateVariables(character.personality, context),
    scenario: replaceTemplateVariables(character.scenario, context),
    firstMes: replaceTemplateVariables(character.firstMes, context),
    mesExample: replaceTemplateVariables(character.mesExample, context),
    systemPrompt: replaceTemplateVariables(character.systemPrompt, context),
    postHistoryInstructions: replaceTemplateVariables(character.postHistoryInstructions, context),
    characterNote: replaceTemplateVariables(character.characterNote, context),
    // Process alternate greetings
    alternateGreetings: character.alternateGreetings.map(greeting => 
      replaceTemplateVariables(greeting, context)
    )
  };
}

/**
 * Process a single message with template replacement
 */
export function processMessageTemplate(
  message: string,
  characterName: string,
  userName: string = 'User'
): string {
  const context: TemplateContext = {
    user: userName,
    char: characterName
  };

  return replaceTemplateVariables(message, context);
}

/**
 * Build context from store state
 */
export function buildTemplateContext(
  character: CharacterCard,
  persona?: Persona
): TemplateContext {
  return {
    user: persona?.name || 'User',
    char: character.name,
    userpersona: persona?.description,
    character,
    persona
  };
}
