// ============================================
// Quest Handler - Handles Quest Triggers
// ============================================

import type { DetectedToken } from '../token-detector';
import type { TriggerContext } from '../trigger-bus';
import type { 
  Quest, 
  QuestSettings, 
  QuestTriggerHit, 
  QuestObjective,
  QuestStatus
} from '@/types';
import { getCooldownManager } from '../cooldown-manager';

// ============================================
// Quest Handler State
// ============================================

export interface QuestHandlerState {
  processedQuests: Map<string, Set<string>>; // messageKey -> questIds processed
  questProgressTracked: Map<string, Set<string>>; // questId -> objectiveIds tracked
}

export function createQuestHandlerState(): QuestHandlerState {
  return {
    processedQuests: new Map(),
    questProgressTracked: new Map(),
  };
}

// ============================================
// Quest Trigger Context
// ============================================

export interface QuestTriggerContext extends TriggerContext {
  quests: Quest[];
  questSettings: QuestSettings;
  sessionId: string;
}

export interface QuestHandlerResult {
  hits: QuestTriggerHit[];
  startedQuests: Quest[];
  progressedQuests: Quest[];
  completedQuests: Quest[];
}

// ============================================
// Quest Tag Parser
// ============================================

interface ParsedQuestTag {
  action: 'start' | 'progress' | 'complete' | 'fail';
  questId?: string;
  questTitle?: string;
  objectiveId?: string;
  progress?: number;
  description?: string;
}

const QUEST_TAG_PATTERN = /<quest(?::(start|progress|complete|fail))?(?:\s+([^>]*))?\/?>/gi;
const QUEST_ATTR_PATTERN = /(\w+)="([^"]*)"/g;

/**
 * Parse quest tags from message content
 * Format: <quest:start title="Mission Name" description="..."/>
 *         <quest:progress id="quest-123" objective="obj-1" amount="1"/>
 *         <quest:complete id="quest-123"/>
 */
export function parseQuestTags(content: string): ParsedQuestTag[] {
  const tags: ParsedQuestTag[] = [];
  
  let match;
  while ((match = QUEST_TAG_PATTERN.exec(content)) !== null) {
    const action = (match[1] as ParsedQuestTag['action']) || 'start';
    const attrs = match[2] || '';
    
    const tag: ParsedQuestTag = { action };
    
    // Parse attributes
    let attrMatch;
    while ((attrMatch = QUEST_ATTR_PATTERN.exec(attrs)) !== null) {
      const [, key, value] = attrMatch;
      
      switch (key) {
        case 'id':
          tag.questId = value;
          break;
        case 'title':
          tag.questTitle = value;
          break;
        case 'objective':
          tag.objectiveId = value;
          break;
        case 'amount':
        case 'progress':
          tag.progress = parseInt(value) || 1;
          break;
        case 'description':
          tag.description = value;
          break;
      }
    }
    
    tags.push(tag);
  }
  
  return tags;
}

// ============================================
// Quest Handler Functions
// ============================================

/**
 * Check quest triggers - Detects quest start, progress, and completion
 */
export function checkQuestTriggers(
  tokens: DetectedToken[],
  content: string,
  context: QuestTriggerContext,
  state: QuestHandlerState
): QuestHandlerResult {
  const { quests, questSettings, sessionId } = context;
  
  const result: QuestHandlerResult = {
    hits: [],
    startedQuests: [],
    progressedQuests: [],
    completedQuests: [],
  };
  
  if (!questSettings.enabled) {
    return result;
  }
  
  const cooldownManager = getCooldownManager();
  const processedForMessage = state.processedQuests.get(context.messageKey) ?? new Set<string>();
  
  // 1. Parse explicit quest tags from content
  const parsedTags = parseQuestTags(content);
  
  for (const tag of parsedTags) {
    const hit = processParsedTag(tag, quests, sessionId);
    if (hit) {
      result.hits.push(hit);
    }
  }
  
  // 2. Check keyword-based triggers (auto-detection)
  if (questSettings.autoDetect) {
    const activeQuests = quests.filter(q => 
      q.sessionId === sessionId && q.status === 'active'
    );
    
    for (const quest of activeQuests) {
      // Skip if already processed for this message
      if (processedForMessage.has(quest.id)) continue;
      
      // Check for progress/completion keywords
      const progressHit = checkQuestProgress(quest, tokens, content);
      if (progressHit) {
        result.hits.push(progressHit);
        result.progressedQuests.push(quest);
        
        // Check if quest is now complete
        if (progressHit.action === 'complete') {
          result.completedQuests.push(quest);
        }
        
        processedForMessage.add(quest.id);
      }
    }
    
    // Check for quest start keywords in inactive quests
    const inactiveQuests = quests.filter(q => 
      q.sessionId === sessionId && q.status === 'paused'
    );
    
    for (const quest of inactiveQuests) {
      if (quest.triggers.startKeywords.length === 0) continue;
      
      const hasKeyword = quest.triggers.startKeywords.some(kw => 
        content.toLowerCase().includes(kw.toLowerCase())
      );
      
      if (hasKeyword) {
        result.hits.push({
          questId: quest.id,
          quest,
          action: 'start',
          message: `Quest "${quest.title}" resumed`,
        });
      }
    }
  }
  
  // Update state
  state.processedQuests.set(context.messageKey, processedForMessage);
  
  return result;
}

/**
 * Process a parsed quest tag
 */
function processParsedTag(
  tag: ParsedQuestTag,
  quests: Quest[],
  sessionId: string
): QuestTriggerHit | null {
  switch (tag.action) {
    case 'start':
      return {
        questId: tag.questId || `quest-${Date.now()}`,
        action: 'start',
        message: `Quest started: ${tag.questTitle || tag.description || 'New Quest'}`,
      };
      
    case 'progress':
      const quest = quests.find(q => q.id === tag.questId);
      if (!quest) return null;
      
      const objective = quest.objectives.find(o => o.id === tag.objectiveId);
      if (!objective) return null;
      
      return {
        questId: quest.id,
        quest,
        objectiveId: objective.id,
        objective,
        action: 'progress',
        progress: tag.progress || 1,
        message: `Objective "${objective.description}" progressed`,
      };
      
    case 'complete':
      const completeQuest = quests.find(q => q.id === tag.questId);
      return {
        questId: tag.questId || '',
        quest: completeQuest,
        action: 'complete',
        message: `Quest completed: ${completeQuest?.title || tag.questId}`,
      };
      
    case 'fail':
      const failQuest = quests.find(q => q.id === tag.questId);
      return {
        questId: tag.questId || '',
        quest: failQuest,
        action: 'fail',
        message: `Quest failed: ${failQuest?.title || tag.questId}`,
      };
      
    default:
      return null;
  }
}

/**
 * Check quest progress based on keywords
 */
function checkQuestProgress(
  quest: Quest,
  tokens: DetectedToken[],
  content: string
): QuestTriggerHit | null {
  if (!quest.triggers.autoComplete && !quest.triggers.trackProgress) {
    return null;
  }
  
  const lowerContent = content.toLowerCase();
  
  // Check each incomplete objective
  for (const objective of quest.objectives) {
    if (objective.isCompleted) continue;
    
    // Check completion keywords
    const hasCompletion = quest.triggers.completionKeywords.some(kw =>
      lowerContent.includes(kw.toLowerCase())
    );
    
    if (hasCompletion && quest.triggers.autoComplete) {
      return {
        questId: quest.id,
        quest,
        objectiveId: objective.id,
        objective,
        action: 'complete',
        message: `Objective completed: ${objective.description}`,
      };
    }
    
    // Check for progress keywords (if tracking)
    if (quest.triggers.trackProgress && objective.target) {
      const targetLower = objective.target.toLowerCase();
      const hasTarget = lowerContent.includes(targetLower);
      
      if (hasTarget) {
        return {
          questId: quest.id,
          quest,
          objectiveId: objective.id,
          objective,
          action: 'progress',
          progress: 1,
          message: `Progress made on: ${objective.description}`,
        };
      }
    }
  }
  
  return null;
}

// ============================================
// Quest Prompt Builder
// ============================================

/**
 * Build quest section for prompt
 */
export function buildQuestPromptSection(
  quests: Quest[],
  template: string
): string {
  const activeQuests = quests.filter(q => q.status === 'active');
  
  if (activeQuests.length === 0) {
    return '';
  }
  
  const questList = activeQuests.map(q => {
    const objectives = q.objectives
      .filter(o => !o.isCompleted)
      .map(o => {
        const progress = o.targetCount > 1 
          ? ` (${o.currentCount}/${o.targetCount})` 
          : '';
        return `  - ${o.description}${progress}`;
      })
      .join('\n');
    
    return `**${q.title}** (${q.priority})
${q.description}
Objectives:
${objectives}`;
  }).join('\n\n');
  
  return template.replace('{{activeQuests}}', questList);
}

// ============================================
// Utility Functions
// ============================================

/**
 * Create a new quest from detected content
 */
export function createQuestFromDetection(
  sessionId: string,
  title: string,
  description: string,
  objectives: QuestObjective[] = [],
  priority: 'main' | 'side' | 'hidden' = 'side'
): Quest {
  return {
    id: `quest-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    sessionId,
    title,
    description,
    status: 'active',
    priority,
    objectives,
    rewards: [],
    triggers: {
      startKeywords: [],
      completionKeywords: [],
      autoStart: false,
      autoComplete: true,
      trackProgress: true,
    },
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    progress: 0,
    isHidden: false,
    isRepeatable: false,
  };
}

/**
 * Reset state for new message
 */
export function resetQuestHandlerState(state: QuestHandlerState, messageKey: string): void {
  state.processedQuests.delete(messageKey);
}

/**
 * Clear all quest state
 */
export function clearQuestHandlerState(state: QuestHandlerState): void {
  state.processedQuests.clear();
  state.questProgressTracked.clear();
}

// ============================================
// Export Index
// ============================================

export type { QuestHandlerState, QuestTriggerContext, QuestHandlerResult };
