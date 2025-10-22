import OpenAI from 'openai';
import { UserPreferences, TripBundle } from '@/lib/types';
import { INTEREST_LABELS } from '@/lib/constants';
import { fetchEventImages } from '@/lib/opengraph';
import { getBundleImageUrl } from '@/lib/utils';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const PROMPT_ID = 'pmpt_68b758d74f60819593d91d254518d4fc020955df32c90659';

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
 * Extracts bundles from message output with JSON repair fallback
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractBundles(allOutputItems: Array<any>): TripBundle[] | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messageOutput = allOutputItems.find((item: any) =>
    item && typeof item === 'object' && item.type === 'message'
  );

  if (!messageOutput || !('content' in messageOutput)) {
    console.warn(`[Generation Service] No message output found in response`);
    return null;
  }

  const content = messageOutput.content as Array<{ type: string; text?: string }>;

  // Try output_text first, then text
  let textContent = content.find(c => c.type === 'output_text')?.text || null;
  if (!textContent) {
    textContent = content.find(c => c.type === 'text')?.text || null;
  }

  if (!textContent) {
    console.warn(`[Generation Service] No text content in message output`);
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
        return bundle;
      });
    }

    return bundles;
  } catch (e) {
    console.error(`[Generation Service] Failed to parse bundles:`, e);

    // Attempt to repair and reparse
    try {
      const repairedContent = repairJSON(textContent);
      const fixedParsed = JSON.parse(repairedContent);
      let bundles = fixedParsed.bundles || null;

      // Deterministically set bundle imageUrl based on key events
      if (bundles && Array.isArray(bundles)) {
        bundles = bundles.map((bundle: TripBundle) => {
          const determinedImageUrl = getBundleImageUrl(bundle.keyEvents || []);
          bundle.imageUrl = determinedImageUrl;
          return bundle;
        });
      }

      console.log(`[Generation Service] ✅ Recovered ${bundles?.length || 0} bundles after JSON repair`);
      return bundles;
    } catch {
      console.error(`[Generation Service] ❌ JSON repair failed`);
      return null;
    }
  }
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
  conversationInput: Array<any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<Array<any>> {
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
    } else {
      console.error(`[Generation Service] Unknown function: ${toolCall.name}`);
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
 * Generates trip bundles synchronously
 * Waits for completion and returns bundles
 */
export async function generateBundles(
  preferences: UserPreferences
): Promise<TripBundle[]> {
  console.log('🚀 === GENERATING BUNDLES (SYNCHRONOUS MODE) ===');
  const startTime = Date.now();

  const promptVariables = formatPromptVariables(preferences);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let currentInput: Array<any> = [];
  let iterationCount = 0;
  const MAX_ITERATIONS = 10; // Safety limit for function call loops

  while (iterationCount < MAX_ITERATIONS) {
    iterationCount++;

    // Create OpenAI response (synchronous - waits for completion)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const createParams: Record<string, any> = {
      background: false,  // Synchronous execution - waits for completion
      stream: false,
      prompt: { id: PROMPT_ID, variables: promptVariables },  // Always include prompt for context (includes model & reasoning config)
    };

    // First iteration: use empty input
    if (iterationCount === 1) {
      createParams.input = [];
    } else {
      // Subsequent iterations: use input with all conversation history
      createParams.input = currentInput;
    }

    console.log(`🔄 [Iteration ${iterationCount}] Calling OpenAI Responses API...`);
    console.log(`📦 Request params:`, JSON.stringify({
      background: createParams.background,
      stream: createParams.stream,
      promptId: createParams.prompt.id,
      inputLength: createParams.input?.length || 0,
    }));

    const callStartTime = Date.now();
    const response = await openai.responses.create(createParams);
    const callDuration = Date.now() - callStartTime;

    console.log(`✅ OpenAI call completed in ${(callDuration / 1000).toFixed(2)}s - Status: ${response.status}`);

    // Handle failure
    if (response.status === 'failed') {
      const errorMsg = response.error?.message || 'Response failed';
      console.error(`[Generation Service] Response failed:`, errorMsg);
      throw new Error(errorMsg);
    }

    // Response should be completed (synchronous mode)
    if (response.status === 'completed') {
      const allOutputItems = response.output || [];

      // Check for function calls
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const functionCallItems = allOutputItems.filter((item: any) =>
        item && typeof item === 'object' && item.type === 'function_call'
      );

      if (functionCallItems.length > 0) {
        console.log(`🔧 Executing ${functionCallItems.length} function call(s)...`);

        // Execute function calls and prepare next input
        currentInput = await executeFunctionCalls(
          functionCallItems,
          allOutputItems,
          currentInput
        );

        // Continue loop to create follow-up response
        continue;
      }

      // No function calls - extract bundles and complete
      const bundles = extractBundles(allOutputItems);

      const totalTime = Date.now() - startTime;
      const minutes = Math.floor(totalTime / 60000);
      const seconds = ((totalTime % 60000) / 1000).toFixed(2);
      console.log(`✅ Generated ${bundles?.length || 0} bundles in ${minutes}m ${seconds}s (${iterationCount} iterations)`);

      if (!bundles || bundles.length === 0) {
        console.warn(`[Generation Service] No bundles extracted`);
        return [];
      }

      return bundles;
    }

    // Should not reach here in synchronous mode
    console.error(`[Generation Service] Unexpected status: ${response.status}`);
    throw new Error(`Unexpected response status: ${response.status}`);
  }

  throw new Error(`Maximum iteration limit (${MAX_ITERATIONS}) reached`);
}

