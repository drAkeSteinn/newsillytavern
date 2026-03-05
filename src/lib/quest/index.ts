// ============================================
// Quest Module Index
// ============================================

// Storage functions
export {
  getQuestTemplateFiles,
  loadAllQuestTemplates,
  loadQuestTemplateById,
  saveQuestTemplate,
  deleteQuestTemplate,
  createNewQuestTemplate,
  validateQuestTemplate,
  duplicateQuestTemplate,
  getQuestTemplatesByPriority,
  getQuestTemplatesWithPrerequisites,
  createDefaultQuestTemplate,
} from './quest-storage';

// Detection functions
export {
  // Key extraction
  getActivationKeys,
  getCompletionKeys,
  getObjectiveKeys,
  
  // Detection
  detectQuestActivations,
  detectObjectiveProgress,
  detectQuestCompletions,
  detectQuestEvents,
  checkTurnBasedActivation,
  
  // Convert to trigger hits
  activationsToTriggerHits,
  objectivesToTriggerHits,
  completionsToTriggerHits,
  
  // Streaming support
  QuestDetectionState,
  createQuestDetectionState,
  
  // Trigger system integration
  checkQuestTriggersInText,
  resetQuestDetectorState,
  clearQuestDetectorState,
  
  // Chain helpers
  getNextQuestInChain,
  shouldAutoStartChain,
  
  // Types
  type QuestDetectionAction,
  type QuestActivationDetection,
  type QuestObjectiveDetection,
  type QuestCompletionDetection,
  type QuestDetectionResult,
  type QuestTriggerContext,
  type QuestHandlerResult,
} from './quest-detector';

// Reward execution functions
export {
  // Condition evaluation
  evaluateRewardCondition,
  
  // Attribute helpers
  calculateNewAttributeValue,
  
  // Individual reward execution
  executeAttributeReward,
  executeSpriteReward,
  executeSoundReward,
  executeBackgroundReward,
  executeItemReward,
  executeCustomReward,
  executeReward,
  
  // Batch execution
  executeAllRewards,
  executeQuestCompletionRewards,
  
  // Reward descriptions
  describeReward,
  describeRewards,
  
  // Types
  type RewardExecutionContext,
  type RewardExecutionResult,
  type RewardBatchResult,
  type RewardStoreActions,
} from './quest-reward-executor';

// Re-export types from @/types
export type {
  QuestTemplate,
  SessionQuestInstance,
  QuestObjectiveTemplate,
  QuestReward,
  QuestRewardType,
  QuestRewardCondition,
  QuestStatus,
  QuestPriority,
  QuestObjectiveType,
  QuestActivationConfig,
  QuestCompletionConfig,
  QuestChainConfig,
  QuestSettings,
  QuestTriggerHit,
  QuestNotification,
  DEFAULT_QUEST_SETTINGS,
} from '@/types';
