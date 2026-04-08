// ============================================
// OpenAI Provider - Streaming and generation
// ============================================

import type { LLMConfig, ChatApiMessage, GenerateResponse } from '../types';
import type { ToolDefinition } from '@/lib/tools/types';
import type { ToolCallAccumulator } from '@/lib/tools/parsers/native-parser';
import { toOpenAITools } from '@/lib/tools/tool-registry';
import { processOpenAIDelta, finalizeToolCalls } from '@/lib/tools/parsers/native-parser';

// Default timeout: 5 minutes for long group chats
const DEFAULT_TIMEOUT = 300000;

/**
 * Validate that the response is actually JSON/SSE, not HTML or other garbage.
 * Some CDN/proxy providers return HTML error pages with status 200.
 */
function validateResponseContentType(response: Response, provider: string): void {
  const contentType = response.headers.get('content-type') || '';
  // Accept: application/json, text/event-stream, application/octet-stream (some providers)
  const isValidType =
    contentType.includes('application/json') ||
    contentType.includes('text/event-stream') ||
    contentType.includes('application/octet-stream') ||
    contentType.includes('text/plain');

  if (!isValidType) {
    throw new Error(
      `${provider} Error: Respuesta inesperada del servidor (Content-Type: ${contentType}). ` +
      `El endpoint podría no ser correcto. Verifica la URL y la API key. ` +
      `Si usas Grok, asegúrate que el endpoint sea https://api.x.ai/v1`
    );
  }
}


// Provider-specific default models
const PROVIDER_DEFAULT_MODELS: Record<string, string> = {
  'grok': 'grok-3',
  'openai': 'gpt-4o-mini',
  'anthropic': 'claude-sonnet-4-20250514',
};

function getDefaultModel(provider: string): string {
  return PROVIDER_DEFAULT_MODELS[provider] || 'gpt-4o-mini';
}

/**
 * Stream from OpenAI-compatible API (without tools - backward compatible)
 */
export async function* streamOpenAICompatible(
  messages: ChatApiMessage[],
  config: LLMConfig,
  provider: string = 'openai'
): AsyncGenerator<string> {
  const endpoint = config.endpoint.replace(/\/$/, '');
  const chatUrl = `${endpoint}/chat/completions`;
  
  // Use configurable timeout or default (5 minutes)
  const timeoutMs = config.parameters.timeout || DEFAULT_TIMEOUT;

  const model = config.model || getDefaultModel(provider);

  const requestBody: Record<string, unknown> = {
    model: model,
    messages: messages,
    max_tokens: config.parameters.maxTokens,
    temperature: config.parameters.temperature,
    top_p: config.parameters.topP,
    stream: true
  };

  // OpenAI-specific parameters
  if (provider === 'openai') {
    requestBody.frequency_penalty = config.parameters.frequencyPenalty;
    requestBody.presence_penalty = config.parameters.presencePenalty;
    if (config.parameters.stopStrings?.length) {
      requestBody.stop = config.parameters.stopStrings;
    }
  } else if (provider === 'grok') {
    // Grok only supports these params with non-zero values and only on certain models
    if (config.parameters.frequencyPenalty && config.parameters.frequencyPenalty !== 0) {
      requestBody.frequency_penalty = config.parameters.frequencyPenalty;
    }
    if (config.parameters.presencePenalty && config.parameters.presencePenalty !== 0) {
      requestBody.presence_penalty = config.parameters.presencePenalty;
    }
    if (config.parameters.stopStrings?.length) {
      requestBody.stop = config.parameters.stopStrings;
    }
  }

  console.log(`[OpenAI Stream] ${provider} → ${chatUrl} model=${model} messages=${messages.length}`);

  const response = await fetch(chatUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` })
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(timeoutMs)
  });

  console.log(`[OpenAI Stream] Response: status=${response.status} contentType=${response.headers.get('content-type') || 'none'}`);

  if (!response.ok) {
    const errorText = await response.text();
    // Log full error for diagnostics
    console.error(`[OpenAI Stream] Error response from ${provider}:`, errorText.slice(0, 500));
    let errorMessage = errorText;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error?.message || errorJson.message || errorText;
    } catch {
      // Keep original error text (may be HTML)
      if (errorText.trimStart().startsWith('<')) {
        errorMessage = `El servidor devolvió HTML en lugar de JSON. URL: ${chatUrl}\nFragmento: ${errorText.slice(0, 200)}\nVerifica que el endpoint sea correcto.`;
      }
    }
    throw new Error(`${provider} Error (${response.status}): ${errorMessage}`);
  }

  // Validate response Content-Type to catch HTML error pages
  validateResponseContentType(response, provider);

  // For streaming: also check that body starts with SSE data, not HTML
  // We do this by cloning the response to peek at the first bytes
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';
  let isFirstChunk = true;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // On first chunk, validate we're getting SSE data, not HTML
      if (isFirstChunk && value) {
        isFirstChunk = false;
        const preview = new TextDecoder().decode(value.slice(0, 100));
        if (preview.trimStart().startsWith('<') && /<html|<head|<body|<!doctype/i.test(preview)) {
          reader.releaseLock();
          throw new Error(
            `${provider} Error: El servidor devolvió HTML en lugar de datos SSE. ` +
            `Verifica la URL del endpoint y la API key. ` +
            `Si usas Grok, asegúrate que el endpoint sea https://api.x.ai/v1 ` +
            `y que tu API key sea válida en console.x.ai`
          );
        }
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue;

        const data = trimmedLine.slice(6);
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content || '';
          if (content) {
            yield content;
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Stream from OpenAI-compatible API WITH native tool calling support.
 * 
 * Yields text chunks for real-time display. Tool calls are accumulated
 * in the provided ToolCallAccumulator. After the generator completes,
 * check `accumulator.toolCalls` and `accumulator.finishReason`.
 */
export async function* streamOpenAIWithTools(
  messages: ChatApiMessage[],
  config: LLMConfig,
  provider: string,
  tools: ToolDefinition[],
  accumulator: ToolCallAccumulator,
): AsyncGenerator<string> {
  const endpoint = config.endpoint.replace(/\/$/, '');
  const chatUrl = `${endpoint}/chat/completions`;
  const timeoutMs = config.parameters.timeout || DEFAULT_TIMEOUT;
  const model = config.model || getDefaultModel(provider);

  const openAITools = toOpenAITools(tools);
  
  console.log(`[OpenAI+Tools] ${provider} → ${chatUrl} model=${model} tools=${openAITools.length} messages=${messages.length}`);

  const requestBody: Record<string, unknown> = {
    model: model,
    messages: messages,
    max_tokens: config.parameters.maxTokens,
    temperature: config.parameters.temperature,
    top_p: config.parameters.topP,
    stream: true,
    tools: openAITools,
  };

  // OpenAI/Grok-specific parameters
  if (provider === 'openai') {
    requestBody.frequency_penalty = config.parameters.frequencyPenalty;
    requestBody.presence_penalty = config.parameters.presencePenalty;
    if (config.parameters.stopStrings?.length) {
      requestBody.stop = config.parameters.stopStrings;
    }
  } else if (provider === 'grok') {
    // Grok only supports these params with non-zero values and only on certain models
    if (config.parameters.frequencyPenalty && config.parameters.frequencyPenalty !== 0) {
      requestBody.frequency_penalty = config.parameters.frequencyPenalty;
    }
    if (config.parameters.presencePenalty && config.parameters.presencePenalty !== 0) {
      requestBody.presence_penalty = config.parameters.presencePenalty;
    }
    if (config.parameters.stopStrings?.length) {
      requestBody.stop = config.parameters.stopStrings;
    }
  }

  const response = await fetch(chatUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` })
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(timeoutMs)
  });

  console.log(`[OpenAI+Tools] Response: status=${response.status} contentType=${response.headers.get('content-type') || 'none'}`);

  if (!response.ok) {
    const errorText = await response.text();
    const contentType = response.headers.get('content-type') || '';
    console.error(`[OpenAI+Tools] Error response from ${provider}: status=${response.status} contentType=${contentType}`);
    console.error(`[OpenAI+Tools] Error body (first 500 chars):`, errorText.slice(0, 500));
    let errorMessage = errorText;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error?.message || errorJson.message || errorText;
    } catch {
      // Keep original error text (may be HTML)
      if (errorText.trimStart().startsWith('<') && /<html|<head|<body|<!doctype/i.test(errorText)) {
        errorMessage = `El servidor devolvió HTML (${response.status}). URL: ${chatUrl}\nEsto indica que el endpoint es incorrecto o no es accesible desde este servidor.\nPreview: ${errorText.slice(0, 200).trim()}`;
      }
    }
    throw new Error(`${provider} Error (${response.status}): ${errorMessage}`);
  }

  // Validate response Content-Type to catch HTML error pages
  const responseContentType = response.headers.get('content-type') || '';
  console.log(`[OpenAI+Tools] Response OK: status=${response.status} contentType=${responseContentType} url=${chatUrl}`);
  validateResponseContentType(response, provider);

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';
  let isFirstChunk = true;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // On first chunk, validate we're getting SSE data, not HTML
      if (isFirstChunk && value) {
        isFirstChunk = false;
        const preview = new TextDecoder().decode(value.slice(0, 100));
        if (preview.trimStart().startsWith('<') && /<html|<head|<body|<!doctype/i.test(preview)) {
          reader.releaseLock();
          finalizeToolCalls(accumulator);
          throw new Error(
            `${provider} Error: El servidor devolvió HTML en lugar de datos SSE. ` +
            `Verifica la URL del endpoint y la API key. ` +
            `Si usas Grok, asegúrate que el endpoint sea https://api.x.ai/v1 ` +
            `y que tu API key sea válida en console.x.ai`
          );
        }
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue;

        const data = trimmedLine.slice(6);
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          const choice = parsed.choices?.[0];

          // Check finish reason
          if (choice?.finish_reason) {
            accumulator.finishReason = choice.finish_reason;
          }

          // Process delta for both text and tool calls
          const delta = choice?.delta || {};
          const textContent = processOpenAIDelta(delta, accumulator);
          if (textContent) {
            yield textContent;
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }
  } finally {
    reader.releaseLock();
    // Finalize accumulated tool calls
    finalizeToolCalls(accumulator);
  }

  console.log(`[OpenAI+Tools] Stream complete. finishReason=${accumulator.finishReason}, toolCalls=${accumulator.toolCalls.length}`);
}

/**
 * Call OpenAI-compatible API (non-streaming)
 */
export async function callOpenAICompatible(
  messages: ChatApiMessage[],
  config: LLMConfig,
  provider: string = 'openai'
): Promise<GenerateResponse> {
  const endpoint = config.endpoint.replace(/\/$/, '');
  
  // Use default timeout (5 minutes)
  const timeoutMs = DEFAULT_TIMEOUT;

  const requestBody: Record<string, unknown> = {
    model: config.model || getDefaultModel(provider),
    messages: messages,
    max_tokens: config.parameters.maxTokens,
    temperature: config.parameters.temperature,
    top_p: config.parameters.topP,
    stream: false
  };

  // OpenAI/Grok-specific parameters
  if (provider === 'openai') {
    requestBody.frequency_penalty = config.parameters.frequencyPenalty;
    requestBody.presence_penalty = config.parameters.presencePenalty;
    if (config.parameters.stopStrings?.length) {
      requestBody.stop = config.parameters.stopStrings;
    }
  } else if (provider === 'grok') {
    // Grok only supports these params with non-zero values and only on certain models
    if (config.parameters.frequencyPenalty && config.parameters.frequencyPenalty !== 0) {
      requestBody.frequency_penalty = config.parameters.frequencyPenalty;
    }
    if (config.parameters.presencePenalty && config.parameters.presencePenalty !== 0) {
      requestBody.presence_penalty = config.parameters.presencePenalty;
    }
    if (config.parameters.stopStrings?.length) {
      requestBody.stop = config.parameters.stopStrings;
    }
  }

  const response = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` })
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(timeoutMs)
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = errorText;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error?.message || errorJson.message || errorText;
    } catch {
      // Keep original error text
    }
    throw new Error(`${provider} Error (${response.status}): ${errorMessage}`);
  }

  // Validate response Content-Type to catch HTML error pages
  validateResponseContentType(response, provider);

  // Read full response and validate it's not HTML before parsing JSON
  const rawText = await response.text();
  
  // Detect HTML responses (CDN error pages, wrong endpoints, etc.)
  if (rawText.trimStart().startsWith('<') && /<html|<head|<body|<!doctype/i.test(rawText)) {
    throw new Error(
      `${provider} Error: El servidor devolvió HTML en lugar de JSON. ` +
      `Esto suele indicar que la API key es inválida, el endpoint es incorrecto, ` +
      `o el servidor está bloqueando la solicitud. ` +
      `Fragmento recibido: "${rawText.slice(0, 80).trim()}..."`
    );
  }

  let data: any;
  try {
    data = JSON.parse(rawText);
  } catch (parseErr) {
    throw new Error(
      `${provider} Error: No se pudo parsear la respuesta como JSON. ` +
      `El servidor pudo devolver una respuesta inválida. ` +
      `Verifica que el endpoint sea correcto.`
    );
  }

  return {
    message: data.choices?.[0]?.message?.content || '',
    usage: {
      promptTokens: data.usage?.prompt_tokens || 0,
      completionTokens: data.usage?.completion_tokens || 0,
      totalTokens: data.usage?.total_tokens || 0
    },
    model: data.model || config.model
  };
}
