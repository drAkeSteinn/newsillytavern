// ============================================
// Z.ai Provider - Streaming and generation
// ============================================

import ZAI from 'z-ai-web-dev-sdk';
import type { ChatApiMessage, GenerateResponse } from '../types';

/**
 * Stream from Z.ai SDK
 */
export async function* streamZAI(
  messages: ChatApiMessage[]
): AsyncGenerator<string> {
  try {
    const zai = await ZAI.create();

    const response = await zai.chat.completions.create({
      messages: messages as Array<{ role: 'assistant' | 'user'; content: string }>,
      thinking: { type: 'disabled' },
      stream: true
    });

    // The SDK returns a ReadableStream, not an async iterable
    const reader = (response as ReadableStream).getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Split by double newline (SSE message separator)
        const sseMessages = buffer.split('\n\n');
        buffer = sseMessages.pop() || '';

        for (const message of sseMessages) {
          // Each message is in format "data: {...}"
          if (!message.startsWith('data: ')) continue;

          const jsonStr = message.slice(6);
          if (jsonStr === '[DONE]') continue;

          try {
            const data = JSON.parse(jsonStr);
            const choices = data.choices as Array<Record<string, unknown>> | undefined;
            const delta = choices?.[0]?.delta as Record<string, unknown> | undefined;
            const content = delta?.content as string | undefined;

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
  } catch (error) {
    throw new Error(`Z.ai Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Call Z.ai using the SDK (non-streaming)
 */
export async function callZAI(
  messages: ChatApiMessage[]
): Promise<GenerateResponse> {
  try {
    const zai = await ZAI.create();

    const completion = await zai.chat.completions.create({
      messages: messages as Array<{ role: 'assistant' | 'user'; content: string }>,
      thinking: { type: 'disabled' }
    });

    const response = completion.choices[0]?.message?.content || '';

    return {
      message: response,
      usage: {
        promptTokens: completion.usage?.prompt_tokens || 0,
        completionTokens: completion.usage?.completion_tokens || 0,
        totalTokens: completion.usage?.total_tokens || 0
      },
      model: completion.model || 'z-ai'
    };
  } catch (error) {
    throw new Error(`Z.ai Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
