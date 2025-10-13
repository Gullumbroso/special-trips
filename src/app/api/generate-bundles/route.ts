import { NextRequest } from 'next/server';
import { UserPreferences, TripBundle } from '@/lib/types';
import OpenAI from 'openai';
import { INTEREST_LABELS } from '@/lib/constants';
import { fetchEventImages } from '@/lib/opengraph';
import { getBundleImageUrl } from '@/lib/utils';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});


export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const PROMPT_ID = 'pmpt_68b758d74f60819593d91d254518d4fc020955df32c90659';

// Timing utilities
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms.toFixed(0)}ms`;
  }
  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(2)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds.toFixed(2)}s`;
}

function logTiming(label: string, duration: number) {
  console.log(`⏱️  ${label}: ${formatDuration(duration)}`);
}

// Global timing tracker
interface TimingData {
  requestStart: number;
  openaiResponseCount: number;
  openaiTotalTime: number;
  functionCallTotalTime: number;
  currentResponseStart?: number;
}

/**
 * Attempts to repair common JSON syntax errors
 */
function repairJSON(jsonString: string): string {
  let repaired = jsonString;

  // Fix 1: Remove trailing commas before closing braces/brackets
  repaired = repaired.replace(/,(\s*[}\]])/g, '$1');

  // Fix 2: Escape unescaped quotes within string values
  repaired = repaired.replace(/:\\s*"([^"]*)"([^,}\]])/g, (match, content, after) => {
    if (after && ![',', '}', ']', '\n', '\r'].includes(after.trim()[0])) {
      return `: "${content}\\"${after}`;
    }
    return match;
  });

  return repaired;
}

/**
 * Formats user preferences into prompt variables for OpenAI.
 */
function formatPromptVariables(preferences: UserPreferences): Record<string, string> {
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

  return {
    interests: interestsString,
    music_taste: musicTasteString,
    date_range: preferences.timeframe,
    free_text_requests: preferences.otherPreferences || 'None',
  };
}

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

/**
 * Creates an OpenAI response with standard parameters
 */
function createOpenAIResponse(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  promptVariables: Record<string, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: Array<any>
) {
  console.log('[API] Creating OpenAI response with:');
  console.log(`[API]   - Prompt ID: ${PROMPT_ID}`);
  console.log(`[API]   - Input items: ${input.length}`);
  console.log(`[API]   - Variables: ${JSON.stringify(Object.keys(promptVariables))}`);

  return openai.responses.create({
    prompt: {
      id: PROMPT_ID,
      variables: promptVariables,
    },
    input,
    background: true,
    stream: true,
    store: true,
    reasoning: {
      effort: 'medium',
      summary: 'auto',
    },
  });
}

/**
 * Executes function calls and returns updated conversation input
 */
async function executeFunctionCalls(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  functionCallItems: Array<any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  allOutputItems: Array<any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  conversationInput: Array<any>,
  logPrefix: string = '[API]'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<Array<any>> {
  console.log(`${logPrefix} Executing ${functionCallItems.length} function call(s)...`);

  // Build new input with ALL output items
  const newConversationInput = [...conversationInput];

  // Add ALL output items from response (required for reasoning models)
  for (const item of allOutputItems) {
    if (item && typeof item === 'object') {
      newConversationInput.push(item);
    }
  }

  // Execute functions and add outputs
  for (const toolCall of functionCallItems) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: Record<string, any>;
    if (toolCall.name === 'fetch_event_images') {
      const args = JSON.parse(toolCall.arguments);
      const images = await fetchEventImages(args.url);
      result = { images, url: args.url };
      console.log(`${logPrefix} Fetched ${images.length} images for ${args.url}`);
    } else {
      console.error(`${logPrefix} Unknown function: ${toolCall.name}`);
      result = { error: `Unknown function: ${toolCall.name}` };
    }

    newConversationInput.push({
      type: 'function_call_output',
      call_id: toolCall.call_id,
      output: JSON.stringify(result),
    });
  }

  return newConversationInput;
}

/**
 * Extracts bundles from message output with JSON repair fallback
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractBundles(allOutputItems: Array<any>): any[] | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messageOutput = allOutputItems.find((item: any) =>
    item && typeof item === 'object' && item.type === 'message'
  );

  if (!messageOutput || !('content' in messageOutput)) {
    console.warn(`[API] No message output found in response`);
    return null;
  }

  const content = messageOutput.content as Array<{ type: string; text?: string }>;

  // Try output_text first, then text
  let textContent = content.find(c => c.type === 'output_text')?.text || null;
  if (!textContent) {
    textContent = content.find(c => c.type === 'text')?.text || null;
  }

  if (!textContent) {
    console.warn(`[API] No text content in message output`);
    return null;
  }

  try {
    const parsed = JSON.parse(textContent);
    let bundles = parsed.bundles || null;

    // Deterministically set bundle imageUrl based on key events
    if (bundles && Array.isArray(bundles)) {
      bundles = bundles.map((bundle: TripBundle) => {
        const determinedImageUrl = getBundleImageUrl(bundle.keyEvents || []);
        bundle.imageUrl = determinedImageUrl;

        if (determinedImageUrl.startsWith('/fallback-images/')) {
          console.log(`[API] Bundle "${bundle.title}" using fallback image`);
        } else {
          console.log(`[API] Bundle "${bundle.title}" using image from key event`);
        }

        return bundle;
      });
    }

    console.log(`[API] Extracted ${bundles?.length || 0} bundles`);
    return bundles;
  } catch (e) {
    console.error(`[API] Failed to parse bundles:`, e);

    // Attempt to repair and reparse
    console.log(`[API] Attempting to repair malformed JSON...`);
    try {
      const repairedContent = repairJSON(textContent);
      const fixedParsed = JSON.parse(repairedContent);
      let bundles = fixedParsed.bundles || null;

      // Deterministically set bundle imageUrl based on key events
      if (bundles && Array.isArray(bundles)) {
        bundles = bundles.map((bundle: TripBundle) => {
          const determinedImageUrl = getBundleImageUrl(bundle.keyEvents || []);
          bundle.imageUrl = determinedImageUrl;

          if (determinedImageUrl.startsWith('/fallback-images/')) {
            console.log(`[API] Bundle "${bundle.title}" using fallback image`);
          } else {
            console.log(`[API] Bundle "${bundle.title}" using image from key event`);
          }

          return bundle;
        });
      }

      console.log(`[API] ✅ Successfully recovered ${bundles?.length || 0} bundles after JSON repair`);
      return bundles;
    } catch {
      console.error(`[API] ❌ Could not recover bundles after repair attempt`);
      console.error(`[API] First 500 chars of response:`, textContent.substring(0, 500));
      return null;
    }
  }
}

/**
 * Processes a stream recursively, handling function calls along the way.
 */
async function processStream(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  streamPromise: Promise<AsyncIterable<any>>,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  promptVariables: Record<string, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  conversationInput: Array<any> = [],
  responseIdRef: { current: string } = { current: '' },
  timingData?: TimingData
) {
  try {
    const responseStartTime = Date.now();
    const responseNumber = timingData ? timingData.openaiResponseCount + 1 : 1;

    if (timingData) {
      timingData.openaiResponseCount = responseNumber;
      timingData.currentResponseStart = responseStartTime;
    }

    console.log(`🤖 OpenAI Response #${responseNumber} - Waiting for stream...`);
    const stream = await streamPromise;
    console.log(`🤖 OpenAI Response #${responseNumber} - Stream started`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const finalToolCalls: Record<number, any> = {};

    for await (const event of stream) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const evt = event as any;

      // Extract and track response ID
      if (evt.response?.id) {
        const newResponseId = evt.response.id;

        // Only send response_id event if it's different from what we're tracking
        if (!responseIdRef.current || responseIdRef.current !== newResponseId) {
          responseIdRef.current = newResponseId;
          console.log(`[API] Response ID: ${responseIdRef.current}`);

          const message = `event: response_id\ndata: ${JSON.stringify({
            responseId: responseIdRef.current,
            cursor: evt.sequence_number
          })}\n\n`;
          controller.enqueue(encoder.encode(message));
        }
      }

      // Send cursor updates with every event
      if (evt.sequence_number) {
        const message = `event: cursor\ndata: ${JSON.stringify({
          cursor: evt.sequence_number
        })}\n\n`;
        controller.enqueue(encoder.encode(message));
      }

      // Store ALL output items by index
      if (evt.type === 'response.output_item.added') {
        finalToolCalls[evt.output_index] = evt.item;
      }

      // Accumulate function arguments as they stream
      if (evt.type === 'response.function_call_arguments.delta') {
        const index = evt.output_index;
        if (finalToolCalls[index]) {
          finalToolCalls[index].arguments = (finalToolCalls[index].arguments || '') + evt.delta;
        }
      }

      // Send reasoning summaries to client
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

      // Handle completion
      if (evt.type === 'response.completed') {
        const responseTime = Date.now() - responseStartTime;
        if (timingData) {
          timingData.openaiTotalTime += responseTime;
        }
        logTiming(`OpenAI Response #${responseNumber} completed`, responseTime);
        console.log(`[API] Response completed: ${responseIdRef.current}`);

        const allOutputItems = evt.response?.output || Object.values(finalToolCalls);

        // Filter for function_call items ONLY
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const functionCallItems = allOutputItems.filter((item: any) =>
          item && typeof item === 'object' && item.type === 'function_call'
        );

        if (functionCallItems.length > 0) {
          const functionCallStartTime = Date.now();
          console.log(`🔧 Executing ${functionCallItems.length} function call(s)...`);

          const newConversationInput = await executeFunctionCalls(
            functionCallItems,
            allOutputItems,
            conversationInput,
            '[API]'
          );

          const functionCallTime = Date.now() - functionCallStartTime;
          if (timingData) {
            timingData.functionCallTotalTime += functionCallTime;
          }
          logTiming(`Function calls completed (${functionCallItems.length} calls)`, functionCallTime);

          // Recursive: Create NEW response with function outputs
          console.log(`[API] Creating recursive response with function outputs`);
          await processStream(
            createOpenAIResponse(promptVariables, newConversationInput),
            controller,
            encoder,
            promptVariables,
            newConversationInput,
            responseIdRef,
            timingData
          );
          return;
        }

        // No more function calls - extract bundles and send final completion event
        console.log(`[API] Extracting final bundles`);

        // Log final timing summary
        if (timingData) {
          const totalTime = Date.now() - timingData.requestStart;
          console.log(`\n📊 === TIMING SUMMARY ===`);
          logTiming(`Total Request Duration`, totalTime);
          logTiming(`Total OpenAI Time (${timingData.openaiResponseCount} responses)`, timingData.openaiTotalTime);
          logTiming(`Total Function Call Time`, timingData.functionCallTotalTime);
          const overhead = totalTime - timingData.openaiTotalTime - timingData.functionCallTotalTime;
          logTiming(`Processing Overhead`, overhead);
          console.log(`========================\n`);
        }

        const bundles = extractBundles(allOutputItems);

        const message = `event: completed\ndata: ${JSON.stringify({
          responseId: responseIdRef.current,
          cursor: evt.sequence_number,
          bundles: bundles
        })}\n\n`;
        console.log(`[API] Stream completed with ${bundles?.length || 0} bundles`);
        controller.enqueue(encoder.encode(message));
        controller.close();
        return;
      }

      // Handle errors
      if (evt.type === 'response.failed') {
        const errorMsg = evt.response?.error?.message || 'Response failed';
        console.error(`[API] Response ${responseIdRef.current} failed:`, errorMsg);
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

    // Log full error details for debugging
    if (error && typeof error === 'object') {
      console.error('[API] Error details:', JSON.stringify(error, null, 2));
    }

    const errorMsg = error instanceof Error ? error.message : 'Stream processing error';
    const message = `event: error\ndata: ${JSON.stringify({ error: errorMsg })}\n\n`;
    controller.enqueue(encoder.encode(message));
    controller.close();
  }
}

/**
 * Handles resuming an existing OpenAI response stream
 */
async function handleResumeStream(
  responseId: string,
  startingAfter: string | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  promptVariables: Record<string, any>
): Promise<Response> {
  const logPrefix = startingAfter ? '[API] [Resume+Cursor]' : '[API] [Resume]';
  console.log(`${logPrefix} Resuming stream for ${responseId}${startingAfter ? ` from cursor ${startingAfter.substring(0, 20)}...` : ' from beginning...'}`);

  const url = startingAfter
    ? `https://api.openai.com/v1/responses/${responseId}?stream=true&starting_after=${startingAfter}`
    : `https://api.openai.com/v1/responses/${responseId}?stream=true`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    console.error(`${logPrefix} Failed to resume stream: ${response.status} ${response.statusText}`);
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      start(controller) {
        const message = `event: error\ndata: ${JSON.stringify({
          error: `Failed to resume stream: ${response.statusText}`,
          clearStorage: true
        })}\n\n`;
        controller.enqueue(encoder.encode(message));
        controller.close();
      }
    });
    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const readableStream = new ReadableStream({
    async start(controller) {
      try {
        // Send response_id event first
        const idMessage = `event: response_id\ndata: ${JSON.stringify({
          responseId: responseId,
          ...(startingAfter && { cursor: startingAfter })
        })}\n\n`;
        controller.enqueue(encoder.encode(idMessage));

        // Parse and transform the SSE stream
        const reader = response.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                // Send cursor updates
                if (data.sequence_number) {
                  const cursorMsg = `event: cursor\ndata: ${JSON.stringify({
                    cursor: data.sequence_number
                  })}\n\n`;
                  controller.enqueue(encoder.encode(cursorMsg));
                }

                // Transform reasoning summaries
                if (data.type === 'response.reasoning_summary_part.done') {
                  const text = data.part?.text || '';
                  if (text) {
                    const title = extractSummaryTitle(text);
                    const summaryMsg = `event: summary\ndata: ${JSON.stringify({
                      text: title,
                      cursor: data.sequence_number
                    })}\n\n`;
                    controller.enqueue(encoder.encode(summaryMsg));
                  }
                }

                // Handle completion
                if (data.type === 'response.completed') {
                  const allOutputItems = data.response?.output || [];

                  // Check for function calls first
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const functionCallItems = allOutputItems.filter((item: any) =>
                    item && typeof item === 'object' && item.type === 'function_call'
                  );

                  if (functionCallItems.length > 0) {
                    console.log(`${logPrefix} Found ${functionCallItems.length} function call(s), executing and continuing...`);

                    // Cancel the old reader to stop receiving events
                    await reader.cancel();

                    // Execute functions (starts with empty conversation input for resume)
                    const newConversationInput = await executeFunctionCalls(
                      functionCallItems,
                      allOutputItems,
                      [],
                      logPrefix
                    );

                    // Create new response with function outputs and continue with processStream
                    console.log(`${logPrefix} Creating recursive response with function outputs`);
                    const responseIdRef = { current: responseId };
                    await processStream(
                      createOpenAIResponse(promptVariables, newConversationInput),
                      controller,
                      encoder,
                      promptVariables,
                      newConversationInput,
                      responseIdRef
                    );
                    return;
                  }

                  // No function calls - extract bundles and complete normally
                  const bundles = extractBundles(allOutputItems);

                  const completedMsg = `event: completed\ndata: ${JSON.stringify({
                    responseId: responseId,
                    cursor: data.sequence_number,
                    bundles: bundles
                  })}\n\n`;
                  controller.enqueue(encoder.encode(completedMsg));
                }

                // Handle errors
                if (data.type === 'response.failed') {
                  const errorMsg = data.response?.error?.message || 'Response failed';
                  const errorEvent = `event: error\ndata: ${JSON.stringify({
                    error: errorMsg,
                    cursor: data.sequence_number
                  })}\n\n`;
                  controller.enqueue(encoder.encode(errorEvent));
                }
              } catch (e) {
                console.warn(`${logPrefix} Failed to parse SSE data:`, e);
              }
            }
          }
        }
      } catch (error) {
        console.error(`${logPrefix} Error piping resumed stream:`, error);
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
}

async function handleStreaming(request: NextRequest) {
  try {
    // Validate API key is set
    if (!process.env.OPENAI_API_KEY) {
      console.error('[API] OPENAI_API_KEY is not set');
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(request.url);
    const responseId = url.searchParams.get('responseId');
    const startingAfter = url.searchParams.get('startingAfter');
    const prefsParam = url.searchParams.get('preferences');

    // Validate and parse preferences (needed for all paths)
    if (!prefsParam) {
      return new Response(
        JSON.stringify({ error: 'Missing preferences parameter' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    const preferences: UserPreferences = JSON.parse(prefsParam);
    const promptVariables = formatPromptVariables(preferences);

    console.log('[API] Request preferences:', JSON.stringify(preferences, null, 2));

    // Handle resume scenarios
    if (responseId) {
      return handleResumeStream(responseId, startingAfter, promptVariables);
    }

    // Create new background + streaming response
    const requestStart = Date.now();
    console.log('🚀 === STARTING NEW BUNDLE GENERATION REQUEST ===');
    console.log(`[API] Creating new background + streaming response`);

    const encoder = new TextEncoder();
    const responseIdRef = { current: '' };

    // Initialize timing tracker
    const timingData: TimingData = {
      requestStart,
      openaiResponseCount: 0,
      openaiTotalTime: 0,
      functionCallTotalTime: 0,
    };

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          await processStream(
            createOpenAIResponse(promptVariables, []),
            controller,
            encoder,
            promptVariables,
            [],
            responseIdRef,
            timingData
          );
        } catch (error) {
          console.error('[API] Failed to create stream:', error);
          const message = `event: error\ndata: ${JSON.stringify({
            error: error instanceof Error ? error.message : 'Failed to create stream'
          })}\n\n`;
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
