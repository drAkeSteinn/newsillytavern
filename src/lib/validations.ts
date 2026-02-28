// ============================================
// Validations - Zod schemas for API requests
// ============================================

import { z } from 'zod';

// ============================================
// Common Schemas
// ============================================

export const uuidSchema = z.string().uuid().optional().or(z.literal(''));

export const nonEmptyString = z.string().min(1, 'Este campo es requerido');

export const safeString = (maxLength: number = 100000) => 
  z.string()
    .max(maxLength, `El texto excede el límite de ${maxLength} caracteres`)
    .transform(str => str.trim());

export const safeStringOptional = (maxLength: number = 100000) =>
  z.string()
    .max(maxLength, `El texto excede el límite de ${maxLength} caracteres`)
    .transform(str => str.trim())
    .optional()
    .or(z.literal(''));

// ============================================
// LLM Provider Validation
// ============================================

export const llmProviderSchema = z.enum([
  'z-ai',
  'openai',
  'anthropic',
  'ollama',
  'vllm',
  'koboldcpp',
  'text-generation-webui',
  'custom'
]);

export const llmParametersSchema = z.object({
  temperature: z.number().min(0).max(2).default(0.7),
  topP: z.number().min(0).max(1).default(0.9),
  topK: z.number().min(0).max(100).default(40),
  maxTokens: z.number().min(1).max(128000).default(512),
  contextSize: z.number().min(512).max(128000).default(4096),
  repetitionPenalty: z.number().min(0).max(2).default(1.1),
  frequencyPenalty: z.number().min(-2).max(2).default(0),
  presencePenalty: z.number().min(-2).max(2).default(0),
  stopStrings: z.array(z.string()).default([]),
  stream: z.boolean().default(true)
});

export const llmConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  provider: llmProviderSchema,
  endpoint: safeStringOptional(500),
  apiKey: safeStringOptional(500),
  model: safeStringOptional(100),
  parameters: llmParametersSchema,
  isActive: z.boolean().default(true)
});

// ============================================
// Chat Message Validation
// ============================================

export const chatMessageRoleSchema = z.enum(['user', 'assistant', 'system']);

export const chatMessageSchema = z.object({
  id: z.string().min(1),
  characterId: z.string(),
  role: chatMessageRoleSchema,
  content: safeString(100000),
  timestamp: z.string().datetime().optional().or(z.string()),
  isDeleted: z.boolean().default(false),
  swipeId: z.string().optional(),
  swipeIndex: z.number().min(0).default(0),
  metadata: z.record(z.unknown()).optional()
});

export const chatMessagesArraySchema = z.array(chatMessageSchema).max(1000, 'Demasiados mensajes en el historial');

// ============================================
// Character Card Validation (simplified for API)
// ============================================

export const characterCardSchema = z.object({
  id: z.string().min(1),
  name: safeString(100),
  description: safeStringOptional(10000),
  personality: safeStringOptional(5000),
  scenario: safeStringOptional(5000),
  firstMes: safeStringOptional(10000),
  mesExample: safeStringOptional(10000),
  creatorNotes: safeStringOptional(5000),
  characterNote: safeStringOptional(5000),
  systemPrompt: safeStringOptional(10000),
  postHistoryInstructions: safeStringOptional(5000),
  alternateGreetings: z.array(safeString(5000)).default([]),
  tags: z.array(safeString(50)).default([]),
  avatar: safeStringOptional(500),
  sprites: z.array(z.any()).default([]),
  spriteConfig: z.any().optional(),
  voice: z.any().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});

// ============================================
// Persona Validation
// ============================================

export const personaSchema = z.object({
  id: z.string().min(1),
  name: safeString(100),
  description: safeStringOptional(5000),
  avatar: safeStringOptional(500),
  isActive: z.boolean().default(true),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});

// ============================================
// Group Member Validation
// ============================================

export const groupRoleSchema = z.enum(['leader', 'member', 'observer']);

export const groupMemberSchema = z.object({
  characterId: z.string().min(1),
  role: groupRoleSchema.default('member'),
  isActive: z.boolean().default(true),
  isPresent: z.boolean().default(true),
  joinOrder: z.number().min(0).default(0)
});

export const activationStrategySchema = z.enum([
  'all',
  'round_robin', 
  'random',
  'reactive',
  'smart'
]);

export const characterGroupSchema = z.object({
  id: z.string().min(1),
  name: safeString(100),
  description: safeStringOptional(1000),
  characterIds: z.array(z.string()).default([]),
  members: z.array(groupMemberSchema).default([]),
  avatar: safeStringOptional(500),
  systemPrompt: safeStringOptional(10000),
  activationStrategy: activationStrategySchema.default('reactive'),
  maxResponsesPerTurn: z.number().min(1).max(20).default(3),
  allowMentions: z.boolean().default(true),
  mentionTriggers: z.array(safeString(50)).default([]),
  conversationStyle: z.enum(['sequential', 'parallel']).default('sequential'),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});

// ============================================
// API Request Schemas
// ============================================

export const streamRequestSchema = z.object({
  message: safeString(50000),
  sessionId: z.string().min(1),
  characterId: z.string().optional(),
  character: characterCardSchema.optional(),
  messages: chatMessagesArraySchema.optional(),
  llmConfig: llmConfigSchema,
  userName: safeStringOptional(100),
  persona: personaSchema.optional()
});

export const generateRequestSchema = z.object({
  message: safeString(50000),
  sessionId: z.string().min(1),
  characterId: z.string().optional(),
  character: characterCardSchema.optional(),
  messages: chatMessagesArraySchema.optional(),
  llmConfig: llmConfigSchema,
  userName: safeStringOptional(100),
  persona: personaSchema.optional()
});

export const groupStreamRequestSchema = z.object({
  message: safeString(50000),
  sessionId: z.string().min(1),
  groupId: z.string().min(1),
  group: characterGroupSchema,
  characters: z.array(characterCardSchema).min(1, 'El grupo debe tener al menos un personaje'),
  messages: chatMessagesArraySchema.optional(),
  llmConfig: llmConfigSchema,
  userName: safeStringOptional(100),
  persona: personaSchema.optional(),
  lastResponderId: z.string().optional()
});

// ============================================
// Validation Helper Functions
// ============================================

export type ValidationResult<T> = 
  | { success: true; data: T }
  | { success: false; error: string; issues?: z.ZodIssue[] };

export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): ValidationResult<T> {
  try {
    const result = schema.safeParse(data);
    
    if (result.success) {
      return { success: true, data: result.data };
    }
    
    // Format error messages
    const errorMessages = result.error.issues.map(issue => {
      const path = issue.path.length > 0 ? issue.path.join('.') : 'root';
      return `${path}: ${issue.message}`;
    });
    
    return {
      success: false,
      error: errorMessages.join('; '),
      issues: result.error.issues
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Error de validación desconocido'
    };
  }
}

// Quick validation for single fields
export function validateMessage(message: unknown): string | null {
  if (typeof message !== 'string') {
    return 'El mensaje debe ser texto';
  }
  if (message.trim().length === 0) {
    return 'El mensaje no puede estar vacío';
  }
  if (message.length > 50000) {
    return 'El mensaje excede el límite de caracteres';
  }
  return null;
}

export function validateSessionId(sessionId: unknown): string | null {
  if (typeof sessionId !== 'string' || sessionId.trim().length === 0) {
    return 'ID de sesión inválido';
  }
  return null;
}

// Sanitization helpers
export function sanitizeInput(input: string): string {
  // Remove control characters except newlines and tabs
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

export function sanitizeHtml(input: string): string {
  // Basic HTML escaping for user content
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
