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
// Set max duration to 800 seconds to handle long-running generation
export const maxDuration = 800;

// Create and export handlers for Inngest
// Enable streaming to keep connection alive during long-running operations
// This prevents Vercel's 340s idle timeout on the response side
const handlers = serve({
  client: inngest,
  functions,
  streaming: 'force', // Required for Node.js runtime with Fluid Compute
});

export { handlers as GET, handlers as POST, handlers as PUT };
