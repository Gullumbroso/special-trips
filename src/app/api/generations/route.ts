import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { generations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { UserPreferences } from '@/lib/types';
import { generateBundles } from '@/lib/services/generationService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes (adjust based on your Vercel plan)

export async function POST(request: NextRequest) {
  try {
    // Validate API key is set
    if (!process.env.OPENAI_API_KEY) {
      console.error('[API] OPENAI_API_KEY is not set');
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Parse preferences from request body
    const body = await request.json();
    const preferences: UserPreferences = body.preferences;

    if (!preferences) {
      return NextResponse.json(
        { error: 'Missing preferences in request body' },
        { status: 400 }
      );
    }

    console.log('[API] Creating new generation');

    // Create generation record with processing status
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const [generation] = await db.insert(generations).values({
      status: 'processing',
      preferences,
      expiresAt,
    }).returning();

    console.log(`[API] Created generation ${generation.id}`);

    // Start bundle generation in background (fire-and-forget)
    // Don't await - let it run asynchronously
    generateBundles(preferences)
      .then(async (bundles) => {
        console.log(`[API] ✅ Generation ${generation.id} completed with ${bundles.length} bundles`);
        await db.update(generations)
          .set({
            status: 'completed',
            bundles,
            updatedAt: new Date(),
          })
          .where(eq(generations.id, generation.id));
      })
      .catch(async (error) => {
        console.error(`[API] ❌ Generation ${generation.id} failed:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Generation failed';
        await db.update(generations)
          .set({
            status: 'failed',
            error: errorMessage,
            updatedAt: new Date(),
          })
          .where(eq(generations.id, generation.id));
      });

    // Return immediately - client will poll GET endpoint for updates
    return NextResponse.json({
      generationId: generation.id,
      status: 'processing',
    });
  } catch (error) {
    console.error('[API] Error creating generation:', error);
    return NextResponse.json(
      { error: 'Failed to create generation' },
      { status: 500 }
    );
  }
}
