import { NextRequest } from "next/server";
import OpenAI from "openai";
import { UserPreferences } from "@/lib/types";
import { INTEREST_LABELS } from "@/lib/constants";
import { fetchEventImages } from "@/lib/opengraph";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const PROMPT_ID = "pmpt_68b758d74f60819593d91d254518d4fc020955df32c90659";

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function POST(request: NextRequest) {
  try {
    const preferences: UserPreferences = await request.json();

    // Format interests as comma-separated string with labels
    const interestsString = preferences.interests
      .map((interest) => INTEREST_LABELS[interest])
      .join(", ");

    // Format music taste - include Spotify data if available (up to 1000 each)
    let musicTasteString = preferences.musicProfile;
    if (preferences.spotifyMusicProfile) {
      // Format as stringified JSON object with artists and genres arrays
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
      free_text_requests: preferences.otherPreferences || "None",
    };

    // Create a ReadableStream for SSE
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send prompt variables to client for logging
          const debugMessage = `event: debug\ndata: ${JSON.stringify({ promptVariables })}\n\n`;
          controller.enqueue(encoder.encode(debugMessage));

          // Helper function to process streaming response with function calling
          async function processStream(
            streamPromise: Promise<AsyncIterable<any>>,
            conversationInput: Array<any> = []
          ) {
            const stream = await streamPromise;
            let fullContent = "";
            const finalToolCalls: Record<number, any> = {};

            for await (const event of stream) {
              // Log all event types for debugging (excluding noisy ones)
              if (event.type && event.type !== "response.reasoning_summary_text.delta") {
                console.log(`[EVENT] ${event.type}`);
              }

              // When a function call item is added, store the item (per docs)
              if (event.type === "response.output_item.added") {
                finalToolCalls[event.output_index] = event.item;
                if (event.item?.type === "function_call") {
                  console.log(`[FUNCTION ADDED] ${event.item.name} with call_id: ${event.item.call_id}, id: ${event.item.id}`);
                }
              }

              // Accumulate function call arguments (per docs)
              if (event.type === "response.function_call_arguments.delta") {
                const index = event.output_index;
                if (finalToolCalls[index]) {
                  finalToolCalls[index].arguments += event.delta;
                }
              }

              // When function arguments are done, log it
              if (event.type === "response.function_call_arguments.done") {
                const index = event.output_index;
                const toolCall = finalToolCalls[index];
                if (toolCall) {
                  console.log(`[FUNCTION ARGS DONE] ${toolCall.name}: ${toolCall.arguments}`);
                }
              }

              // When output item is done, it's fully ready
              if (event.type === "response.output_item.done") {
                if (event.item?.type === "function_call") {
                  console.log(`[FUNCTION ITEM DONE] ${event.item.name}, call_id: ${event.item.call_id}`);
                }
              }

              // Handle response failure
              if (event.type === "response.failed") {
                const errorMsg = event.response?.error?.message || "Response failed";
                console.error("Response failed:", errorMsg);
                const message = `event: error\ndata: ${JSON.stringify({ message: errorMsg })}\n\n`;
                controller.enqueue(encoder.encode(message));
                break;
              }

              // When a reasoning summary step completes, send it to client
              if (event.type === "response.reasoning_summary_part.done") {
                const text = event.part?.text || "";
                if (text) {
                  console.log(`[SUMMARY ${event.summary_index}]:`, text);
                  const message = `event: reasoning_summary\ndata: ${JSON.stringify({ text })}\n\n`;
                  controller.enqueue(encoder.encode(message));
                }
              }

              // Collect output text deltas (final answer)
              if (event.type === "response.output_text.delta") {
                fullContent += event.delta || "";
              }

              // When response completes, check if we need to handle function calls
              if (event.type === "response.completed") {
                // Filter only function_call items
                const functionCallItems = Object.values(finalToolCalls).filter(
                  (item) => item && typeof item === "object" && item.type === "function_call"
                );

                console.log(`[COMPLETED] Content length: ${fullContent.length}, Function calls: ${functionCallItems.length}, Total output items: ${Object.keys(finalToolCalls).length}`);

                // If we have function calls, execute them and continue
                if (functionCallItems.length > 0) {
                  console.log(`[EXECUTING] ${functionCallItems.length} function(s)`);

                  // Build new conversation input with function calls and outputs
                  const newConversationInput = [...conversationInput];

                  // First, add ALL output items (reasoning + function_call) to conversation input (per docs line 113)
                  for (const item of Object.values(finalToolCalls)) {
                    newConversationInput.push(item);
                  }

                  // Execute all functions and add their outputs
                  for (const toolCall of functionCallItems) {
                    if (toolCall.name === "fetch_event_images") {
                      try {
                        const parsedArgs = JSON.parse(toolCall.arguments);
                        console.log(`[FETCHING] Images for: ${parsedArgs.url}`);
                        const imageUrls = await fetchEventImages(parsedArgs.url);
                        console.log(`[FOUND] ${imageUrls.length} image(s)`);

                        // Add function output to conversation input (per docs line 122-128)
                        newConversationInput.push({
                          type: "function_call_output",
                          call_id: toolCall.call_id,
                          output: JSON.stringify(imageUrls),
                        });
                      } catch (error) {
                        console.error(`[ERROR] Failed to fetch images:`, error);
                        newConversationInput.push({
                          type: "function_call_output",
                          call_id: toolCall.call_id,
                          output: JSON.stringify([]),
                        });
                      }
                    }
                  }

                  // Make a new request with function outputs (per docs line 133-138)
                  console.log(`[NEW REQUEST] with ${newConversationInput.length} input items`);
                  await processStream(
                    openai.responses.create({
                      prompt: {
                        id: PROMPT_ID,
                        variables: promptVariables,
                      },
                      input: newConversationInput,
                      reasoning: {
                        effort: "medium",
                        summary: "auto",
                      },
                      stream: true,
                    }),
                    newConversationInput
                  );
                  return;
                }

                // Final response - has content
                if (fullContent) {
                  console.log(`[PARSING] Final content length: ${fullContent.length}`);
                  // Parse JSON from the response
                  let parsedResponse;
                  try {
                    parsedResponse = typeof fullContent === "string" ? JSON.parse(fullContent) : fullContent;
                    console.log(`[PARSED] Successfully parsed bundles, count: ${parsedResponse.bundles?.length || 'unknown'}`);
                  } catch (parseError) {
                    console.error("Failed to parse response:", fullContent.substring(0, 500));
                    throw new Error("Invalid response format from AI");
                  }

                  // Extract just the bundles array from the GPT response
                  const bundlesArray = parsedResponse.bundles || [];

                  console.log(`[SENDING] Completed event to client with ${bundlesArray.length} bundles`);
                  const message = `event: completed\ndata: ${JSON.stringify({ bundles: bundlesArray })}\n\n`;
                  controller.enqueue(encoder.encode(message));
                  console.log(`[SENT] Completed event sent successfully`);

                  // Close the stream when we send final bundles
                  console.log(`[CLOSING] Stream controller`);
                  controller.close();
                  return;
                }
              }
            }
          }

          // Start the initial stream
          await processStream(
            openai.responses.create({
              prompt: {
                id: PROMPT_ID,
                variables: promptVariables,
              },
              reasoning: {
                effort: "medium",
                summary: "auto",
              },
              stream: true,
            }),
            []
          );

          // Controller is closed inside processStream when completed event is sent
        } catch (error) {
          console.error("Error generating bundles:", error);
          const errorMessage = `event: error\ndata: ${JSON.stringify({ message: error instanceof Error ? error.message : "Unknown error" })}\n\n`;
          controller.enqueue(encoder.encode(errorMessage));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error setting up stream:", error);

    return new Response(
      JSON.stringify({
        error: "Failed to generate trip bundles",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
