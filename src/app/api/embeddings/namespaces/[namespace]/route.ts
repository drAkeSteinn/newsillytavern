import { NextRequest, NextResponse } from 'next/server';

/**
 * DELETE /api/embeddings/namespaces/[namespace] - Delete a namespace
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ namespace: string }> }
) {
  try {
    const { namespace } = await params;
    if (!namespace) {
      return NextResponse.json({ error: 'namespace is required' }, { status: 400 });
    }

    const { LanceDBWrapper } = await import('@/lib/embeddings/lancedb-db');
    await LanceDBWrapper.deleteNamespace(namespace);

    return NextResponse.json({ success: true, message: `Namespace "${namespace}" deleted` });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Error deleting namespace' }, { status: 500 });
  }
}
