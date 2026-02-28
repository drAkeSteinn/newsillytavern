// ============================================
// Text Generation WebUI / KoboldCPP Provider
// ============================================

import type { LLMConfig, GenerateResponse } from '../types';

/**
 * Stream from Text Generation WebUI / KoboldCPP API
 */
export async function* streamTextGenerationWebUI(
  prompt: string,
  config: LLMConfig
): AsyncGenerator<string> {
  const endpoint = config.endpoint.replace(/\/$/, '');

  const response = await fetch(`${endpoint}/api/v1/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` })
    },
    body: JSON.stringify({
      prompt: prompt,
      max_new_tokens: config.parameters.maxTokens,
      temperature: config.parameters.temperature,
      top_p: config.parameters.topP,
      top_k: config.parameters.topK,
      repetition_penalty: config.parameters.repetitionPenalty,
      stop: config.parameters.stopStrings?.length ? config.parameters.stopStrings : undefined,
      stream: true
    }),
    signal: AbortSignal.timeout(60000)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Text Generation WebUI Error (${response.status}): ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        try {
          const parsed = JSON.parse(trimmedLine);
          const content = parsed.results?.[0]?.text || parsed.text || '';
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
 * Call Text Generation WebUI / KoboldCPP API (non-streaming)
 */
export async function callTextGenerationWebUI(
  prompt: string,
  config: LLMConfig
): Promise<GenerateResponse> {
  const endpoint = config.endpoint.replace(/\/$/, '');

  const response = await fetch(`${endpoint}/api/v1/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` })
    },
    body: JSON.stringify({
      prompt: prompt,
      max_new_tokens: config.parameters.maxTokens,
      temperature: config.parameters.temperature,
      top_p: config.parameters.topP,
      top_k: config.parameters.topK,
      repetition_penalty: config.parameters.repetitionPenalty,
      stop: config.parameters.stopStrings?.length ? config.parameters.stopStrings : undefined,
      stream: false
    }),
    signal: AbortSignal.timeout(60000)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Text Generation WebUI Error (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  return {
    message: data.results?.[0]?.text || data.text || '',
    usage: {
      promptTokens: data.prompt_tokens || 0,
      completionTokens: data.completion_tokens || 0,
      totalTokens: (data.prompt_tokens || 0) + (data.completion_tokens || 0)
    },
    model: data.model || config.model
  };
}
