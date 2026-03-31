import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/embeddings/namespaces - List all namespaces
 * POST /api/embeddings/namespaces - Create or update a namespace
 */
export async function GET() {
  try {
    const { LanceDBWrapper, isLanceDBAvailable } = await import('@/lib/embeddings/lancedb-db');
    
    const availability = await isLanceDBAvailable();
    if (!availability.available) {
      return NextResponse.json({
        success: true,
        data: { namespaces: [], dbAvailable: false, dbError: availability.error },
      });
    }

    const namespaces = await LanceDBWrapper.getAllNamespaces();
    return NextResponse.json({ success: true, data: { namespaces, dbAvailable: true } });
  } catch (error: any) {
    return NextResponse.json({
      success: true,
      data: { namespaces: [], dbAvailable: false, dbError: error.message || 'Error listing namespaces' },
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.namespace) {
      return NextResponse.json({ error: 'namespace is required' }, { status: 400 });
    }

    const { LanceDBWrapper } = await import('@/lib/embeddings/lancedb-db');
    const ns = await LanceDBWrapper.upsertNamespace({
      namespace: body.namespace,
      description: body.description,
      metadata: body.metadata,
    });

    return NextResponse.json({ success: true, data: ns });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Error creating namespace' }, { status: 500 });
  }
}
