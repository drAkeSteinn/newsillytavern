import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/embeddings/extract-memory
 *
 * Extracts memorable facts from the last assistant message using LLM,
 * then saves them as embeddings for future context retrieval.
 *
 * This endpoint is called ASYNC from chat routes (fire-and-forget).
 * It should NOT block the chat response.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      lastMessage,
      characterName,
      characterId,
      sessionId,
      groupId,
      llmConfig,
      minImportance = 2,
    } = body;

    if (!lastMessage || !characterName || !characterId) {
      return NextResponse.json({ error: 'Missing required fields: lastMessage, characterName, characterId' }, { status: 400 });
    }

    // Dynamic import to avoid loading heavy modules at startup
    const { extractAndSaveMemories } = await import('@/lib/embeddings/memory-extraction');

    const result = await extractAndSaveMemories(
      lastMessage,
      characterName,
      characterId,
      sessionId || '',
      llmConfig,
      { groupId, minImportance }
    );

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('[extract-memory] Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Memory extraction failed' }, { status: 500 });
  }
}
