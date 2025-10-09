import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/sessionCache";

// Disable caching for this route
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
        { error: "Session ID is required" },
        { status: 400 }
      );
    }

    const session = getSession(sessionId);

    if (!session) {
      // Return 200 with not_found status - this is expected when starting fresh
      return NextResponse.json(
        { status: 'not_found' },
        { status: 200 }
      );
    }

    // Return session data
    return NextResponse.json({
      status: session.status,
      summaries: session.summaries,
      bundles: session.bundles,
      error: session.error,
    });
  } catch (error) {
    console.error("Error fetching session:", error);
    return NextResponse.json(
      { error: "Failed to fetch session" },
      { status: 500 }
    );
  }
}
