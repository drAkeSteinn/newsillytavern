/**
 * Embeddings Chat Context Retrieval
 *
 * Provides utilities for automatically retrieving relevant embeddings
 * during chat and injecting them as context into the LLM prompt.
 *
 * Used by /api/chat/stream and /api/chat/group-stream routes.
 */

import type { PromptSection, EmbeddingsChatSettings } from '@/types';
import { getEmbeddingClient } from './client';
import { loadConfig } from './config-persistence';
import type { SearchResult } from './types';

/** Result of embeddings context retrieval */
export interface EmbeddingsContextResult {
  /** Whether embeddings were found and context was built */
  found: boolean;
  /** Number of embeddings retrieved */
  count: number;
  /** The formatted context string */
  contextString: string;
  /** The raw search results for UI display */
  results: SearchResult[];
  /** Prompt section to inject (null if nothing found) */
  section: PromptSection | null;
  /** Namespaces that were searched */
  searchedNamespaces: string[];
}

/**
 * Retrieve embeddings context for a chat message.
 *
 * Searches relevant namespaces based on the configured strategy and
 * returns a PromptSection that can be injected into the system prompt.
 *
 * @param userMessage - The user's current message (used as search query)
 * @param characterId - The active character's ID (for character strategy)
 * @param sessionId - The active session's ID (for session strategy)
 * @param settings - EmbeddingsChatSettings from the store
 * @returns EmbeddingsContextResult with prompt section and metadata
 */
export async function retrieveEmbeddingsContext(
  userMessage: string,
  characterId?: string,
  sessionId?: string,
  settings?: Partial<EmbeddingsChatSettings>
): Promise<EmbeddingsContextResult> {
  // Default: no-op if disabled or no settings provided
  const emptyResult: EmbeddingsContextResult = {
    found: false,
    count: 0,
    contextString: '',
    results: [],
    section: null,
    searchedNamespaces: [],
  };

  if (!settings?.enabled) {
    return emptyResult;
  }

  if (!userMessage.trim()) {
    return emptyResult;
  }

  try {
    const client = getEmbeddingClient();
    const config = loadConfig();

    // Determine namespaces to search based on strategy
    const namespaces = getNamespacesForStrategy(
      settings.namespaceStrategy || 'character',
      characterId,
      sessionId
    );

    if (namespaces.length === 0) {
      return emptyResult;
    }

    // Search each namespace (with deduplication)
    const maxResults = config.maxResults || 5;
    const threshold = config.similarityThreshold || 0.5;
    const maxBudget = settings.maxTokenBudget || 1024;

    const seenIds = new Set<string>();
    const allResults: SearchResult[] = [];

    // Search 'default' namespace first (no namespace filter = all)
    // Then search specific namespaces
    for (const ns of namespaces) {
      try {
        let results: SearchResult[];
        if (ns === '*') {
          // Search all namespaces
          results = await client.searchSimilar({
            query: userMessage,
            limit: maxResults * 2, // get more for filtering
            threshold,
          });
        } else {
          results = await client.searchInNamespace({
            namespace: ns,
            query: userMessage,
            limit: maxResults,
            threshold,
          });
        }

        // Deduplicate by ID
        for (const r of results) {
          if (!seenIds.has(r.id)) {
            seenIds.add(r.id);
            allResults.push(r);
          }
        }
      } catch (err) {
        console.warn(`[Embeddings] Search failed for namespace "${ns}":`, err);
        // Continue with other namespaces even if one fails
      }
    }

    if (allResults.length === 0) {
      return emptyResult;
    }

    // Sort by similarity (highest first)
    allResults.sort((a, b) => b.similarity - a.similarity);

    // Trim to max results
    const trimmed = allResults.slice(0, maxResults);

    // Build context string respecting token budget
    const contextString = buildContextString(trimmed, maxBudget);

    if (!contextString.trim()) {
      return emptyResult;
    }

    // Build PromptSection
    const section: PromptSection = {
      type: 'memory',
      label: 'Embeddings Context',
      content: contextString,
      color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
    };

    return {
      found: true,
      count: trimmed.length,
      contextString,
      results: trimmed,
      section: settings.showInPromptViewer !== false ? section : null,
      searchedNamespaces: namespaces,
    };
  } catch (error) {
    console.error('[Embeddings] Context retrieval failed:', error);
    return emptyResult;
  }
}

/**
 * Determine which namespaces to search based on the configured strategy.
 */
function getNamespacesForStrategy(
  strategy: EmbeddingsChatSettings['namespaceStrategy'],
  characterId?: string,
  sessionId?: string
): string[] {
  switch (strategy) {
    case 'global':
      // Search all namespaces
      return ['*'];

    case 'character':
      // Search character-specific + default + world namespaces
      return [
        ...(characterId ? [`character-${characterId}`] : []),
        'default',
        'world',
        'world-building',
      ].filter(Boolean);

    case 'session':
      // Search session-specific + character-specific + default
      return [
        ...(sessionId ? [`session-${sessionId}`] : []),
        ...(characterId ? [`character-${characterId}`] : []),
        'default',
        'world',
      ].filter(Boolean);

    default:
      return ['*'];
  }
}

/**
 * Build a formatted context string from search results,
 * respecting the token budget (approximated as characters / 4).
 */
function buildContextString(results: SearchResult[], maxTokenBudget: number): string {
  const maxChars = maxTokenBudget * 4; // rough estimate: 1 token ≈ 4 chars
  let totalChars = 0;
  const parts: string[] = [];

  for (const result of results) {
    const entry = `[${result.source_type || 'memory'}] ${result.content}`;
    if (totalChars + entry.length > maxChars) {
      break;
    }
    parts.push(entry);
    totalChars += entry.length;
  }

  if (parts.length === 0) return '';

  return `[Relevant Context from Embeddings]\n${parts.join('\n\n')}`;
}

/**
 * Extract embeddings metadata from a context result for SSE transmission.
 * This is a lighter version of SearchResult[] for sending over the wire.
 */
export function formatEmbeddingsForSSE(result: EmbeddingsContextResult): {
  count: number;
  namespaces: string[];
  topResults: Array<{
    content: string;
    similarity: number;
    namespace: string;
    source_type?: string;
  }>;
} | null {
  if (!result.found) return null;

  return {
    count: result.count,
    namespaces: result.searchedNamespaces,
    topResults: result.results.slice(0, 5).map(r => ({
      content: r.content.slice(0, 200), // truncate for SSE payload
      similarity: r.similarity,
      namespace: r.namespace,
      source_type: r.source_type,
    })),
  };
}
