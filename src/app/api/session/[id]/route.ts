import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/redis';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    console.log(`[API] Fetching session: ${sessionId}`);

    const session = await getSession(sessionId);

    if (!session) {
      console.log(`[API] Session not found: ${sessionId}`);
      return NextResponse.json(
        { status: 'not_found' },
        { status: 200 }
      );
    }

    console.log(`[API] Session found: ${sessionId}, status: ${session.status}`);

    return NextResponse.json({
      status: session.status,
      summaries: session.summaries,
      bundles: session.bundles,
      error: session.error,
    });
  } catch (error) {
    console.error('[API] Error fetching session:', error);
    console.error('[API] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    });
    return NextResponse.json(
      {
        error: 'Failed to fetch session',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
