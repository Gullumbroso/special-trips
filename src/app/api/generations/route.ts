import { NextRequest, NextResponse } from 'next/server';
import { UserPreferences } from '@/lib/types';
import { inngest } from '@/lib/inngest/client';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/generations
 *
 * Creates a new trip bundle generation request.
 * This endpoint returns immediately - the actual generation happens
 * asynchronously in an Inngest worker function.
 *
 * Flow:
 * 1. Validate request and generate UUID
 * 2. Send event to Inngest (fire-and-forget)
 * 3. Return generationId immediately
 * 4. Worker creates DB record and generates bundles
 * 5. Client polls GET /api/generations/[id] for updates
 */
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

    // Generate UUID upfront so we can return it immediately
    const generationId = randomUUID();

    console.log(`[API] Creating generation ${generationId}`);

    // Send event to Inngest worker
    // The worker will:
    // 1. Create the DB record
    // 2. Generate bundles
    // 3. Update DB with results
    try {
      await inngest.send({
        name: 'generation.create',
        data: {
          generationId,
          preferences,
        },
      });

      console.log(`[API] Sent generation.create event for ${generationId}`);
    } catch (error) {
      console.error('[API] Failed to send Inngest event:', error);
      return NextResponse.json(
        { error: 'Failed to initiate generation' },
        { status: 500 }
      );
    }

    // Return immediately - worker will create DB record and process
    // Client will poll GET /api/generations/[id] for status updates
    return NextResponse.json({
      generationId,
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
