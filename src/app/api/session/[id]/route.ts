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

    const session = await getSession(sessionId);

    if (!session) {
      return NextResponse.json(
        { status: 'not_found' },
        { status: 200 }
      );
    }

    return NextResponse.json({
      status: session.status,
      summaries: session.summaries,
      bundles: session.bundles,
      error: session.error,
    });
  } catch (error) {
    console.error('[API] Error fetching session:', error);
    return NextResponse.json(
      { error: 'Failed to fetch session' },
      { status: 500 }
    );
  }
}
