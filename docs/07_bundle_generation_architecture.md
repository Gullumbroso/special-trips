# Technical Design Document: Bundle Generation Architecture

**Last Updated:** 2025-10-21
**Status:** ✅ Implemented
**Version:** 3.0 (Synchronous Mode with Client Polling)

---

## Table of Contents
1. [Overview](#overview)
2. [Problem Statement](#problem-statement)
3. [Architecture Decision](#architecture-decision)
4. [System Architecture](#system-architecture)
5. [Implementation Details](#implementation-details)
6. [API Reference](#api-reference)
7. [Database Schema](#database-schema)
8. [Key Design Decisions](#key-design-decisions)
9. [Trade-offs](#trade-offs)
10. [Future Considerations](#future-considerations)

---

## Overview

The bundle generation system creates personalized trip bundles using OpenAI's Responses API with reasoning models. The architecture uses a **synchronous server-side generation with client polling** to maintain resilience to client disconnections while keeping the codebase simple.

---

## Problem Statement

### Evolution History
- **v1.0 (SSE Streaming)**: Server-Sent Events with tight coupling, fragile on disconnects
- **v2.0 (Background Mode)**: OpenAI background mode with reasoning summaries, complex polling
- **v3.0 (Current)**: Simplified synchronous generation, no real-time summaries

### Key Requirements
1. Client must be able to refresh/reconnect without losing progress ✅
2. Mobile devices must handle sleep/wake cycles gracefully ✅
3. Generation must complete even if client disconnects ✅
4. Minimal complexity in reconnection logic ✅
5. Simple, maintainable codebase ✅

---

## Architecture Decision

### Chosen Approach: Synchronous Generation + Client Polling

**Core Principle:** Server generates synchronously, client polls for completion

```
Client → POST → Server creates DB record → Returns generation ID immediately
                ↓ (fire-and-forget)
                Generates bundles synchronously (background: false)
                ↓
                Saves bundles to DB when complete

Client polls GET endpoint every 25s → Reads from DB → Gets bundles when ready
```

### Why This Architecture?

1. **Simplicity Over Real-Time Updates**
   - No OpenAI background mode complexity
   - No reasoning summary extraction
   - Straightforward synchronous flow
   - ~60% less code than v2.0

2. **Database as Source of Truth**
   - Generation state persists across disconnects
   - Client can resume by polling with generation ID
   - Server stateless: no in-memory tracking needed
   - All data cached in DB for fast retrieval

3. **Fire-and-Forget Pattern**
   - POST endpoint returns immediately
   - Generation continues in background promise
   - No blocking of client request
   - Updates DB when complete

4. **Client Resilience**
   - Polls instantly on mount (resume case)
   - Then polls every 25 seconds
   - Generic loading messages instead of AI summaries
   - Seamlessly resumes after refresh/sleep

---

## System Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Client: POST /api/generations (preferences)                  │
└────────────────────────┬────────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Server: Create DB record                                     │
│    - status: 'processing'                                       │
│    - preferences: {...}                                         │
└────────────────────────┬────────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Server: Return to Client (immediately)                       │
│    { generationId: "gen_123", status: "processing" }            │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ├─> Client polls GET every 25s
                          │
                          ▼ (fire-and-forget)
┌─────────────────────────────────────────────────────────────────┐
│ 4. Server Background: generateBundles()                         │
│    - Calls OpenAI with background: false (synchronous)          │
│    - Waits for completion (2-5 min)                             │
│    - Handles function calls in loop                             │
│    - Extracts bundles                                           │
└────────────────────────┬────────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Server Background: Update DB                                 │
│    - status: 'completed'                                        │
│    - bundles: [...]                                             │
└─────────────────────────────────────────────────────────────────┘
                         ▲
                         │
┌────────────────────────┴────────────────────────────────────────┐
│ 6. Client: Poll GET /api/generations/[id] (every 25s)           │
│    - Server reads from DB                                       │
│    - Returns: { status, bundles }                               │
│    - No OpenAI calls, pure DB read                              │
└─────────────────────────────────────────────────────────────────┘
```

### Component Diagram

```
┌──────────────┐
│   Client     │
│  (Browser)   │
└──────┬───────┘
       │ POST /api/generations
       │ GET /api/generations/[id] (poll every 5s)
       │
       ▼
┌─────────────────────────────────────┐
│   Next.js API Routes                │
│  ┌─────────────────────────────┐    │
│  │ POST /api/generations       │    │
│  │ - initiateGeneration()      │    │
│  │ - Save to DB                │    │
│  │ - Return immediately        │    │
│  └─────────────────────────────┘    │
│                                      │
│  ┌─────────────────────────────┐    │
│  │ GET /api/generations/[id]   │    │
│  │ - Fetch from DB             │    │
│  │ - Check OpenAI status       │    │
│  │ - Extract bundles if ready  │    │
│  │ - Return state + summaries  │    │
│  └─────────────────────────────┘    │
└──────┬────────────────┬─────────────┘
       │                │
       │                │
       ▼                ▼
┌──────────────┐  ┌──────────────────┐
│  PostgreSQL  │  │  OpenAI API      │
│  (Supabase)  │  │  (Responses API) │
│              │  │                  │
│ generations  │  │ - background:true│
│   table      │  │ - reasoning      │
└──────────────┘  │ - function calls │
                  └──────────────────┘
```

---

## Implementation Details

### 1. Generation Service (`src/lib/services/generationService.ts`)

#### `generateBundles(preferences: UserPreferences): Promise<TripBundle[]>`
- Single synchronous function that handles entire generation
- Creates OpenAI responses with `background: false` (waits for completion)
- Handles function calls in a loop
- Returns bundles when complete

```typescript
export async function generateBundles(
  preferences: UserPreferences
): Promise<TripBundle[]> {
  const promptVariables = formatPromptVariables(preferences);
  let currentInput: Array<any> = [];
  let iterationCount = 0;
  const MAX_ITERATIONS = 10;

  while (iterationCount < MAX_ITERATIONS) {
    // Create OpenAI response (synchronous - waits for completion)
    const response = await openai.responses.create({
      prompt: iterationCount === 1 ? { id: PROMPT_ID, variables: promptVariables } : undefined,
      input: currentInput,
      background: false,  // Synchronous execution - waits for completion
      stream: false,
      reasoning: { effort: 'medium' },
    });

    if (response.status === 'completed') {
      const allOutputItems = response.output || [];

      // Check for function calls
      const functionCallItems = allOutputItems.filter(
        (item) => item?.type === 'function_call'
      );

      if (functionCallItems.length > 0) {
        // Execute function calls and prepare next input
        currentInput = await executeFunctionCalls(
          functionCallItems,
          allOutputItems,
          currentInput
        );
        continue; // Create follow-up response
      }

      // No function calls - extract and return bundles
      return extractBundles(allOutputItems);
    }
  }

  throw new Error('Maximum iteration limit reached');
}
```

**Key Points:**
- Synchronous mode means we wait for each OpenAI response
- Function calls handled in loop (same as before)
- No response ID tracking needed
- No polling OpenAI - we just wait

---

### 2. POST Endpoint (`src/app/api/generations/route.ts`)

**Purpose:** Create generation record and start processing (fire-and-forget)

**Flow:**
1. Validate preferences
2. Create DB record with status `'processing'`
3. Return generation ID immediately
4. Start `generateBundles()` in background (don't await)
5. Update DB when complete

**Response Time:** < 1 second (returns before generation starts)

```typescript
export async function POST(request: NextRequest) {
  const preferences = await request.json();

  // Create generation record
  const [generation] = await db.insert(generations).values({
    status: 'processing',
    preferences,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  }).returning();

  // Start generation in background (fire-and-forget)
  generateBundles(preferences)
    .then(async (bundles) => {
      // Update DB when complete
      await db.update(generations)
        .set({ status: 'completed', bundles, updatedAt: new Date() })
        .where(eq(generations.id, generation.id));
    })
    .catch(async (error) => {
      // Update DB on error
      await db.update(generations)
        .set({ status: 'failed', error: error.message, updatedAt: new Date() })
        .where(eq(generations.id, generation.id));
    });

  // Return immediately - client will poll
  return NextResponse.json({
    generationId: generation.id,
    status: 'processing',
  });
}
```

**Key Points:**
- Fire-and-forget pattern: don't await `generateBundles()`
- Promise chain updates DB when complete
- Client doesn't wait for generation

---

### 3. GET Endpoint (`src/app/api/generations/[id]/route.ts`)

**Purpose:** Return generation status and bundles from database

**Flow:**
1. Fetch generation from database
2. Return whatever's in the database

**That's it!** No OpenAI calls, no complex logic.

```typescript
export async function GET(request: NextRequest, { params }) {
  const { id } = await params;

  // Fetch generation from database
  const [generation] = await db.select()
    .from(generations)
    .where(eq(generations.id, id))
    .limit(1);

  if (!generation) {
    return NextResponse.json({ error: 'Generation not found' }, { status: 404 });
  }

  // Return whatever's in the database
  return NextResponse.json({
    generationId: generation.id,
    status: generation.status,
    bundles: generation.bundles || null,
    error: generation.error || null,
    createdAt: generation.createdAt,
  });
}
```

**Key Points:**
- Pure database read - no business logic
- Fast response (< 100ms)
- Idempotent - same result every time
- POST endpoint handles all generation logic

---

### 4. Client Polling (`src/app/loading_bundles/page.tsx`)

**Flow:**
1. On mount: Check localStorage for existing generation ID
2. If found: Resume polling immediately
3. If not: POST /api/generations to start new generation
4. Poll GET /api/generations/[id] every 25 seconds
5. Display generic loading messages (rotated randomly)
6. When status = 'completed', save bundles and navigate to /bundles

**Resilience:**
- If client refreshes: resume polling with stored generation ID
- If mobile sleeps: resume polling on wake
- Polls instantly on resume, then every 25s
- No loss of progress: server continues independently

```typescript
const POLL_INTERVAL_MS = 25000; // 25 seconds
const LOADING_MESSAGES = [
  "Analyzing your preferences...",
  "Searching for the best events...",
  "Crafting your perfect bundles...",
  // ... more messages
];

useEffect(() => {
  async function initializeGeneration() {
    // Check for existing generation in localStorage
    const storedGenerationId = getStoredGenerationId();

    if (storedGenerationId) {
      // Resume polling (polls immediately, then every 25s)
      startPolling(storedGenerationId);
      return;
    }

    // Start new generation
    const response = await fetch('/api/generations', {
      method: 'POST',
      body: JSON.stringify({ preferences }),
    });
    const { generationId } = await response.json();

    localStorage.setItem(STORAGE_KEY_GENERATION_ID, generationId);
    startPolling(generationId);
  }

  function startPolling(genId: string) {
    pollStatus(genId); // Poll immediately (important for resume)
    pollIntervalRef.current = setInterval(() => pollStatus(genId), POLL_INTERVAL_MS);
  }

  async function pollStatus(genId: string) {
    const response = await fetch(`/api/generations/${genId}`);
    const data = await response.json();

    // Rotate loading message on each poll
    setLoadingMessage(LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)]);

    // Handle completion
    if (data.status === 'completed') {
      stopPolling();
      localStorage.removeItem(STORAGE_KEY_GENERATION_ID);
      setBundles(data.bundles);
      router.push('/bundles');
    }
  }

  initializeGeneration();
}, [isHydrated]);
```

**Key Points:**
- 25-second polling interval (less frequent than v2.0)
- Generic loading messages instead of AI reasoning
- Instant poll on mount (for resume case)
- Same resilience as before

---

## API Reference

### POST /api/generations

**Request:**
```json
{
  "preferences": {
    "interests": ["music", "nightlife"],
    "musicProfile": "Electronic, House",
    "timeframe": "This weekend",
    "otherPreferences": "Looking for underground venues"
  }
}
```

**Response (200 OK):**
```json
{
  "generationId": "cm3jk8x1z0000v8xb2c3d4e5f",
  "status": "processing"
}
```

**Response Time:** < 2 seconds

---

### GET /api/generations/[id]

**Request:** `GET /api/generations/cm3jk8x1z0000v8xb2c3d4e5f`

**Response (Processing):**
```json
{
  "generationId": "cm3jk8x1z0000v8xb2c3d4e5f",
  "status": "processing",
  "reasoningSummaries": [
    "Analyzing user music preferences",
    "Searching for events matching interests",
    "Filtering venues by neighborhood"
  ],
  "openaiResponseId": "resp_xyz123",
  "createdAt": "2025-10-21T10:30:00Z"
}
```

**Response (Completed):**
```json
{
  "generationId": "cm3jk8x1z0000v8xb2c3d4e5f",
  "status": "completed",
  "bundles": [
    {
      "title": "Underground Techno Weekend",
      "description": "...",
      "keyEvents": [...],
      "imageUrl": "..."
    }
  ],
  "reasoningSummaries": [...],
  "createdAt": "2025-10-21T10:30:00Z"
}
```

**Response (Failed):**
```json
{
  "generationId": "cm3jk8x1z0000v8xb2c3d4e5f",
  "status": "failed",
  "error": "OpenAI API rate limit exceeded",
  "createdAt": "2025-10-21T10:30:00Z"
}
```

---

## Database Schema

### `generations` Table

```sql
CREATE TABLE generations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status      TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'processing' | 'completed' | 'failed'
  preferences JSONB NOT NULL,                   -- UserPreferences object
  bundles     JSONB,                            -- TripBundle[] (null until completed)
  error       TEXT,                             -- Error message if failed
  created_at  TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at  TIMESTAMP DEFAULT NOW() NOT NULL,
  expires_at  TIMESTAMP NOT NULL                -- 24 hours from creation
);

CREATE INDEX idx_generations_status ON generations(status);
CREATE INDEX idx_generations_expires_at ON generations(expires_at);
```

**Why This Schema:**
- `bundles` stored as JSONB for fast retrieval (no re-generation)
- `expires_at` enables cleanup of old generations
- `status` indexed for efficient filtering
- **Removed** `openai_response_id` (not needed in v3.0)

---

## Key Design Decisions

### 1. Why Synchronous Mode (`background: false`)?

**v2.0 Problem:** Background mode required tracking response IDs, polling OpenAI, extracting summaries

**v3.0 Solution:** Synchronous mode - just wait for OpenAI to complete

**Benefits:**
- Much simpler code (~60% less in generation service)
- No OpenAI polling needed
- No response ID tracking
- Linear execution flow
- Easier debugging

**Trade-off:** Can't get reasoning summaries in real-time
- **Acceptable:** Generic loading messages work fine

---

### 2. Why Fire-and-Forget in POST Endpoint?

**Design:** POST creates DB record, starts generation, returns immediately

**Why not await?**
- Client needs immediate response (< 1s)
- Generation takes 2-5 minutes
- Database persistence ensures no data loss

**Benefits:**
- Fast POST response
- Generation continues independently
- Client can refresh without losing progress

---

### 3. Why 25-Second Polling Interval?

**Considerations:**
- Too fast (< 10s): excessive database queries
- Too slow (> 60s): user might think it's stuck

**Chosen:** 25 seconds as balance

**Cost Analysis:**
- Average generation: 3 minutes = ~7 polls
- Cost: negligible (database reads only)
- User experience: acceptable wait time

**Special case:** Poll instantly on resume for immediate feedback

---

### 4. Why Remove Reasoning Summaries?

**v2.0:** Displayed real-time AI reasoning to user

**v3.0:** Generic loading messages

**Why remove?**
- Reasoning summaries only available with streaming OR background mode + polling
- Synchronous mode doesn't provide incremental updates
- Complexity not worth the UX benefit
- Generic messages provide good-enough feedback

**Alternative considered:** Use streaming for summaries
- **Rejected:** Streaming with reasoning models is complex
- **Rejected:** Would need to keep background mode

---

### 5. Why Store Bundles in Database?

**Alternative:** Generate bundles on every request

**Chosen:** Cache bundles in database after generation

**Benefits:**
- Enables resume after client refresh
- Fast subsequent reads
- No re-generation needed
- Resilient to server restarts

**Trade-off:** Database storage
- **Acceptable:** ~10-50 KB per generation, 24-hour TTL

---

## Trade-offs

### ✅ Accepted Trade-offs

1. **GET Endpoint Complexity**
   - GET does multiple jobs: status check, extraction, caching
   - **Justification:** Simpler overall architecture, avoids background jobs

2. **First Completion Poll Takes Longer**
   - Client poll that catches completion must extract bundles
   - **Justification:** Happens once, < 5s, acceptable UX

3. **No Real-Time SSE Streaming**
   - 5-second polling instead of instant SSE updates
   - **Justification:** Better resilience, simpler implementation, 5s is "good enough"

4. **Database Storage for Bundles**
   - Stores potentially large JSON in database
   - **Justification:** Fast retrieval, resilience, enables future features

---

### ❌ Rejected Alternatives

1. **SSE Streaming (v1.0)**
   - **Rejected:** Fragile on mobile, complex reconnection logic
   - **Problem:** Client refresh breaks generation

2. **Server-Side Background Polling**
   - **Rejected:** Redundant with client polling
   - **Problem:** Two polling paths, more complexity

3. **Synchronous OpenAI Calls (`background: false`)**
   - **Rejected:** No response ID until completion
   - **Problem:** No reasoning summaries, no resume capability

4. **WebSockets**
   - **Rejected:** Overkill for this use case
   - **Problem:** More complex than polling, same reconnection issues as SSE

---

## Future Considerations

### Potential Improvements

1. **Exponential Backoff for Polling**
   - Start at 2s, increase to 10s after 1 minute
   - Reduces API calls for long generations
   - **When:** If polling cost becomes significant

2. **Server-Sent Events for Reasoning Summaries Only**
   - Use SSE for real-time summaries, polling for status
   - Gracefully degrade to polling if SSE fails
   - **When:** User feedback shows 5s delay is noticeable

3. **Background Job Queue (Vercel Cron, Inngest)**
   - Move bundle extraction to background job
   - GET endpoint just returns status
   - **When:** Extraction time exceeds Vercel function timeout

4. **OpenAI Webhook Support**
   - OpenAI POSTs to our endpoint when complete
   - Reduces our polling of OpenAI
   - **When:** OpenAI adds webhook support for Responses API

5. **Cached Reasoning Summaries in Database**
   - Store summaries in DB instead of fetching from OpenAI every poll
   - Reduces OpenAI API calls
   - **When:** OpenAI rate limits become an issue

6. **Progressive Bundle Display**
   - Extract partial bundles as they're generated
   - Show user bundles incrementally instead of all at once
   - **Requires:** OpenAI streaming support with function calls

---

## Monitoring & Observability

### Key Metrics to Track

1. **Generation Success Rate**
   - % of generations that complete vs. fail
   - Alert if < 95%

2. **Average Generation Time**
   - Time from POST to completion
   - Alert if > 5 minutes

3. **Client Poll Count per Generation**
   - Average number of GET requests before completion
   - Optimize if excessive

4. **OpenAI API Errors**
   - Track rate limits, timeouts, failures
   - Alert on spike

5. **Database Growth**
   - Monitor `generations` table size
   - Ensure cleanup job running (24-hour TTL)

---

## Version History

### v3.0 - Synchronous Mode with Client Polling (Current)
**Date:** 2025-10-21
**Changes:**
- Switched to `background: false` for OpenAI (synchronous)
- Removed reasoning summaries
- Simplified GET endpoint to pure DB read
- Fire-and-forget pattern in POST endpoint
- 25-second polling interval (vs 5s in v2.0)
- ~60% less code than v2.0
- Instant poll on resume

**Benefits:**
- Much simpler codebase
- Easier to debug and maintain
- Still fully resilient to disconnects

**Trade-offs:**
- No real-time AI reasoning summaries
- Generic loading messages instead

### v2.0 - Background Mode with Client Polling (Deprecated)
**Date:** 2025-10-21
**Changes:**
- Switched to `background: true` for OpenAI
- Removed server-side background polling
- GET endpoint extracts bundles on-demand
- Reasoning summaries available immediately

**Issues:**
- Too complex for the UX benefit
- Required tracking OpenAI response IDs
- Required polling OpenAI API
- Reasoning summary extraction logic

**Replaced by:** v3.0

### v1.0 - SSE Streaming (Deprecated)
**Date:** 2025-10-15
**Issues:**
- Client refresh broke generation
- Complex cursor/resume logic
- Fragile on mobile

**Replaced by:** v2.0

---

## Questions & Answers

**Q: What happens if the server crashes mid-generation?**
A: OpenAI continues processing in background. When server restarts, client polls GET endpoint, which retrieves status from OpenAI and extracts bundles.

**Q: What if client never polls after generation completes?**
A: Bundles remain in OpenAI's storage (with `store: true`) for retrieval. Database record expires after 24 hours.

**Q: Can multiple clients poll the same generation ID?**
A: Yes. First client to poll after completion triggers extraction. Subsequent polls get cached result from database.

**Q: What if OpenAI function call fails?**
A: Error caught in `pollGenerationUntilComplete()`, database updated with status `'failed'`, error message returned to client.

**Q: How long does OpenAI store responses?**
A: TBD - need to verify OpenAI's retention policy for stored responses.

---

## References

- [OpenAI Responses API Documentation](https://platform.openai.com/docs/api-reference/responses)
- [Vercel Serverless Functions](https://vercel.com/docs/functions)
- [Supabase Postgres](https://supabase.com/docs/guides/database)
- [Drizzle ORM](https://orm.drizzle.team/)

---

**Document Maintained By:** Development Team
**Review Cycle:** Update on significant architecture changes
**Feedback:** Submit issues or questions via GitHub
