/**
 * Embeddings Chat Context Retrieval
 *
 * Provides utilities for automatically retrieving relevant embeddings
 * during chat and injecting them as context into the LLM prompt.
 * Embeddings are grouped by namespace type for organized presentation.
 *
 * Used by /api/chat/stream and /api/chat/group-stream routes.
 */

import type { PromptSection, EmbeddingsChatSettings } from '@/types';
import { getEmbeddingClient } from './client';
import { loadConfig } from './config-persistence';
import { LanceDBWrapper } from './lancedb-db';
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
  /** Grouping info: type → count of results */
  typeGroups?: Record<string, number>;
}

/**
 * Retrieve embeddings context for a chat message.
 *
 * Searches relevant namespaces based on the configured strategy,
 * groups results by namespace type, and returns a PromptSection
 * that can be injected into the system prompt.
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
    typeGroups: {},
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
    // If custom namespaces are provided (from character/group assignment), use those instead
    const customNamespaces = settings.customNamespaces;
    const namespaces = (customNamespaces && customNamespaces.length > 0)
      ? customNamespaces
      : getNamespacesForStrategy(
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

    // Load namespace info to get types for grouping
    const namespaceTypes = await getNamespaceTypesMap(trimmed);

    // Build grouped context string respecting token budget
    const { contextString, typeGroups } = buildGroupedContextString(trimmed, namespaceTypes, maxBudget);

    if (!contextString.trim()) {
      return emptyResult;
    }

    // Build PromptSection
    const section: PromptSection = {
      type: 'memory',
      label: 'CONTEXTO',
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
      typeGroups,
    };
  } catch (error) {
    console.error('[Embeddings] Context retrieval failed:', error);
    return emptyResult;
  }
}

/**
 * Build a map of namespace name → type string by loading all namespaces from DB.
 * Only loads once and caches the result for this call.
 */
async function getNamespaceTypesMap(results: SearchResult[]): Promise<Record<string, string>> {
  try {
    const allNamespaces = await LanceDBWrapper.getAllNamespaces();
    const typeMap: Record<string, string> = {};

    // Collect unique namespace names from results
    const uniqueNamespaces = new Set<string>();
    for (const r of results) {
      if (r.namespace) uniqueNamespaces.add(r.namespace);
    }

    // Map each namespace name to its type
    for (const ns of allNamespaces) {
      if (uniqueNamespaces.has(ns.namespace)) {
        const type = (ns.metadata as Record<string, any>)?.type;
        if (type && typeof type === 'string' && type.trim()) {
          typeMap[ns.namespace] = type.trim().toUpperCase();
        }
      }
    }

    return typeMap;
  } catch (err) {
    console.warn('[Embeddings] Could not load namespace types for grouping:', err);
    return {};
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
 * Build a grouped context string from search results.
 * Results are grouped by their namespace type (if available),
 * with section headers for each group. Results without a type
 * go into an ungrouped section.
 *
 * Respects the token budget (approximated as characters / 4).
 */
function buildGroupedContextString(
  results: SearchResult[],
  namespaceTypes: Record<string, string>,
  maxTokenBudget: number
): { contextString: string; typeGroups: Record<string, number> } {
  const maxChars = maxTokenBudget * 4; // rough estimate: 1 token ≈ 4 chars

  // Group results by type
  const groups = new Map<string, SearchResult[]>();
  const ungrouped: SearchResult[] = [];

  for (const result of results) {
    const type = namespaceTypes[result.namespace];
    if (type) {
      if (!groups.has(type)) {
        groups.set(type, []);
      }
      groups.get(type)!.push(result);
    } else {
      ungrouped.push(result);
    }
  }

  // Order: typed groups first (in insertion order), then ungrouped
  const typeGroups: Record<string, number> = {};
  const parts: string[] = [];
  let totalChars = 0;

  // Header
  const header = '[CONTEXTO RELEVANTE]';
  parts.push(header);
  totalChars += header.length + 2; // +2 for newlines

  // Add each typed group as a section
  for (const [type, typeResults] of groups) {
    const groupHeader = `[${type}]`;
    const headerLen = groupHeader.length + 2; // header + newline
    const entries: string[] = [];

    let groupChars = 0;
    for (const result of typeResults) {
      const entry = `- ${result.content}`;
      if (totalChars + headerLen + groupChars + entry.length + 2 > maxChars) {
        break;
      }
      entries.push(entry);
      groupChars += entry.length + 2;
    }

    if (entries.length > 0) {
      const groupSection = `${groupHeader}\n${entries.join('\n')}`;
      parts.push(groupSection);
      totalChars += headerLen + groupChars;
      typeGroups[type] = entries.length;
    }
  }

  // Add ungrouped results (if any space left)
  if (ungrouped.length > 0) {
    const entries: string[] = [];
    for (const result of ungrouped) {
      const entry = `- ${result.content}`;
      if (totalChars + entry.length + 2 > maxChars) {
        break;
      }
      entries.push(entry);
      totalChars += entry.length + 2;
    }

    if (entries.length > 0) {
      if (groups.size > 0) {
        // If there are typed groups, add a generic section header
        const groupHeader = '[OTRO CONTEXTO]';
        const groupSection = `${groupHeader}\n${entries.join('\n')}`;
        parts.push(groupSection);
        totalChars += groupHeader.length + 2;
        typeGroups['OTRO CONTEXTO'] = entries.length;
      } else {
        // No types at all - use simple list format
        parts.push(entries.join('\n'));
        typeGroups['SIN TIPO'] = entries.length;
      }
    }
  }

  if (parts.length <= 1) return { contextString: '', typeGroups: {} };

  return {
    contextString: parts.join('\n\n'),
    typeGroups,
  };
}

/**
 * Extract embeddings metadata from a context result for SSE transmission.
 * This is a lighter version of SearchResult[] for sending over the wire.
 */
export function formatEmbeddingsForSSE(result: EmbeddingsContextResult): {
  count: number;
  namespaces: string[];
  typeGroups: Record<string, number>;
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
    typeGroups: result.typeGroups || {},
    topResults: result.results.slice(0, 5).map(r => ({
      content: r.content.slice(0, 200), // truncate for SSE payload
      similarity: r.similarity,
      namespace: r.namespace,
      source_type: r.source_type,
    })),
  };
}
