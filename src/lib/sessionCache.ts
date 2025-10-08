/**
 * In-memory session cache for storing generation progress
 * Sessions expire after 1 hour of inactivity
 */

export interface SessionData {
  status: 'generating' | 'complete' | 'error';
  summaries: string[];
  bundles: any[] | null; // eslint-disable-line @typescript-eslint/no-explicit-any
  error?: string;
  lastUpdated: number;
}

// In-memory cache with TTL
const sessionCache = new Map<string, SessionData>();
const SESSION_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Clean up expired sessions (older than 1 hour)
 */
function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [sessionId, data] of sessionCache.entries()) {
    if (now - data.lastUpdated > SESSION_TTL) {
      sessionCache.delete(sessionId);
      console.log(`[SESSION] Cleaned up expired session: ${sessionId}`);
    }
  }
}

// Run cleanup every 10 minutes
setInterval(cleanupExpiredSessions, 10 * 60 * 1000);

/**
 * Get session data by ID
 */
export function getSession(sessionId: string): SessionData | null {
  return sessionCache.get(sessionId) || null;
}

/**
 * Create a new session
 */
export function createSession(sessionId: string): SessionData {
  const data: SessionData = {
    status: 'generating',
    summaries: [],
    bundles: null,
    lastUpdated: Date.now(),
  };
  sessionCache.set(sessionId, data);
  console.log(`[SESSION] Created new session: ${sessionId}`);
  return data;
}

/**
 * Update session with new summary
 */
export function addSessionSummary(sessionId: string, summary: string): void {
  const session = sessionCache.get(sessionId);
  if (session) {
    session.summaries.push(summary);
    session.lastUpdated = Date.now();
    console.log(`[SESSION] Added summary to ${sessionId}: ${summary.substring(0, 50)}...`);
  }
}

/**
 * Mark session as complete with bundles
 */
export function completeSession(sessionId: string, bundles: any[]): void { // eslint-disable-line @typescript-eslint/no-explicit-any
  const session = sessionCache.get(sessionId);
  if (session) {
    session.status = 'complete';
    session.bundles = bundles;
    session.lastUpdated = Date.now();
    console.log(`[SESSION] Completed session ${sessionId} with ${bundles.length} bundles`);
  }
}

/**
 * Mark session as errored
 */
export function errorSession(sessionId: string, error: string): void {
  const session = sessionCache.get(sessionId);
  if (session) {
    session.status = 'error';
    session.error = error;
    session.lastUpdated = Date.now();
    console.log(`[SESSION] Error in session ${sessionId}: ${error}`);
  }
}

/**
 * Delete a session (for cleanup or cancellation)
 */
export function deleteSession(sessionId: string): void {
  sessionCache.delete(sessionId);
  console.log(`[SESSION] Deleted session: ${sessionId}`);
}
