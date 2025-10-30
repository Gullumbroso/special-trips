import { inngest } from './client';
import { db } from '@/db/client';
import { generations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { UserPreferences, TripBundle } from '@/lib/types';
import { generateBundles } from '@/lib/services/generationService';

/**
 * Inngest function: Generate trip bundles
 *
 * This function runs asynchronously on Inngest's infrastructure, not subject to Vercel timeouts.
 * Handles the entire generation lifecycle:
 * 1. Creates DB record with 'processing' status
 * 2. Calls OpenAI to generate bundles
 * 3. Updates DB with results or error
 *
 * Error handling strategy:
 * - DB creation/update failures: Throw error
 * - Generation failures: Catch, update DB with 'failed' status
 * - DB update failure when marking 'failed': Best effort, log only
 */
export const generateTripBundles = inngest.createFunction(
  {
    id: 'generate-trip-bundles',
    name: 'Generate Trip Bundles',
    retries: 0, // No retries to avoid expensive AI operations
  },
  { event: 'generation.create' },
  async ({ event, step }) => {
    const { generationId, preferences } = event.data as {
      generationId: string;
      preferences: UserPreferences;
    };

    console.log(`[Inngest] Starting generation ${generationId}`);

    // Step 1: Create generation record in DB
    await step.run('create-generation-record', async () => {
      try {
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        await db.insert(generations).values({
          id: generationId,
          status: 'processing',
          preferences,
          expiresAt,
        });

        console.log(`[Inngest] Created generation record ${generationId}`);
      } catch (error) {
        console.error(`[Inngest] Failed to create generation record ${generationId}:`, error);
        // Throw to trigger Inngest retry - this is a critical failure
        throw new Error(
          `DB creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    });

    // Step 2: Generate bundles
    // This is the long-running operation (can take 5+ minutes)
    const result = await step.run('generate-bundles', async () => {
      try {
        console.log(`[Inngest] Generating bundles for ${generationId}...`);
        const bundles: TripBundle[] = await generateBundles(preferences);
        console.log(`[Inngest] ✅ Generated ${bundles.length} bundles for ${generationId}`);
        return { success: true as const, bundles };
      } catch (error) {
        console.error(`[Inngest] ❌ Generation failed for ${generationId}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Generation failed';
        return { success: false as const, error: errorMessage };
      }
    });

    // Step 3: Update generation record with results
    await step.run('update-generation-record', async () => {
      if (result.success) {
        // Success case: Update with bundles
        try {
          await db
            .update(generations)
            .set({
              status: 'completed',
              bundles: result.bundles,
              updatedAt: new Date(),
            })
            .where(eq(generations.id, generationId));

          console.log(`[Inngest] ✅ Updated generation ${generationId} with ${result.bundles?.length || 0} bundles`);
        } catch (error) {
          console.error(`[Inngest] Failed to update generation ${generationId} with bundles:`, error);
          // Critical failure - we successfully generated bundles but can't save them
          // Throw to trigger retry
          throw new Error(
            `DB update failed after successful generation: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      } else {
        // Failure case: Update with error
        try {
          await db
            .update(generations)
            .set({
              status: 'failed',
              error: result.error,
              updatedAt: new Date(),
            })
            .where(eq(generations.id, generationId));

          console.log(`[Inngest] Updated generation ${generationId} with error status`);
        } catch (error) {
          // Best effort - generation already failed, don't compound by retrying forever
          // Log error but don't throw to avoid infinite retries
          console.error(`[Inngest] Failed to update generation ${generationId} with error status:`, error);
          console.error(`[Inngest] Original generation error was: ${result.error}`);
          // Note: Client will see 404 when polling if this happens, which is acceptable
        }
      }
    });

    return { generationId, success: result.success };
  }
);

// Export all functions as an array for the API route
export const functions = [generateTripBundles];
