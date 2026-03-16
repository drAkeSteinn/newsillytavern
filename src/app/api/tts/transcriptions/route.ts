// ============================================
// TTS Transcriptions API Route - Speech-to-Text using Whisper
// Supports TTS-WebUI (OpenAI compatible Whisper API)
// ============================================

import { NextRequest, NextResponse } from 'next/server';

// TTS-WebUI configuration
const TTS_WEBUI_DEFAULT_URL = 'http://localhost:7778';
const WHISPER_DEFAULT_MODEL = 'whisper-large-v3';

interface TranscriptionRequest {
  audio: string; // Base64 encoded audio
  model?: string;
  language?: string;
  prompt?: string;
  response_format?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
  temperature?: number;
  // Provider settings
  provider?: 'tts-webui' | 'z-ai';
  endpoint?: string;
}

interface TranscriptionResponse {
  text: string;
  language?: string;
  duration?: number;
  segments?: Array<{
    start: number;
    end: number;
    text: string;
  }>;
}

/**
 * Transcribe audio using TTS-WebUI Whisper API
 */
async function transcribeWithTTSWebUI(
  audioBase64: string,
  options: {
    endpoint: string;
    model: string;
    language?: string;
    prompt?: string;
    response_format?: string;
    temperature?: number;
  }
): Promise<{ data?: TranscriptionResponse; error?: string }> {
  const { endpoint, model, language, prompt, response_format, temperature } = options;

  try {
    // Normalize endpoint (remove trailing /v1 if present, we'll add it)
    let baseUrl = endpoint.replace(/\/v1$/, '').replace(/\/$/, '');

    // Convert base64 to buffer
    const audioBuffer = Buffer.from(audioBase64, 'base64');

    // Create form data
    const formData = new FormData();
    formData.append('file', new Blob([audioBuffer]), 'audio.wav');
    formData.append('model', model || WHISPER_DEFAULT_MODEL);

    if (language) {
      formData.append('language', language);
    }
    if (prompt) {
      formData.append('prompt', prompt);
    }
    if (response_format) {
      formData.append('response_format', response_format);
    }
    if (temperature !== undefined) {
      formData.append('temperature', temperature.toString());
    }

    console.log(`[ASR] Request to ${baseUrl}/v1/audio/transcriptions`);

    const response = await fetch(`${baseUrl}/v1/audio/transcriptions`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ASR] Error ${response.status}:`, errorText);
      return { error: `Whisper API error: ${response.status} - ${errorText}` };
    }

    const data = await response.json();
    console.log(`[ASR] Success: transcribed ${data.text?.length || 0} characters`);
    return { data };

  } catch (error) {
    console.error(`[ASR] Connection error:`, error);
    return { error: `Failed to transcribe: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

/**
 * Transcribe audio using Z.ai SDK ASR
 */
async function transcribeWithZAI(
  audioBase64: string,
  options: {
    language?: string;
    model?: string;
  }
): Promise<{ data?: TranscriptionResponse; error?: string }> {
  try {
    // Dynamic import for Z.ai SDK
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();

    // Use Z.ai ASR function
    const result = await zai.functions.invoke('asr', {
      audio: audioBase64,
      language: options.language,
      model: options.model,
    });

    if (result?.data?.text) {
      return {
        data: {
          text: result.data.text,
          language: result.data.language,
          duration: result.data.duration,
        },
      };
    }

    return { error: 'Z.ai ASR returned no transcription' };
  } catch (error) {
    return { error: `Z.ai ASR error: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: TranscriptionRequest = await request.json();

    // Validate required fields
    if (!body.audio) {
      return NextResponse.json(
        { error: 'Audio data is required (base64 encoded)' },
        { status: 400 }
      );
    }

    const provider = body.provider || 'tts-webui';
    const endpoint = body.endpoint || TTS_WEBUI_DEFAULT_URL;

    let result: { data?: TranscriptionResponse; error?: string };

    switch (provider) {
      case 'tts-webui':
        result = await transcribeWithTTSWebUI(body.audio, {
          endpoint,
          model: body.model || WHISPER_DEFAULT_MODEL,
          language: body.language,
          prompt: body.prompt,
          response_format: body.response_format,
          temperature: body.temperature,
        });
        break;

      case 'z-ai':
        result = await transcribeWithZAI(body.audio, {
          language: body.language,
          model: body.model,
        });
        break;

      default:
        return NextResponse.json(
          { error: `Unknown ASR provider: ${provider}` },
          { status: 400 }
        );
    }

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      ...result.data,
    });

  } catch (error) {
    console.error('Transcription API error:', error);
    return NextResponse.json(
      { error: `Transcription API error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

// GET endpoint to check available Whisper models
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get('endpoint') || TTS_WEBUI_DEFAULT_URL;

  // Normalize endpoint
  let baseUrl = endpoint.replace(/\/v1$/, '').replace(/\/$/, '');

  try {
    // Try a simple test to check if ASR is available
    const response = await fetch(`${baseUrl}/v1/audio/transcriptions`, {
      method: 'POST',
      body: new FormData(), // Empty form to test endpoint
    });

    // Any response (even error) means service is online
    if (response.status !== 404) {
      return NextResponse.json({
        status: 'online',
        endpoint: baseUrl,
        models: [
          { id: 'whisper-large-v3', name: 'Whisper Large V3', type: 'asr' },
          { id: 'whisper-medium', name: 'Whisper Medium', type: 'asr' },
          { id: 'whisper-small', name: 'Whisper Small', type: 'asr' },
          { id: 'whisper-tiny', name: 'Whisper Tiny', type: 'asr' },
        ],
      });
    }

    return NextResponse.json({
      status: 'offline',
      endpoint: baseUrl,
      error: `ASR endpoint not found`,
    });
  } catch (error) {
    return NextResponse.json({
      status: 'offline',
      endpoint: baseUrl,
      error: error instanceof Error ? error.message : 'Cannot connect to TTS service',
    });
  }
}
