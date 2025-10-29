import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { functions } from '@/lib/inngest/functions';

/**
 * Inngest API route
 *
 * This endpoint serves Inngest functions to Inngest's infrastructure.
 * Inngest Cloud calls this endpoint to:
 * 1. Discover available functions
 * 2. Execute function runs triggered by events
 *
 * Node.js runtime is fine here - this endpoint just receives webhooks
 * and delegates work to Inngest's infrastructure.
 */
export const runtime = 'nodejs';
// Set max duration to 5 minutes (300 seconds) to handle long-running generation
// Note: Requires Vercel Pro plan. On Hobby plan, max is 10 seconds.
export const maxDuration = 300;

// Create and export handlers for Inngest
const handlers = serve({
  client: inngest,
  functions,
});

export { handlers as GET, handlers as POST, handlers as PUT };
