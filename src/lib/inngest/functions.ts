import { inngest } from './client';
import OpenAI from 'openai';
import { UserPreferences, TripBundle } from '@/lib/types';
import { INTEREST_LABELS } from '@/lib/constants';
import { fetchEventImages } from '@/lib/opengraph';
import {
  addSessionSummary,
  completeSession,
  errorSession,
} from '@/lib/redis';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const PROMPT_ID = 'pmpt_68b758d74f60819593d91d254518d4fc020955df32c90659';

interface GenerateBundlesEvent {
  data: {
    sessionId: string;
    preferences: UserPreferences;
  };
}

export const generateBundles = inngest.createFunction(
  {
    id: 'generate-bundles',
    name: 'Generate Trip Bundles',
  },
  { event: 'bundle.generate' },
  async ({ event }: { event: GenerateBundlesEvent }) => {
    const { sessionId, preferences } = event.data;

    try {
      console.log(`[INNGEST] Starting bundle generation for session ${sessionId}`);

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

      // Helper to process OpenAI stream with function calling
      async function processStream(
        streamPromise: Promise<AsyncIterable<unknown>>,
        conversationInput: Array<any> = [] // eslint-disable-line @typescript-eslint/no-explicit-any
      ): Promise<void> {
        const stream = await streamPromise;
        let fullContent = '';
        const finalToolCalls: Record<number, any> = {}; // eslint-disable-line @typescript-eslint/no-explicit-any

        for await (const rawEvent of stream) {
          // Type assertion for OpenAI streaming events
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const event = rawEvent as any;

          // Store function call items
          if (event.type === 'response.output_item.added') {
            finalToolCalls[event.output_index] = event.item;
          }

          // Accumulate function arguments
          if (event.type === 'response.function_call_arguments.delta') {
            const index = event.output_index;
            if (finalToolCalls[index]) {
              finalToolCalls[index].arguments += event.delta;
            }
          }

          // Handle failures
          if (event.type === 'response.failed') {
            const errorMsg = event.response?.error?.message || 'Response failed';
            throw new Error(errorMsg);
          }

          // Send reasoning summaries to Redis
          if (event.type === 'response.reasoning_summary_part.done') {
            const text = event.part?.text || '';
            if (text) {
              console.log(`[INNGEST] Summary: ${text.substring(0, 50)}...`);
              await addSessionSummary(sessionId, text);
            }
          }

          // Collect final answer
          if (event.type === 'response.output_text.delta') {
            fullContent += event.delta || '';
          }

          // Handle completion
          if (event.type === 'response.completed') {
            const functionCallItems = Object.values(finalToolCalls).filter(
              (item) => item && typeof item === 'object' && item.type === 'function_call'
            );

            // Execute function calls if any
            if (functionCallItems.length > 0) {
              console.log(`[INNGEST] Executing ${functionCallItems.length} function(s)`);

              const newConversationInput = [...conversationInput];

              // Add all output items
              for (const item of Object.values(finalToolCalls)) {
                newConversationInput.push(item);
              }

              // Execute functions
              for (const toolCall of functionCallItems) {
                if (toolCall.name === 'fetch_event_images') {
                  try {
                    const parsedArgs = JSON.parse(toolCall.arguments);
                    const imageUrls = await fetchEventImages(parsedArgs.url);
                    newConversationInput.push({
                      type: 'function_call_output',
                      call_id: toolCall.call_id,
                      output: JSON.stringify(imageUrls),
                    });
                  } catch (error) {
                    console.error(`[INNGEST] Error fetching images:`, error);
                    newConversationInput.push({
                      type: 'function_call_output',
                      call_id: toolCall.call_id,
                      output: JSON.stringify([]),
                    });
                  }
                }
              }

              // Continue with new request
              await processStream(
                openai.responses.create({
                  prompt: {
                    id: PROMPT_ID,
                    variables: promptVariables,
                  },
                  input: newConversationInput,
                  reasoning: {
                    effort: 'medium',
                    summary: 'auto',
                  },
                  stream: true,
                }),
                newConversationInput
              );
              return;
            }

            // Final response with content
            if (fullContent) {
              console.log(`[INNGEST] Parsing final content, length: ${fullContent.length}`);
              const parsedResponse = JSON.parse(fullContent);
              const bundlesArray: TripBundle[] = parsedResponse.bundles || [];

              console.log(`[INNGEST] Completing session with ${bundlesArray.length} bundles`);
              await completeSession(sessionId, bundlesArray);
              return;
            }
          }
        }
      }

      // Start the stream
      await processStream(
        openai.responses.create({
          prompt: {
            id: PROMPT_ID,
            variables: promptVariables,
          },
          reasoning: {
            effort: 'medium',
            summary: 'auto',
          },
          stream: true,
        }),
        []
      );

      console.log(`[INNGEST] Successfully completed session ${sessionId}`);
    } catch (error) {
      console.error(`[INNGEST] Error in session ${sessionId}:`, error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      await errorSession(sessionId, errorMsg);
      throw error; // Let Inngest handle retries
    }
  }
);
