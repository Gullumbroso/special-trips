import { NextRequest } from 'next/server';
import { UserPreferences } from '@/lib/types';
import OpenAI from 'openai';
import { INTEREST_LABELS } from '@/lib/constants';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

async function handleStreaming(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const responseId = url.searchParams.get('responseId');
    const startingAfter = url.searchParams.get('startingAfter');
    const prefsParam = url.searchParams.get('preferences');

    let stream;

    if (responseId && startingAfter) {
      // Resume existing stream from cursor
      console.log(`[API] Resuming stream for ${responseId} from cursor ${startingAfter.substring(0, 20)}...`);

      const response = await fetch(`https://api.openai.com/v1/responses/${responseId}?stream=true&starting_after=${startingAfter}`, {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to resume stream: ${response.statusText}`);
      }

      // Need to inject response_id event for resumed streams
      // OpenAI doesn't send it again when resuming
      const encoder = new TextEncoder();
      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            // Send response_id event first
            const idMessage = `event: response_id\ndata: ${JSON.stringify({
              responseId: responseId,
              cursor: startingAfter
            })}\n\n`;
            controller.enqueue(encoder.encode(idMessage));

            // Then pipe the rest of the stream
            const reader = response.body?.getReader();
            if (!reader) {
              controller.close();
              return;
            }

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              controller.enqueue(value);
            }
          } catch (error) {
            console.error('[API] Error piping resumed stream:', error);
          } finally {
            controller.close();
          }
        }
      });

      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } else if (responseId) {
      // Resume existing stream from beginning (no cursor)
      console.log(`[API] Resuming stream for ${responseId} from beginning...`);

      const response = await fetch(`https://api.openai.com/v1/responses/${responseId}?stream=true`, {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to resume stream: ${response.statusText}`);
      }

      // Need to inject response_id event for resumed streams
      const encoder = new TextEncoder();
      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            // Send response_id event first
            const idMessage = `event: response_id\ndata: ${JSON.stringify({
              responseId: responseId
            })}\n\n`;
            controller.enqueue(encoder.encode(idMessage));

            // Then pipe the rest of the stream
            const reader = response.body?.getReader();
            if (!reader) {
              controller.close();
              return;
            }

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              controller.enqueue(value);
            }
          } catch (error) {
            console.error('[API] Error piping resumed stream:', error);
          } finally {
            controller.close();
          }
        }
      });

      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } else {
      // Create new background + streaming response
      if (!prefsParam) {
        throw new Error('Missing preferences parameter');
      }

      const preferences: UserPreferences = JSON.parse(prefsParam);
      console.log('[API] Creating new background + streaming response');

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

      // Create background + streaming response (as per OpenAI docs)
      stream = await openai.responses.create({
        prompt: {
          id: PROMPT_ID,
          variables: promptVariables,
        },
        background: true, // Runs in background (no timeout, continues if connection drops)
        stream: true, // Stream events with cursor for resumption
        store: true, // Required for background mode
        reasoning: {
          effort: 'low',
          summary: 'auto',
        },
      });
    }

    // Stream SSE events to client with cursor tracking
    const encoder = new TextEncoder();
    let responseIdFromStream = '';

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const evt = event as any;

            // Extract response ID from first event (it's in response.id)
            if (!responseIdFromStream && evt.response?.id) {
              responseIdFromStream = evt.response.id;
              console.log(`[Response ID] ${responseIdFromStream}`);

              const message = `event: response_id\ndata: ${JSON.stringify({
                responseId: responseIdFromStream,
                cursor: evt.sequence_number
              })}\n\n`;
              controller.enqueue(encoder.encode(message));
            }

            // Send cursor updates with every event
            if (evt.sequence_number) {
              const message = `event: cursor\ndata: ${JSON.stringify({
                cursor: evt.sequence_number
              })}\n\n`;
              controller.enqueue(encoder.encode(message));
            }

            // Send reasoning summaries
            if (evt.type === 'response.reasoning_summary_part.done') {
              const text = evt.part?.text || '';
              if (text) {
                const title = extractSummaryTitle(text);
                const message = `event: summary\ndata: ${JSON.stringify({
                  text: title,
                  cursor: evt.sequence_number
                })}\n\n`;
                controller.enqueue(encoder.encode(message));
              }
            }

            // Send completion event
            if (evt.type === 'response.completed') {
              console.log(`[API] Response ${responseIdFromStream} completed`);
              const message = `event: completed\ndata: ${JSON.stringify({
                responseId: responseIdFromStream,
                cursor: evt.sequence_number
              })}\n\n`;
              controller.enqueue(encoder.encode(message));
              controller.close();
              return;
            }

            // Send error event
            if (evt.type === 'response.failed') {
              const errorMsg = evt.response?.error?.message || 'Response failed';
              console.error(`[API] Response ${responseIdFromStream} failed:`, errorMsg);
              const message = `event: error\ndata: ${JSON.stringify({
                error: errorMsg,
                cursor: evt.sequence_number
              })}\n\n`;
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
    console.error('[API] Error in streaming:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to create or resume stream' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function GET(request: NextRequest) {
  return handleStreaming(request);
}
