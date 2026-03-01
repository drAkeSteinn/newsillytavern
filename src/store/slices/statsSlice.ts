// ============================================
// Stats Slice - Character stats management
// ============================================

import type { 
  SessionStats, 
  CharacterSessionStats, 
  StatChangeLogEntry,
  CharacterStatsConfig,
  AttributeDefinition,
  SkillDefinition,
  IntentionDefinition,
  InvitationDefinition,
  StatRequirement
} from '@/types';

// ============================================
// Types
// ============================================

export interface StatsSlice {
  // Session stats state (values per session)
  sessionStats: SessionStats | null;
  
  // Session Stats Actions
  initializeSessionStats: (
    sessionId: string,
    characters: Array<{ id: string; statsConfig?: CharacterStatsConfig }>
  ) => void;
  
  updateCharacterStat: (
    sessionId: string,
    characterId: string,
    attributeKey: string,
    value: number | string,
    reason?: 'llm_detection' | 'manual' | 'trigger' | 'initialization'
  ) => void;
  
  batchUpdateCharacterStats: (
    sessionId: string,
    characterId: string,
    updates: Array<{ attributeKey: string; value: number | string }>,
    reason?: 'llm_detection' | 'manual' | 'trigger'
  ) => void;
  
  resetCharacterStats: (
    sessionId: string,
    characterId: string,
    statsConfig?: CharacterStatsConfig
  ) => void;
  
  clearSessionStats: (sessionId: string) => void;
  
  // Getters
  getCharacterStats: (sessionId: string, characterId: string) => CharacterSessionStats | null;
  getAttributeValue: (sessionId: string, characterId: string, attributeKey: string) => number | string | null;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Create default character stats from config
 */
function createDefaultCharacterStats(
  statsConfig?: CharacterStatsConfig
): CharacterSessionStats {
  const attributeValues: Record<string, number | string> = {};
  const lastUpdated: Record<string, number> = {};
  const now = Date.now();
  
  if (statsConfig?.attributes) {
    for (const attr of statsConfig.attributes) {
      attributeValues[attr.key] = attr.defaultValue;
      lastUpdated[attr.key] = now;
    }
  }
  
  return {
    attributeValues,
    lastUpdated,
    changeLog: [],
  };
}

/**
 * Add entry to change log
 */
function addChangeLogEntry(
  stats: CharacterSessionStats,
  attribute: AttributeDefinition | undefined,
  attributeKey: string,
  oldValue: number | string | undefined,
  newValue: number | string,
  reason: StatChangeLogEntry['reason']
): void {
  if (!stats.changeLog) {
    stats.changeLog = [];
  }
  
  stats.changeLog.push({
    attributeId: attribute?.id || attributeKey,
    attributeKey,
    attributeName: attribute?.name || attributeKey,
    oldValue: oldValue ?? '',
    newValue,
    reason,
    timestamp: Date.now(),
  });
  
  // Keep only last 100 entries
  if (stats.changeLog.length > 100) {
    stats.changeLog = stats.changeLog.slice(-100);
  }
}

// ============================================
// Slice Factory
// ============================================

export const createStatsSlice = (set: any, get: any): StatsSlice => ({
  // Initial State
  sessionStats: null,

  // ============================================
  // Session Stats Actions
  // ============================================

  initializeSessionStats: (sessionId, characters) => {
    const state = get();
    const sessions = state.sessions as Array<{ id: string; sessionStats?: SessionStats }>;
    const session = sessions.find(s => s.id === sessionId);
    
    if (!session) return;
    
    // Check if already initialized
    if (session.sessionStats?.initialized) return;
    
    const now = Date.now();
    const characterStats: Record<string, CharacterSessionStats> = {};
    
    // Initialize stats for each character
    for (const char of characters) {
      characterStats[char.id] = createDefaultCharacterStats(char.statsConfig);
    }
    
    const newSessionStats: SessionStats = {
      characterStats,
      initialized: true,
      lastModified: now,
    };
    
    // Update session with new stats
    set((state: any) => ({
      sessions: state.sessions.map((s: any) =>
        s.id === sessionId 
          ? { ...s, sessionStats: newSessionStats, updatedAt: new Date().toISOString() }
          : s
      ),
    }));
  },

  updateCharacterStat: (sessionId, characterId, attributeKey, value, reason = 'manual') => {
    set((state: any) => {
      const sessions = state.sessions as Array<{ 
        id: string; 
        sessionStats?: SessionStats;
        characterId?: string;
        groupId?: string;
      }>;
      const session = sessions.find(s => s.id === sessionId);
      
      if (!session?.sessionStats) return state;
      
      const stats = session.sessionStats.characterStats[characterId];
      if (!stats) return state;
      
      const oldValue = stats.attributeValues[attributeKey];
      
      // Find attribute definition for logging
      const character = state.characters.find((c: any) => c.id === characterId);
      const attributeDef = character?.statsConfig?.attributes?.find(
        (a: AttributeDefinition) => a.key === attributeKey
      );
      
      // Update the value
      const updatedCharacterStats = {
        ...session.sessionStats.characterStats,
        [characterId]: {
          ...stats,
          attributeValues: {
            ...stats.attributeValues,
            [attributeKey]: value,
          },
          lastUpdated: {
            ...stats.lastUpdated,
            [attributeKey]: Date.now(),
          },
        },
      };
      
      // Add to change log
      addChangeLogEntry(
        updatedCharacterStats[characterId],
        attributeDef,
        attributeKey,
        oldValue,
        value,
        reason
      );
      
      const newSessionStats: SessionStats = {
        ...session.sessionStats,
        characterStats: updatedCharacterStats,
        lastModified: Date.now(),
      };
      
      return {
        sessions: state.sessions.map((s: any) =>
          s.id === sessionId
            ? { 
                ...s, 
                sessionStats: newSessionStats,
                updatedAt: new Date().toISOString() 
              }
            : s
        ),
      };
    });
  },

  batchUpdateCharacterStats: (sessionId, characterId, updates, reason = 'llm_detection') => {
    set((state: any) => {
      const sessions = state.sessions as Array<{ 
        id: string; 
        sessionStats?: SessionStats;
      }>;
      const session = sessions.find(s => s.id === sessionId);
      
      if (!session?.sessionStats) return state;
      
      const stats = session.sessionStats.characterStats[characterId];
      if (!stats) return state;
      
      const character = state.characters.find((c: any) => c.id === characterId);
      const now = Date.now();
      
      // Apply all updates
      const newAttributeValues = { ...stats.attributeValues };
      const newLastUpdated = { ...stats.lastUpdated };
      const newChangeLog = [...(stats.changeLog || [])];
      
      for (const update of updates) {
        const oldValue = newAttributeValues[update.attributeKey];
        const attributeDef = character?.statsConfig?.attributes?.find(
          (a: AttributeDefinition) => a.key === update.attributeKey
        );
        
        newAttributeValues[update.attributeKey] = update.value;
        newLastUpdated[update.attributeKey] = now;
        
        newChangeLog.push({
          attributeId: attributeDef?.id || update.attributeKey,
          attributeKey: update.attributeKey,
          attributeName: attributeDef?.name || update.attributeKey,
          oldValue: oldValue ?? '',
          newValue: update.value,
          reason,
          timestamp: now,
        });
      }
      
      // Keep only last 100 entries
      const trimmedChangeLog = newChangeLog.slice(-100);
      
      const updatedCharacterStats = {
        ...session.sessionStats.characterStats,
        [characterId]: {
          ...stats,
          attributeValues: newAttributeValues,
          lastUpdated: newLastUpdated,
          changeLog: trimmedChangeLog,
        },
      };
      
      const newSessionStats: SessionStats = {
        ...session.sessionStats,
        characterStats: updatedCharacterStats,
        lastModified: now,
      };
      
      return {
        sessions: state.sessions.map((s: any) =>
          s.id === sessionId
            ? { 
                ...s, 
                sessionStats: newSessionStats,
                updatedAt: new Date().toISOString() 
              }
            : s
        ),
      };
    });
  },

  resetCharacterStats: (sessionId, characterId, statsConfig) => {
    set((state: any) => {
      const sessions = state.sessions as Array<{ 
        id: string; 
        sessionStats?: SessionStats;
      }>;
      const session = sessions.find(s => s.id === sessionId);
      
      if (!session?.sessionStats) return state;
      
      const character = state.characters.find((c: any) => c.id === characterId);
      const newStats = createDefaultCharacterStats(statsConfig || character?.statsConfig);
      
      const updatedCharacterStats = {
        ...session.sessionStats.characterStats,
        [characterId]: newStats,
      };
      
      const newSessionStats: SessionStats = {
        ...session.sessionStats,
        characterStats: updatedCharacterStats,
        lastModified: Date.now(),
      };
      
      return {
        sessions: state.sessions.map((s: any) =>
          s.id === sessionId
            ? { 
                ...s, 
                sessionStats: newSessionStats,
                updatedAt: new Date().toISOString() 
              }
            : s
        ),
      };
    });
  },

  clearSessionStats: (sessionId) => {
    set((state: any) => ({
      sessions: state.sessions.map((s: any) =>
        s.id === sessionId
          ? { 
              ...s, 
              sessionStats: undefined,
              updatedAt: new Date().toISOString() 
            }
          : s
      ),
    }));
  },

  // ============================================
  // Getters
  // ============================================

  getCharacterStats: (sessionId, characterId) => {
    const state = get();
    const sessions = state.sessions as Array<{ 
      id: string; 
      sessionStats?: SessionStats;
    }>;
    const session = sessions.find(s => s.id === sessionId);
    
    if (!session?.sessionStats) return null;
    
    return session.sessionStats.characterStats[characterId] || null;
  },

  getAttributeValue: (sessionId, characterId, attributeKey) => {
    const state = get();
    const sessions = state.sessions as Array<{ 
      id: string; 
      sessionStats?: SessionStats;
    }>;
    const session = sessions.find(s => s.id === sessionId);
    
    if (!session?.sessionStats) return null;
    
    const stats = session.sessionStats.characterStats[characterId];
    if (!stats) return null;
    
    return stats.attributeValues[attributeKey] ?? null;
  },
});

// ============================================
// Utility Functions for Requirements
// ============================================

/**
 * Evaluate a single requirement against current stats
 */
export function evaluateRequirement(
  requirement: StatRequirement,
  attributeValues: Record<string, number | string>
): boolean {
  const currentValue = attributeValues[requirement.attributeKey];
  
  if (currentValue === undefined) return false;
  
  const currentNum = typeof currentValue === 'number' ? currentValue : parseFloat(currentValue);
  const valueNum = typeof requirement.value === 'number' ? requirement.value : parseFloat(requirement.value);
  
  if (isNaN(currentNum) || isNaN(valueNum)) {
    // String comparison for non-numeric values
    const currentStr = String(currentValue);
    const valueStr = String(requirement.value);
    
    switch (requirement.operator) {
      case '==': return currentStr === valueStr;
      case '!=': return currentStr !== valueStr;
      default: return false;
    }
  }
  
  switch (requirement.operator) {
    case '<': return currentNum < valueNum;
    case '<=': return currentNum <= valueNum;
    case '>': return currentNum > valueNum;
    case '>=': return currentNum >= valueNum;
    case '==': return currentNum === valueNum;
    case '!=': return currentNum !== valueNum;
    case 'between':
      const maxNum = typeof requirement.valueMax === 'number' 
        ? requirement.valueMax 
        : parseFloat(requirement.valueMax?.toString() || '0');
      return currentNum >= valueNum && currentNum <= maxNum;
    default: return false;
  }
}

/**
 * Evaluate all requirements (AND logic)
 */
export function evaluateRequirements(
  requirements: StatRequirement[],
  attributeValues: Record<string, number | string>
): boolean {
  if (!requirements || requirements.length === 0) return true;
  return requirements.every(req => evaluateRequirement(req, attributeValues));
}

/**
 * Filter skills by requirements
 */
export function filterSkillsByRequirements(
  skills: SkillDefinition[],
  attributeValues: Record<string, number | string>
): SkillDefinition[] {
  return skills.filter(skill => evaluateRequirements(skill.requirements, attributeValues));
}

/**
 * Filter intentions by requirements
 */
export function filterIntentionsByRequirements(
  intentions: IntentionDefinition[],
  attributeValues: Record<string, number | string>
): IntentionDefinition[] {
  return intentions.filter(intention => evaluateRequirements(intention.requirements, attributeValues));
}

/**
 * Filter invitations by requirements
 */
export function filterInvitationsByRequirements(
  invitations: InvitationDefinition[],
  attributeValues: Record<string, number | string>
): InvitationDefinition[] {
  return invitations.filter(invitation => evaluateRequirements(invitation.requirements, attributeValues));
}
