import { NextRequest, NextResponse } from 'next/server';
import { UserPreferences } from '@/lib/types';
import { createSession, getSession } from '@/lib/redis';
import { inngest } from '@/lib/inngest/client';

// Use Edge Runtime for fast response
export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const preferences: UserPreferences = body.preferences;
    const sessionId: string = body.sessionId;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    console.log(`[API] Checking session ${sessionId}`);

    // Check if session already exists and is complete
    const existingSession = await getSession(sessionId);
    if (existingSession?.status === 'complete') {
      console.log(`[API] Session ${sessionId} already complete`);
      return NextResponse.json({ sessionId });
    }

    // Check if session is already generating
    if (existingSession?.status === 'generating') {
      console.log(`[API] Session ${sessionId} already generating`);
      return NextResponse.json({ sessionId });
    }

    console.log(`[API] Creating generation job for session ${sessionId}`);

    // Create new session in Redis
    await createSession(sessionId);

    // Trigger Inngest worker immediately
    await inngest.send({
      name: 'bundle.generate',
      data: {
        sessionId,
        preferences,
      },
    });

    console.log(`[API] Job triggered for session ${sessionId}`);

    return NextResponse.json({ sessionId });
  } catch (error) {
    console.error('[API] Error creating job:', error);
    return NextResponse.json(
      { error: 'Failed to create generation job' },
      { status: 500 }
    );
  }
}
