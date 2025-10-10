import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

/**
 * Extracts the title from a reasoning summary.
 * If the summary starts with **Title**, extracts just the title.
 * Otherwise, returns the full text with ** removed.
 */
function extractSummaryTitle(text: string): string {
  const trimmedText = text.trim();

  if (trimmedText.startsWith('**')) {
    const match = trimmedText.match(/^\*\*([^*]+)\*\*/);
    return match ? match[1].trim() : trimmedText.replace(/\*\*/g, '').trim();
  }

  return trimmedText.replace(/\*\*/g, '');
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    console.log(`[OpenAI Proxy] Retrieving response ${id}`);

    // Server-side call to OpenAI using API key
    const response = await openai.responses.retrieve(id);

    console.log(`[OpenAI Proxy] Response status: ${response.status}`);
    console.log(`[OpenAI Proxy] Output items count: ${response.output?.length || 0}`);

    // Log output types for debugging
    if (response.output && response.output.length > 0) {
      const outputTypes = response.output.map(item => item.type);
      console.log(`[OpenAI Proxy] Output types: ${outputTypes.join(', ')}`);
    }

    // Extract reasoning summaries from output
    const rawSummaries = response.output
      ?.filter(item => item.type === 'reasoning')
      .flatMap(item => {
        console.log(`[OpenAI Proxy] Reasoning item:`, JSON.stringify(item).substring(0, 200));
        // Extract summary array from reasoning items
        if ('summary' in item && Array.isArray(item.summary)) {
          console.log(`[OpenAI Proxy] Found summary array with ${item.summary.length} items`);
          return item.summary;
        }
        return [];
      })
      || [];

    console.log(`[OpenAI Proxy] Raw summaries count: ${rawSummaries.length}`);

    // Extract titles from summaries (same logic as old Inngest worker)
    // Summary items have a 'text' property containing the summary string
    const summaries = rawSummaries.map((summary) => {
      const text = typeof summary === 'string' ? summary : (summary as { text?: string }).text || '';
      return extractSummaryTitle(text);
    });

    console.log(`[OpenAI Proxy] Extracted ${summaries.length} reasoning summaries`);

    // Extract bundles if completed
    let bundles = null;
    if (response.status === 'completed' && response.output_text) {
      try {
        console.log(`[OpenAI Proxy] Parsing output_text (length: ${response.output_text.length})`);
        const parsed = JSON.parse(response.output_text);
        bundles = parsed.bundles || null;
        console.log(`[OpenAI Proxy] Extracted ${bundles?.length || 0} bundles`);
      } catch (e) {
        console.error('[OpenAI Proxy] Failed to parse output_text:', e);
        console.error('[OpenAI Proxy] Output text (first 500 chars):', response.output_text?.substring(0, 500));
      }
    }

    // Return status and data to client
    return NextResponse.json({
      status: response.status,
      summaries,
      bundles,
      error: response.error?.message || null,
    });
  } catch (error) {
    console.error('[OpenAI Proxy] Error retrieving response:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve OpenAI response' },
      { status: 500 }
    );
  }
}
