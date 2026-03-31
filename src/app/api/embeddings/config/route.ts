import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/embeddings/config - Get current embeddings config
 * PUT /api/embeddings/config - Update embeddings config
 */
export async function GET() {
  try {
    const { getConfig } = await import('@/lib/embeddings/config-persistence');
    const config = getConfig();
    return NextResponse.json({ success: true, data: config });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Error loading config' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    const { saveConfig, invalidateConfigCache } = await import('@/lib/embeddings/config-persistence');
    invalidateConfigCache();

    const newConfig = saveConfig(body);

    // Reset the embedding client singleton so it picks up new config
    const { resetEmbeddingClient } = await import('@/lib/embeddings/client');
    resetEmbeddingClient(newConfig);

    return NextResponse.json({ success: true, data: newConfig });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Error saving config' }, { status: 500 });
  }
}
