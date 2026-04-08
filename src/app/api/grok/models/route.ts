// ============================================
// Grok (xAI) Models API - Proxy to fetch available models
// ============================================

import { NextRequest, NextResponse } from 'next/server';

// Known Grok models with their metadata
const KNOWN_GROK_MODELS = [
  {
    id: 'grok-4-1-fast-reasoning',
    name: 'Grok 4.1 Fast Reasoning',
    context: '2M tokens',
    capabilities: 'Reasoning, Functions, Vision, Structured Output',
    tier: 'flagship',
  },
  {
    id: 'grok-4-1-fast-non-reasoning',
    name: 'Grok 4.1 Fast Non-Reasoning',
    context: '2M tokens',
    capabilities: 'Functions, Vision, Structured Output',
    tier: 'flagship',
  },
  {
    id: 'grok-4-0709',
    name: 'Grok 4 (07-09)',
    context: '256K tokens',
    capabilities: 'Reasoning, Functions, Structured Output',
    tier: 'flagship',
  },
  {
    id: 'grok-code-fast-1',
    name: 'Grok Code Fast 1',
    context: '256K tokens',
    capabilities: 'Reasoning, Functions, Code-Optimized',
    tier: 'specialized',
  },
  {
    id: 'grok-3',
    name: 'Grok 3',
    context: '131K tokens',
    capabilities: 'Functions, Structured Output',
    tier: 'standard',
  },
  {
    id: 'grok-3-mini',
    name: 'Grok 3 Mini',
    context: '131K tokens',
    capabilities: 'Reasoning, Functions, Structured Output',
    tier: 'lightweight',
  },
  {
    id: 'grok-3-beta',
    name: 'Grok 3 Beta',
    context: '131K tokens',
    capabilities: 'Functions, Structured Output',
    tier: 'legacy',
  },
  {
    id: 'grok-3-mini-beta',
    name: 'Grok 3 Mini Beta',
    context: '131K tokens',
    capabilities: 'Reasoning, Functions',
    tier: 'legacy',
  },
  {
    id: 'grok-2',
    name: 'Grok 2',
    context: '131K tokens',
    capabilities: 'Functions',
    tier: 'legacy',
  },
  {
    id: 'grok-2-vision',
    name: 'Grok 2 Vision',
    context: '8K tokens',
    capabilities: 'Vision, Image Understanding',
    tier: 'legacy',
  },
  {
    id: 'grok-beta',
    name: 'Grok Beta (Original)',
    context: '131K tokens',
    capabilities: 'Basic Chat',
    tier: 'legacy',
  },
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const apiKey = searchParams.get('apiKey');
  const endpoint = searchParams.get('endpoint');

  // If API key is provided, try to fetch from the live API
  if (apiKey && endpoint) {
    try {
      const baseUrl = endpoint.replace(/\/+$/, '');
      const modelsUrl = baseUrl.endsWith('/v1')
        ? `${baseUrl}/models`
        : `${baseUrl}/v1/models`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(modelsUrl, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        // If live fetch fails, fall back to known models
        console.warn(`[Grok Models] API returned ${response.status}, falling back to known models`);
        return NextResponse.json({
          source: 'fallback',
          data: KNOWN_GROK_MODELS,
          message: `No se pudo conectar a la API (${response.status}), usando modelos conocidos`,
        });
      }

      const data = await response.json();

      // Merge API results with known metadata
      const apiModels = (data.data || []).map((m: { id: string }) => {
        const known = KNOWN_GROK_MODELS.find(k => k.id === m.id);
        return known || {
          id: m.id,
          name: m.id,
          context: 'N/A',
          capabilities: 'Desconocido',
          tier: 'other',
        };
      });

      // Add any known models not returned by API
      const apiIds = new Set(apiModels.map((m: { id: string }) => m.id));
      const missing = KNOWN_GROK_MODELS.filter(k => !apiIds.has(k.id));

      return NextResponse.json({
        source: 'api',
        data: [...apiModels, ...missing],
        total: apiModels.length + missing.length,
      });
    } catch (err) {
      const message = err instanceof Error && err.name === 'AbortError'
        ? 'Tiempo de espera agotado (8s)'
        : err instanceof Error
          ? err.message
          : 'Error de conexión';

      console.warn(`[Grok Models] API fetch failed: ${message}, falling back to known models`);
      return NextResponse.json({
        source: 'fallback',
        data: KNOWN_GROK_MODELS,
        message: `Error de conexión: ${message}`,
      });
    }
  }

  // No API key - return known models only
  return NextResponse.json({
    source: 'known',
    data: KNOWN_GROK_MODELS,
    total: KNOWN_GROK_MODELS.length,
  });
}
