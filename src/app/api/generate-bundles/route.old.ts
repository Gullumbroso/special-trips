import { NextRequest } from 'next/server';
import { UserPreferences } from '@/lib/types';
import OpenAI from 'openai';
import { INTEREST_LABELS } from '@/lib/constants';
import { fetchEventImages } from '@/lib/opengraph';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const runtime = 'edge';
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
  // This regex finds quotes that appear after ": " and aren't properly escaped
  // It's not perfect but handles common cases
  repaired = repaired.replace(/:\\s*"([^"]*)"([^,}\]])/g, (match, content, after) => {
    // If the character after the quote isn't a comma, closing brace, or bracket,
    // it means the quote wasn't properly closed
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
 * Processes a stream recursively, handling function calls along the way.
 * This function accumulates ALL output items (reasoning, web_search, function_call)
 * and recursively creates new responses when function calls are detected.
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
      // Note: Each recursive call creates a NEW response with a new ID
      // We want to track the LATEST response ID (the one that will have the final output)
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

      // Store ALL output items by index (reasoning, web_search, function_call, etc.)
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

        // Use the full response.output from the completed event, not our accumulated items
        // This is because when resuming/continuing, OpenAI doesn't re-send all output_item.added events
        const allOutputItems = evt.response?.output || Object.values(finalToolCalls);

        // Filter for function_call items ONLY
        const functionCallItems = allOutputItems.filter(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (item: any) => item && typeof item === 'object' && item.type === 'function_call'
        );

        if (functionCallItems.length > 0) {
          const functionCallStartTime = Date.now();
          console.log(`🔧 Executing ${functionCallItems.length} function call(s)...`);

          // Build new input with ALL output items + function outputs
          const newConversationInput = [...conversationInput];

          // Add ALL output items from response (required for reasoning models)
          // Use allOutputItems (from evt.response.output) instead of finalToolCalls
          // because allOutputItems contains ALL items including reasoning and web_search
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
              console.log(`[API] Fetched ${images.length} images for ${args.url}`);
            } else {
              console.error(`[API] Unknown function: ${toolCall.name}`);
              result = { error: `Unknown function: ${toolCall.name}` };
            }

            newConversationInput.push({
              type: 'function_call_output',
              call_id: toolCall.call_id,
              output: JSON.stringify(result),
            });
          }

          const functionCallTime = Date.now() - functionCallStartTime;
          if (timingData) {
            timingData.functionCallTotalTime += functionCallTime;
          }
          logTiming(`Function calls completed (${functionCallItems.length} calls)`, functionCallTime);

          // Recursive: Create NEW response with function outputs and process its stream
          console.log(`[API] Creating recursive response with function outputs`);
          await processStream(
            openai.responses.create({
              prompt: {
                id: PROMPT_ID,
                variables: promptVariables,
              },
              input: newConversationInput,
              background: true,
              stream: true,
              store: true,
              reasoning: {
                effort: 'medium',
                summary: 'auto',
              },
            }),
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

        let bundles = null;

        // Extract bundles from the response output
        const messageOutput = allOutputItems.find(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (item: any) => item && typeof item === 'object' && item.type === 'message'
        );

        if (messageOutput && 'content' in messageOutput) {
          const content = messageOutput.content as Array<{ type: string; text?: string }>;

          // Try output_text first, then text
          let textContent = content.find(c => c.type === 'output_text')?.text || null;
          if (!textContent) {
            textContent = content.find(c => c.type === 'text')?.text || null;
          }

          if (textContent) {
            try {
              const parsed = JSON.parse(textContent);
              bundles = parsed.bundles || null;
              console.log(`[API] Extracted ${bundles?.length || 0} bundles`);
            } catch (e) {
              console.error(`[API] Failed to parse bundles:`, e);

              // Attempt to repair and reparse
              console.log(`[API] Attempting to repair malformed JSON...`);
              try {
                const repairedContent = repairJSON(textContent);
                const fixedParsed = JSON.parse(repairedContent);
                bundles = fixedParsed.bundles || null;
                console.log(`[API] ✅ Successfully recovered ${bundles?.length || 0} bundles after JSON repair`);
              } catch {
                console.error(`[API] ❌ Could not recover bundles after repair attempt`);
                console.error(`[API] First 500 chars of response:`, textContent.substring(0, 500));
                bundles = null;
              }
            }
          } else {
            console.warn(`[API] No text content in message output`);
          }
        } else {
          console.warn(`[API] No message output found in response`);
        }

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
    const errorMsg = error instanceof Error ? error.message : 'Stream processing error';
    const message = `event: error\ndata: ${JSON.stringify({ error: errorMsg })}\n\n`;
    controller.enqueue(encoder.encode(message));
    controller.close();
  }
}

async function handleStreaming(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const responseId = url.searchParams.get('responseId');
    const startingAfter = url.searchParams.get('startingAfter');
    const prefsParam = url.searchParams.get('preferences');

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
        console.error(`[API] Failed to resume stream: ${response.status} ${response.statusText}`);
        // Return an error response that tells client to clear storage
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

      // Get preferences and format prompt variables for potential tool calls
      if (!prefsParam) {
        return new Response(
          JSON.stringify({ error: 'Missing preferences parameter for resume' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      const preferences: UserPreferences = JSON.parse(prefsParam);
      const promptVariables = formatPromptVariables(preferences);

      // Need to transform OpenAI SSE events to our custom format
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            // Send response_id event first
            const idMessage = `event: response_id\ndata: ${JSON.stringify({
              responseId: responseId,
              cursor: startingAfter
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
                      const functionCallItems = allOutputItems.filter(
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (item: any) => item && typeof item === 'object' && item.type === 'function_call'
                      );

                      if (functionCallItems.length > 0) {
                        console.log(`[API] [Resume+Cursor] Found ${functionCallItems.length} function call(s), executing and continuing...`);

                        // Cancel the old reader to stop receiving events
                        await reader.cancel();

                        // Build conversation input from all output items
                        const conversationInput = [];
                        for (const item of allOutputItems) {
                          if (item && typeof item === 'object') {
                            conversationInput.push(item);
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
                            console.log(`[API] [Resume+Cursor] Fetched ${images.length} images for ${args.url}`);
                          } else {
                            console.error(`[API] [Resume+Cursor] Unknown function: ${toolCall.name}`);
                            result = { error: `Unknown function: ${toolCall.name}` };
                          }

                          conversationInput.push({
                            type: 'function_call_output',
                            call_id: toolCall.call_id,
                            output: JSON.stringify(result),
                          });
                        }

                        // Create new response with function outputs and continue with processStream
                        console.log(`[API] [Resume+Cursor] Creating recursive response with function outputs`);
                        const responseIdRef = { current: responseId };
                        await processStream(
                          openai.responses.create({
                            prompt: {
                              id: PROMPT_ID,
                              variables: promptVariables,
                            },
                            input: conversationInput,
                            background: true,
                            stream: true,
                            store: true,
                            reasoning: {
                              effort: 'medium',
                              summary: 'auto',
                            },
                          }),
                          controller,
                          encoder,
                          promptVariables,
                          conversationInput,
                          responseIdRef
                        );
                        return; // processStream will handle closing the controller
                      }

                      // No function calls - extract bundles and complete normally
                      let bundles = null;

                      const messageOutput = allOutputItems.find(
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (item: any) => item && typeof item === 'object' && item.type === 'message'
                      );

                      if (messageOutput && 'content' in messageOutput) {
                        const content = messageOutput.content as Array<{ type: string; text?: string }>;
                        let textContent = content.find(c => c.type === 'output_text')?.text || null;
                        if (!textContent) {
                          textContent = content.find(c => c.type === 'text')?.text || null;
                        }

                        if (textContent) {
                          try {
                            const parsed = JSON.parse(textContent);
                            bundles = parsed.bundles || null;
                          } catch (e) {
                            console.error(`[API] Failed to parse bundles:`, e);
                          }
                        }
                      }

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
                    // Skip malformed JSON
                    console.warn('[API] Failed to parse SSE data:', e);
                  }
                }
              }
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

      // Get preferences and format prompt variables for potential tool calls
      if (!prefsParam) {
        return new Response(
          JSON.stringify({ error: 'Missing preferences parameter for resume' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      const preferences: UserPreferences = JSON.parse(prefsParam);
      const promptVariables = formatPromptVariables(preferences);

      const response = await fetch(`https://api.openai.com/v1/responses/${responseId}?stream=true`, {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error(`[API] Failed to resume stream from beginning: ${response.status} ${response.statusText}`);
        // Return an error response that tells client to clear storage
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

      // Need to transform OpenAI SSE events to our custom format
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            // Send response_id event first
            const idMessage = `event: response_id\ndata: ${JSON.stringify({
              responseId: responseId
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
                      const functionCallItems = allOutputItems.filter(
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (item: any) => item && typeof item === 'object' && item.type === 'function_call'
                      );

                      if (functionCallItems.length > 0) {
                        console.log(`[API] [Resume] Found ${functionCallItems.length} function call(s), executing and continuing...`);

                        // Cancel the old reader to stop receiving events
                        await reader.cancel();

                        // Build conversation input from all output items
                        const conversationInput = [];
                        for (const item of allOutputItems) {
                          if (item && typeof item === 'object') {
                            conversationInput.push(item);
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
                            console.log(`[API] [Resume] Fetched ${images.length} images for ${args.url}`);
                          } else {
                            console.error(`[API] [Resume] Unknown function: ${toolCall.name}`);
                            result = { error: `Unknown function: ${toolCall.name}` };
                          }

                          conversationInput.push({
                            type: 'function_call_output',
                            call_id: toolCall.call_id,
                            output: JSON.stringify(result),
                          });
                        }

                        // Create new response with function outputs and continue with processStream
                        console.log(`[API] [Resume] Creating recursive response with function outputs`);
                        const responseIdRef = { current: responseId };
                        await processStream(
                          openai.responses.create({
                            prompt: {
                              id: PROMPT_ID,
                              variables: promptVariables,
                            },
                            input: conversationInput,
                            background: true,
                            stream: true,
                            store: true,
                            reasoning: {
                              effort: 'medium',
                              summary: 'auto',
                            },
                          }),
                          controller,
                          encoder,
                          promptVariables,
                          conversationInput,
                          responseIdRef
                        );
                        return; // processStream will handle closing the controller
                      }

                      // No function calls - extract bundles and complete normally
                      let bundles = null;

                      const messageOutput = allOutputItems.find(
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (item: any) => item && typeof item === 'object' && item.type === 'message'
                      );

                      if (messageOutput && 'content' in messageOutput) {
                        const content = messageOutput.content as Array<{ type: string; text?: string }>;
                        let textContent = content.find(c => c.type === 'output_text')?.text || null;
                        if (!textContent) {
                          textContent = content.find(c => c.type === 'text')?.text || null;
                        }

                        if (textContent) {
                          try {
                            const parsed = JSON.parse(textContent);
                            bundles = parsed.bundles || null;
                          } catch (e) {
                            console.error(`[API] Failed to parse bundles:`, e);
                          }
                        }
                      }

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
                    // Skip malformed JSON
                    console.warn('[API] Failed to parse SSE data:', e);
                  }
                }
              }
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
      const requestStart = Date.now();
      console.log('🚀 === STARTING NEW BUNDLE GENERATION REQUEST ===');
      console.log(`[API] Creating new background + streaming response`);

      // Format preferences into prompt variables
      const promptVariables = formatPromptVariables(preferences);

      // Create stream with recursive function calling support
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
              openai.responses.create({
                prompt: {
                  id: PROMPT_ID,
                  variables: promptVariables,
                },
                background: true,
                stream: true,
                store: true,
                reasoning: {
                  effort: 'medium',
                  summary: 'auto',
                },
              }),
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
    }
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
