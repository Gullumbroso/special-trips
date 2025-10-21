import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { generations } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch generation from database
    const [generation] = await db.select()
      .from(generations)
      .where(eq(generations.id, id))
      .limit(1);

    if (!generation) {
      return NextResponse.json(
        { error: 'Generation not found' },
        { status: 404 }
      );
    }

    console.log(`[API] GET /api/generations/${id} - Status: ${generation.status}`);

    // Return generation status and data from database
    return NextResponse.json({
      generationId: generation.id,
      status: generation.status,
      bundles: generation.bundles || null,
      error: generation.error || null,
      createdAt: generation.createdAt,
    });
  } catch (error) {
    console.error('[API] Error fetching generation:', error);
    return NextResponse.json(
      { error: 'Failed to fetch generation' },
      { status: 500 }
    );
  }
}
