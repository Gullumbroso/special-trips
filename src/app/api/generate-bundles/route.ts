import { NextRequest } from 'next/server';
import { UserPreferences } from '@/lib/types';
import OpenAI from 'openai';
import { INTEREST_LABELS } from '@/lib/constants';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Use Edge Runtime for streaming
export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const PROMPT_ID = 'pmpt_68b758d74f60819593d91d254518d4fc020955df32c90659';

/**
 * Extracts the title from a reasoning summary.
 */
function extractSummaryTitle(text: string): string {
  const trimmedText = text.trim();
  if (trimmedText.startsWith('**')) {
    const match = trimmedText.match(/^\*\*([^*]+)\*\*/);
    return match ? match[1].trim() : trimmedText.replace(/\*\*/g, '').trim();
  }
  return trimmedText.replace(/\*\*/g, '');
}

async function handleGeneration(request: NextRequest) {
  try {
    // Try to get preferences from body (POST) or query params (GET for EventSource)
    let preferences: UserPreferences;

    if (request.method === 'POST') {
      const body = await request.json();
      preferences = body.preferences;
    } else {
      // GET request from EventSource
      const url = new URL(request.url);
      const prefsParam = url.searchParams.get('preferences');
      if (!prefsParam) {
        throw new Error('Missing preferences parameter');
      }
      preferences = JSON.parse(prefsParam);
    }

    console.log('[API] Starting background + streaming response generation');

    // Format preferences
    const interestsString = preferences.interests
      .map((interest) => INTEREST_LABELS[interest])
      .join(', ');

    let musicTasteString = preferences.musicProfile;
    if (preferences.spotifyMusicProfile) {
      const spotifyData = {
        artists: preferences.spotifyMusicProfile.artists.map((a) => a.name),
        genres: preferences.spotifyMusicProfile.genres,
      };
      musicTasteString = JSON.stringify(spotifyData);
    }

    const promptVariables = {
      interests: interestsString,
      music_taste: musicTasteString,
      date_range: preferences.timeframe,
      free_text_requests: preferences.otherPreferences || 'None',
    };

    // Create background + streaming response
    // This gives us real-time summaries while still running in background
    const stream = await openai.responses.create({
      prompt: {
        id: PROMPT_ID,
        variables: promptVariables,
      },
      background: true, // Run in background (no timeout, continues if connection drops)
      stream: true, // Stream events for real-time summaries
      store: true, // Required for background mode
      reasoning: {
        effort: 'medium',
        summary: 'auto',
      },
    });

    // Create SSE response stream
    const encoder = new TextEncoder();
    let responseId = '';

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const evt = event as any;

            // Extract response ID from first event
            if (!responseId && evt.response_id) {
              responseId = evt.response_id;
              console.log(`[API] Streaming response ${responseId}`);

              // Send response ID to client immediately
              const message = `event: response_id\ndata: ${JSON.stringify({ responseId })}\n\n`;
              controller.enqueue(encoder.encode(message));
            }

            // Send reasoning summaries
            if (evt.type === 'response.reasoning_summary_part.done') {
              const text = evt.part?.text || '';
              if (text) {
                const title = extractSummaryTitle(text);
                const message = `event: summary\ndata: ${JSON.stringify({ text: title })}\n\n`;
                controller.enqueue(encoder.encode(message));
              }
            }

            // Send completion event
            if (evt.type === 'response.completed') {
              console.log(`[API] Response ${responseId} completed`);
              const message = `event: completed\ndata: ${JSON.stringify({ responseId })}\n\n`;
              controller.enqueue(encoder.encode(message));
              controller.close();
              return;
            }

            // Send error event
            if (evt.type === 'response.failed') {
              const errorMsg = evt.response?.error?.message || 'Response failed';
              console.error(`[API] Response ${responseId} failed:`, errorMsg);
              const message = `event: error\ndata: ${JSON.stringify({ error: errorMsg })}\n\n`;
              controller.enqueue(encoder.encode(message));
              controller.close();
              return;
            }
          }
        } catch (error) {
          console.error('[API] Stream error:', error);
          const message = `event: error\ndata: ${JSON.stringify({ error: 'Stream error' })}\n\n`;
          controller.enqueue(encoder.encode(message));
          controller.close();
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[API] Error creating response:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to create generation job' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function POST(request: NextRequest) {
  return handleGeneration(request);
}

export async function GET(request: NextRequest) {
  return handleGeneration(request);
}
