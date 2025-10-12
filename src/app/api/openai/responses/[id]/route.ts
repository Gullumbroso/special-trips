import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

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

    // Server-side call to OpenAI using API key
    const response = await openai.responses.retrieve(id);

    // Extract reasoning summaries from output
    const rawSummaries = response.output
      ?.filter(item => item.type === 'reasoning')
      .flatMap(item => {
        // Extract summary array from reasoning items
        if ('summary' in item && Array.isArray(item.summary)) {
          return item.summary;
        }
        return [];
      })
      || [];

    // Extract titles from summaries (same logic as old Inngest worker)
    // Summary items have a 'text' property containing the summary string
    const summaries = rawSummaries.map((summary) => {
      const text = typeof summary === 'string' ? summary : (summary as { text?: string }).text || '';
      return extractSummaryTitle(text);
    });

    // Extract bundles if completed
    let bundles = null;
    if (response.status === 'completed') {
      const messageOutput = response.output?.find(item => item.type === 'message');
      let textContent = null;

      if (messageOutput && 'content' in messageOutput) {
        const content = messageOutput.content as Array<{ type: string; text?: string }>;
        textContent = content.find(c => c.type === 'output_text')?.text || null;

        if (!textContent) {
          // Try regular text type
          textContent = content.find(c => c.type === 'text')?.text || null;
        }
      }

      // Parse the text content if found
      if (textContent) {
        try {
          const parsed = JSON.parse(textContent);
          bundles = parsed.bundles || null;
        } catch (e) {
          console.error('[API] Failed to parse bundles:', e);

          // Attempt to repair and reparse
          console.log(`[API] Attempting to repair malformed JSON...`);
          try {
            const repairedContent = repairJSON(textContent);
            const fixedParsed = JSON.parse(repairedContent);
            bundles = fixedParsed.bundles || null;
            console.log(`[API] ✅ Successfully recovered ${bundles?.length || 0} bundles after JSON repair`);
          } catch {
            console.error(`[API] ❌ Could not recover bundles after repair attempt`);
            console.error(`[API] First 500 chars of response:`, textContent.substring(0, 500));
            bundles = null;
          }
        }
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
    console.error('[API] Error retrieving response:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve OpenAI response' },
      { status: 500 }
    );
  }
}
