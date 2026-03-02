// ============================================
// Stats Handler - Pre-LLM resolution of stats keys
// ============================================
//
// This handler resolves {{key}} templates in character content
// and builds blocks for skills/intentions/invitations injection
//
// Keys resolved:
// - {{attributeKey}} → "AttributeName: value" (e.g., {{vida}} → "Vida: 50")
// - {{habilidades}} → Block of available skills
// - {{intenciones}} → Block of available intentions
// - {{invitaciones}} → Block of available invitations

import type {
  CharacterStatsConfig,
  SessionStats,
  CharacterSessionStats,
  AttributeDefinition,
  SkillDefinition,
  IntentionDefinition,
  InvitationDefinition,
  ResolvedStats,
} from '@/types';
import {
  evaluateRequirements,
  filterSkillsByRequirements,
  filterIntentionsByRequirements,
  filterInvitationsByRequirements,
} from '@/store/slices/statsSlice';

// ============================================
// Types
// ============================================

export interface StatsResolutionContext {
  characterId: string;
  statsConfig: CharacterStatsConfig | undefined;
  sessionStats: SessionStats | undefined;
}

export interface ResolvedAttribute {
  key: string;
  name: string;
  value: number | string;
  formatted: string;
}

// ============================================
// Main Resolution Functions
// ============================================

/**
 * Get character session stats
 */
export function getCharacterSessionStats(
  sessionStats: SessionStats | undefined,
  characterId: string
): CharacterSessionStats | null {
  if (!sessionStats?.characterStats?.[characterId]) {
    return null;
  }
  return sessionStats.characterStats[characterId];
}

/**
 * Get attribute value (from session or default)
 */
export function getAttributeValue(
  attribute: AttributeDefinition,
  sessionStats: CharacterSessionStats | null
): number | string {
  if (sessionStats?.attributeValues?.[attribute.key] !== undefined) {
    return sessionStats.attributeValues[attribute.key];
  }
  return attribute.defaultValue;
}

/**
 * Format attribute value for prompt
 */
export function formatAttributeValue(
  attribute: AttributeDefinition,
  value: number | string
): string {
  // Use new outputFormat field first
  if (attribute.outputFormat) {
    return attribute.outputFormat.replace('{value}', String(value));
  }
  // Fallback to legacy keywordFormat for backward compatibility
  if (attribute.keywordFormat) {
    return attribute.keywordFormat.replace('{value}', String(value));
  }
  return `${attribute.name}: ${value}`;
}

/**
 * Resolve a single attribute key
 */
export function resolveAttributeKey(
  key: string,
  statsConfig: CharacterStatsConfig | undefined,
  sessionStats: CharacterSessionStats | null
): string | null {
  if (!statsConfig?.attributes) return null;
  
  const attribute = statsConfig.attributes.find(a => a.key === key);
  if (!attribute) return null;
  
  const value = getAttributeValue(attribute, sessionStats);
  return formatAttributeValue(attribute, value);
}

/**
 * Resolve all attributes for a character
 */
export function resolveAllAttributes(
  statsConfig: CharacterStatsConfig | undefined,
  sessionStats: CharacterSessionStats | null
): ResolvedAttribute[] {
  if (!statsConfig?.attributes) return [];
  
  return statsConfig.attributes.map(attribute => {
    const value = getAttributeValue(attribute, sessionStats);
    return {
      key: attribute.key,
      name: attribute.name,
      value,
      formatted: formatAttributeValue(attribute, value),
    };
  });
}

/**
 * Build skills block for injection
 */
export function buildSkillsBlock(
  skills: SkillDefinition[],
  attributeValues: Record<string, number | string>,
  header: string
): string {
  const availableSkills = filterSkillsByRequirements(skills, attributeValues);
  
  if (availableSkills.length === 0) {
    return '';
  }
  
  const lines = availableSkills.map(skill => {
    if (skill.injectFormat) {
      return skill.injectFormat
        .replace('{name}', skill.name)
        .replace('{description}', skill.description);
    }
    return `- ${skill.name}: ${skill.description}`;
  });
  
  return `${header}\n${lines.join('\n')}`;
}

/**
 * Build intentions block for injection
 */
export function buildIntentionsBlock(
  intentions: IntentionDefinition[],
  attributeValues: Record<string, number | string>,
  header: string
): string {
  const availableIntentions = filterIntentionsByRequirements(intentions, attributeValues);
  
  if (availableIntentions.length === 0) {
    return '';
  }
  
  const lines = availableIntentions.map(intention => {
    return `- ${intention.name}: ${intention.description}`;
  });
  
  return `${header}\n${lines.join('\n')}`;
}

/**
 * Build invitations block for injection
 */
export function buildInvitationsBlock(
  invitations: InvitationDefinition[],
  attributeValues: Record<string, number | string>,
  header: string
): string {
  const availableInvitations = filterInvitationsByRequirements(invitations, attributeValues);
  
  if (availableInvitations.length === 0) {
    return '';
  }
  
  const lines = availableInvitations.map(invitation => {
    return `- ${invitation.name}: ${invitation.description}`;
  });
  
  return `${header}\n${lines.join('\n')}`;
}

/**
 * Full stats resolution for a character
 */
export function resolveStats(
  context: StatsResolutionContext
): ResolvedStats | null {
  const { characterId, statsConfig, sessionStats } = context;
  
  if (!statsConfig || !statsConfig.enabled) {
    return null;
  }
  
  const charStats = getCharacterSessionStats(sessionStats, characterId);
  
  // Resolve all attributes
  const attributes = resolveAllAttributes(statsConfig, charStats);
  const attributeValues = charStats?.attributeValues || 
    Object.fromEntries(
      statsConfig.attributes.map(a => [a.key, a.defaultValue])
    );
  
  // Build attribute map for template resolution
  const attributesMap: Record<string, string> = {};
  for (const attr of attributes) {
    attributesMap[attr.key] = attr.formatted;
  }
  
  // Build blocks
  const skillsBlock = buildSkillsBlock(
    statsConfig.skills,
    attributeValues,
    statsConfig.blockHeaders.skills
  );
  
  const intentionsBlock = buildIntentionsBlock(
    statsConfig.intentions,
    attributeValues,
    statsConfig.blockHeaders.intentions
  );
  
  const invitationsBlock = buildInvitationsBlock(
    statsConfig.invitations,
    attributeValues,
    statsConfig.blockHeaders.invitations
  );
  
  // Filter available items
  const availableSkills = filterSkillsByRequirements(statsConfig.skills, attributeValues);
  const availableIntentions = filterIntentionsByRequirements(statsConfig.intentions, attributeValues);
  const availableInvitations = filterInvitationsByRequirements(statsConfig.invitations, attributeValues);
  
  return {
    attributes: attributesMap,
    availableSkills,
    availableIntentions,
    availableInvitations,
    skillsBlock,
    intentionsBlock,
    invitationsBlock,
  };
}

// ============================================
// Template Resolution
// ============================================

/**
 * Regex pattern for stats keys
 * Matches {{key}} where key is alphanumeric with underscores
 */
const STATS_KEY_PATTERN = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;

/**
 * Check if a key is a block key (habilidades, intenciones, invitaciones)
 * Also accepts alternate spellings (intensiones) for backward compatibility
 */
export function isBlockKey(key: string): boolean {
  return key === 'habilidades' || key === 'intenciones' || key === 'intensiones' || key === 'invitaciones';
}

/**
 * Resolve all stats keys in a text
 */
export function resolveStatsInText(
  text: string,
  resolvedStats: ResolvedStats | null
): string {
  return text.replace(STATS_KEY_PATTERN, (match, key) => {
    // Block keys (habilidades, intenciones, invitaciones) - always handle these
    // Return empty string if stats disabled, empty, or no items available
    if (key === 'habilidades') {
      return resolvedStats?.skillsBlock ?? '';
    }
    // Accept both "intenciones" (correct Spanish) and "intensiones" (typo, for backward compatibility)
    if (key === 'intenciones' || key === 'intensiones') {
      return resolvedStats?.intentionsBlock ?? '';
    }
    if (key === 'invitaciones') {
      return resolvedStats?.invitationsBlock ?? '';
    }
    
    // Attribute keys - only replace if defined in stats config
    // If stats are disabled or attribute not defined, leave the key alone
    if (resolvedStats?.attributes && key in resolvedStats.attributes) {
      return resolvedStats.attributes[key];
    }
    
    // Unknown key - leave it alone (might be handled by other template systems)
    return match;
  });
}

/**
 * Get all stats keys from a text
 */
export function extractStatsKeys(text: string): string[] {
  const keys: string[] = [];
  let match;
  
  const pattern = new RegExp(STATS_KEY_PATTERN.source, 'g');
  
  while ((match = pattern.exec(text)) !== null) {
    if (!keys.includes(match[1])) {
      keys.push(match[1]);
    }
  }
  
  return keys;
}

/**
 * Check if text contains stats keys
 */
export function hasStatsKeys(text: string): boolean {
  STATS_KEY_PATTERN.lastIndex = 0;
  return STATS_KEY_PATTERN.test(text);
}

// ============================================
// Prompt Section Builder
// ============================================

/**
 * Build prompt sections from resolved stats
 */
export function buildStatsPromptSections(
  resolvedStats: ResolvedStats | null,
  characterName: string
): Array<{ type: string; label: string; content: string; color: string }> {
  if (!resolvedStats) return [];
  
  const sections: Array<{ type: string; label: string; content: string; color: string }> = [];
  
  // Add attributes section if there are any
  const attrValues = Object.values(resolvedStats.attributes);
  if (attrValues.length > 0) {
    sections.push({
      type: 'stats',
      label: `${characterName} Stats`,
      content: attrValues.join('\n'),
      color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    });
  }
  
  // Add skills block if available
  if (resolvedStats.skillsBlock) {
    sections.push({
      type: 'skills',
      label: 'Habilidades',
      content: resolvedStats.skillsBlock,
      color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    });
  }
  
  // Add intentions block if available
  if (resolvedStats.intentionsBlock) {
    sections.push({
      type: 'intentions',
      label: 'Intenciones',
      content: resolvedStats.intentionsBlock,
      color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
    });
  }
  
  // Add invitations block if available
  if (resolvedStats.invitationsBlock) {
    sections.push({
      type: 'invitations',
      label: 'Invitaciones',
      content: resolvedStats.invitationsBlock,
      color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
    });
  }
  
  return sections;
}
