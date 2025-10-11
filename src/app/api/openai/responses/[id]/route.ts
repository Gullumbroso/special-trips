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
    if (response.status === 'completed') {
      // Debug: log output types and find message
      const outputTypes = response.output?.map(item => item.type) || [];
      console.log('[OpenAI Proxy] Output types:', outputTypes);

      const messageOutput = response.output?.find(item => item.type === 'message');
      console.log('[OpenAI Proxy] Message output found:', !!messageOutput);

      if (messageOutput) {
        console.log('[OpenAI Proxy] Message output keys:', Object.keys(messageOutput));
        console.log('[OpenAI Proxy] Message has content:', 'content' in messageOutput);

        if ('content' in messageOutput) {
          const content = messageOutput.content;
          console.log('[OpenAI Proxy] Content is array:', Array.isArray(content));
          console.log('[OpenAI Proxy] Content length:', Array.isArray(content) ? content.length : 'N/A');
          if (Array.isArray(content)) {
            console.log('[OpenAI Proxy] Content item types:', content.map((c: any) => c.type));
          }
        }
      }

      let textContent = null;

      if (messageOutput && 'content' in messageOutput) {
        const content = messageOutput.content as Array<{ type: string; text?: string }>;
        console.log('[OpenAI Proxy] Message content items:', content.map(c => c.type));
        textContent = content.find(c => c.type === 'output_text')?.text || null;

        if (textContent) {
          console.log('[OpenAI Proxy] Found text in message content (output_text)');
        } else {
          // Try regular text type
          textContent = content.find(c => c.type === 'text')?.text || null;
          if (textContent) {
            console.log('[OpenAI Proxy] Found text in message content (text)');
          }
        }
      }

      // Parse the text content if found
      if (textContent) {
        try {
          console.log(`[OpenAI Proxy] Parsing output (length: ${textContent.length})`);
          console.log(`[OpenAI Proxy] First 500 chars:`, textContent.substring(0, 500));
          const parsed = JSON.parse(textContent);
          bundles = parsed.bundles || null;
          console.log(`[OpenAI Proxy] Extracted ${bundles?.length || 0} bundles`);
        } catch (e) {
          console.error('[OpenAI Proxy] Failed to parse output:', e);
          console.error('[OpenAI Proxy] Content:', textContent?.substring(0, 500));
        }
      } else {
        console.log('[OpenAI Proxy] No text content found in response');
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
