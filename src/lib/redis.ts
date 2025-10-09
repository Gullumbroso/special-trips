import { Redis } from '@upstash/redis';

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export interface SessionData {
  status: 'generating' | 'complete' | 'error';
  summaries: string[];
  bundles: any[] | null; // eslint-disable-line @typescript-eslint/no-explicit-any
  error?: string;
  createdAt: number;
}

const SESSION_TTL = 60 * 60; // 1 hour in seconds

/**
 * Get session data by ID
 */
export async function getSession(sessionId: string): Promise<SessionData | null> {
  try {
    return await redis.get<SessionData>(`session:${sessionId}`);
  } catch (error) {
    console.error(`[REDIS] Error getting session ${sessionId}:`, error);
    // Return null on error to avoid breaking the flow
    return null;
  }
}

/**
 * Create a new session
 */
export async function createSession(sessionId: string): Promise<void> {
  const data: SessionData = {
    status: 'generating',
    summaries: [],
    bundles: null,
    createdAt: Date.now(),
  };
  await redis.setex(`session:${sessionId}`, SESSION_TTL, data);
  console.log(`[REDIS] Created session: ${sessionId}`);
}

/**
 * Add a summary to the session
 */
export async function addSessionSummary(sessionId: string, summary: string): Promise<void> {
  try {
    const session = await getSession(sessionId);
    if (session) {
      session.summaries.push(summary);
      await redis.setex(`session:${sessionId}`, SESSION_TTL, session);
      console.log(`[REDIS] Added summary to ${sessionId}: ${summary.substring(0, 50)}...`);
    }
  } catch (error) {
    console.error(`[REDIS] Error adding summary to ${sessionId}:`, error);
    // Continue execution - don't break the workflow if Redis fails
  }
}

/**
 * Mark session as complete with bundles
 */
export async function completeSession(sessionId: string, bundles: any[]): Promise<void> { // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    const session = await getSession(sessionId);
    if (session) {
      session.status = 'complete';
      session.bundles = bundles;
      await redis.setex(`session:${sessionId}`, SESSION_TTL, session);
      console.log(`[REDIS] Completed session ${sessionId} with ${bundles.length} bundles`);
    }
  } catch (error) {
    console.error(`[REDIS] Error completing session ${sessionId}:`, error);
    throw error; // Re-throw for completeSession since it's critical
  }
}

/**
 * Mark session as errored
 */
export async function errorSession(sessionId: string, error: string): Promise<void> {
  const session = await getSession(sessionId);
  if (session) {
    session.status = 'error';
    session.error = error;
    await redis.setex(`session:${sessionId}`, SESSION_TTL, session);
    console.log(`[REDIS] Error in session ${sessionId}: ${error}`);
  }
}
