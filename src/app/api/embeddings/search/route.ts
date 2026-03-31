import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/embeddings/search - Vector similarity search
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.query && !body.queryVector) {
      return NextResponse.json({ error: 'query or queryVector is required' }, { status: 400 });
    }

    const { getEmbeddingClient } = await import('@/lib/embeddings/client');
    const client = getEmbeddingClient();
    const results = await client.searchSimilar({
      query: body.query,
      queryVector: body.queryVector,
      namespace: body.namespace,
      limit: body.limit || 10,
      threshold: body.threshold || 0.5,
      source_type: body.source_type,
      source_id: body.source_id,
    });

    return NextResponse.json({ success: true, data: { results, total: results.length } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Error searching embeddings' }, { status: 500 });
  }
}
