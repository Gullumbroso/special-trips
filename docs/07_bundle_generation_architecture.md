# Technical Design Document: Bundle Generation Architecture

**Last Updated:** 2025-10-23
**Status:** ✅ Implemented
**Version:** 4.0 (Inngest Worker with Client Polling)

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

The bundle generation system creates personalized trip bundles using OpenAI's Responses API with reasoning models. The architecture uses **Inngest workers for background processing with client polling** to maintain resilience to client disconnections while avoiding Vercel serverless timeout limitations.

---

## Problem Statement

### Evolution History
- **v1.0 (SSE Streaming)**: Server-Sent Events with tight coupling, fragile on disconnects
- **v2.0 (Background Mode)**: OpenAI background mode with reasoning summaries, complex polling
- **v3.0 (Synchronous + waitUntil)**: Simplified synchronous generation, fire-and-forget with waitUntil()
- **v4.0 (Current - Inngest)**: Worker-based processing, no Vercel timeout issues

### Key Requirements
1. Client must be able to refresh/reconnect without losing progress ✅
2. Mobile devices must handle sleep/wake cycles gracefully ✅
3. Generation must complete even if client disconnects ✅
4. Minimal complexity in reconnection logic ✅
5. Simple, maintainable codebase ✅

---

## Architecture Decision

### Chosen Approach: Inngest Worker + Client Polling

**Core Principle:** Worker generates asynchronously on Inngest infrastructure, client polls for completion

```
Client → POST → Server generates UUID → Sends Inngest event → Returns immediately
                                        ↓
                                    Inngest Worker:
                                    1. Creates DB record
                                    2. Generates bundles (2-5 min)
                                    3. Updates DB when complete

Client polls GET endpoint every 25s → Reads from DB → Gets bundles when ready
```

### Why This Architecture?

1. **No Vercel Timeout Issues**
   - Worker runs on Inngest's infrastructure (not Vercel)
   - Can run for up to 1 hour (vs 5 min Vercel limit)
   - Generation never times out, regardless of complexity
   - Node.js runtime compatible (no Edge Runtime required)

2. **Worker Manages All DB Operations**
   - Worker creates DB record (not POST endpoint)
   - Atomic operation: if worker fails before DB creation, no orphaned records
   - Clean separation: worker owns entire generation lifecycle
   - Automatic retries for transient failures (DB, network, etc.)

3. **Database as Source of Truth**
   - Generation state persists across disconnects
   - Client can resume by polling with generation ID
   - Server stateless: no in-memory tracking needed
   - All data cached in DB for fast retrieval

4. **Robust Error Handling**
   - Inngest retries worker failures (up to 3 times)
   - DB failures properly handled with retry logic
   - Generation failures recorded in DB for client visibility
   - No silent failures or stuck jobs

5. **Client Resilience**
   - Polls instantly on mount (resume case)
   - Then polls every 25 seconds
   - Generic loading messages
   - Seamlessly resumes after refresh/sleep
   - 404 on first poll is expected (worker creating DB record)

---

## System Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Client: POST /api/generations (preferences)                  │
└────────────────────────┬────────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Server: Generate UUID & Send Inngest Event                   │
│    - generationId = randomUUID()                                │
│    - inngest.send("generation.create", { generationId, prefs }) │
└────────────────────────┬────────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Server: Return to Client (immediately)                       │
│    { generationId: "gen_123", status: "processing" }            │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          └─> Client polls GET every 25s

┌─────────────────────────────────────────────────────────────────┐
│ 4. Inngest Worker: Receive "generation.create" event            │
└────────────────────────┬────────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Worker Step 1: Create DB record                              │
│    - INSERT INTO generations (id, status='processing', ...)     │
│    - If fails: Inngest retries entire function                  │
└────────────────────────┬────────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. Worker Step 2: Generate bundles                              │
│    - Calls generateBundles() (2-5 min, no timeout limit)        │
│    - OpenAI with background: false (synchronous)                │
│    - Handles function calls in loop                             │
│    - Returns bundles or throws error                            │
└────────────────────────┬────────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. Worker Step 3: Update DB with result                         │
│    Success: status='completed', bundles=[...]                   │
│    Failure: status='failed', error="..."                        │
│    - If update fails: Inngest retries                           │
└─────────────────────────────────────────────────────────────────┘
                         ▲
                         │
┌────────────────────────┴────────────────────────────────────────┐
│ 8. Client: Poll GET /api/generations/[id] (every 25s)           │
│    - Server reads from DB                                       │
│    - Returns: { status, bundles, error }                        │
│    - No OpenAI calls, pure DB read                              │
│    - First poll may return 404 (worker hasn't created record)   │
└─────────────────────────────────────────────────────────────────┘
```

### Component Diagram

```
┌──────────────┐
│   Client     │
│  (Browser)   │
└──────┬───────┘
       │ POST /api/generations
       │ GET /api/generations/[id] (poll every 25s)
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│   Next.js API Routes (Vercel)                           │
│  ┌─────────────────────────────┐                        │
│  │ POST /api/generations       │                        │
│  │ - Generate UUID             │                        │
│  │ - Send Inngest event        │                        │
│  │ - Return immediately        │                        │
│  └────────────┬────────────────┘                        │
│               │                                          │
│               │ inngest.send("generation.create")       │
│               │                                          │
│  ┌────────────▼────────────────┐                        │
│  │ POST/GET /api/inngest       │                        │
│  │ - Inngest webhook endpoint  │                        │
│  │ - Serves worker functions   │                        │
│  └─────────────────────────────┘                        │
│                                                          │
│  ┌─────────────────────────────┐                        │
│  │ GET /api/generations/[id]   │                        │
│  │ - Read from DB              │                        │
│  │ - Return status & bundles   │                        │
│  └─────────────────────────────┘                        │
└──────┬───────────────────────┬──────────────────────────┘
       │                       │
       │                       └──────────────┐
       ▼                                      ▼
┌──────────────┐                    ┌────────────────────┐
│  PostgreSQL  │                    │  Inngest Cloud     │
│  (Supabase)  │                    │                    │
│              │◄───────────────────┤  Worker Function:  │
│ generations  │  DB Operations     │  - Receive event   │
│   table      │  (create/update)   │  - Create DB rec   │
└──────────────┘                    │  - Generate bundles│
                                    │  - Update DB       │
                                    └─────────┬──────────┘
                                              │
                                              ▼
                                    ┌──────────────────┐
                                    │  OpenAI API      │
                                    │  (Responses API) │
                                    │                  │
                                    │ - background:    │
                                    │   false          │
                                    │ - reasoning      │
                                    │ - function calls │
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

**Purpose:** Generate UUID and trigger Inngest worker

**Flow:**
1. Validate preferences
2. Generate UUID for generation ID
3. Send Inngest event with generation ID and preferences
4. Return generation ID immediately
5. Worker handles all DB operations and generation

**Response Time:** < 1 second (just sends event, no DB operations)

```typescript
export async function POST(request: NextRequest) {
  const body = await request.json();
  const preferences: UserPreferences = body.preferences;

  if (!preferences) {
    return NextResponse.json(
      { error: 'Missing preferences in request body' },
      { status: 400 }
    );
  }

  // Generate UUID upfront so we can return it immediately
  const generationId = randomUUID();

  console.log(`[API] Creating generation ${generationId}`);

  // Send event to Inngest worker
  // The worker will:
  // 1. Create the DB record
  // 2. Generate bundles
  // 3. Update DB with results
  try {
    await inngest.send({
      name: 'generation.create',
      data: {
        generationId,
        preferences,
      },
    });

    console.log(`[API] Sent generation.create event for ${generationId}`);
  } catch (error) {
    console.error('[API] Failed to send Inngest event:', error);
    return NextResponse.json(
      { error: 'Failed to initiate generation' },
      { status: 500 }
    );
  }

  // Return immediately - worker will create DB record and process
  // Client will poll GET /api/generations/[id] for status updates
  return NextResponse.json({
    generationId,
    status: 'processing',
  });
}
```

**Key Points:**
- No DB operations in POST endpoint (worker handles them)
- Validates Inngest event send before returning
- Client can immediately start polling with returned ID
- Worker may not have created DB record yet (404 expected on first poll)

---

### 3. Inngest Worker (`src/lib/inngest/functions.ts`)

**Purpose:** Execute generation asynchronously on Inngest infrastructure

**Flow:**
1. **Step 1 - Create DB Record:** Insert generation with status='processing'
2. **Step 2 - Generate Bundles:** Call `generateBundles()` service (2-5 min)
3. **Step 3 - Update DB:** Save bundles or error to database

**Execution Environment:** Runs on Inngest Cloud (not Vercel)
- No Vercel timeout limits (can run up to 1 hour)
- Automatic retries on failure (up to 3 times)
- Step-based execution for granular retry control

```typescript
export const generateTripBundles = inngest.createFunction(
  {
    id: 'generate-trip-bundles',
    name: 'Generate Trip Bundles',
    retries: 3, // Retry DB failures and transient errors
  },
  { event: 'generation.create' },
  async ({ event, step }) => {
    const { generationId, preferences } = event.data;

    // Step 1: Create generation record in DB
    // If this fails, Inngest will retry the entire function
    await step.run('create-generation-record', async () => {
      try {
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        await db.insert(generations).values({
          id: generationId,
          status: 'processing',
          preferences,
          expiresAt,
        });

        console.log(`[Inngest] Created generation record ${generationId}`);
      } catch (error) {
        // Throw to trigger Inngest retry - this is a critical failure
        throw new Error(
          `DB creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    });

    // Step 2: Generate bundles
    // This is the long-running operation (can take 5+ minutes)
    const result = await step.run('generate-bundles', async () => {
      try {
        console.log(`[Inngest] Generating bundles for ${generationId}...`);
        const bundles: TripBundle[] = await generateBundles(preferences);
        console.log(`[Inngest] ✅ Generated ${bundles.length} bundles`);
        return { success: true as const, bundles };
      } catch (error) {
        console.error(`[Inngest] ❌ Generation failed:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Generation failed';
        return { success: false as const, error: errorMessage };
      }
    });

    // Step 3: Update generation record with results
    await step.run('update-generation-record', async () => {
      if (result.success) {
        // Success case: Update with bundles
        try {
          await db
            .update(generations)
            .set({
              status: 'completed',
              bundles: result.bundles,
              updatedAt: new Date(),
            })
            .where(eq(generations.id, generationId));

          console.log(`[Inngest] ✅ Updated with ${result.bundles?.length} bundles`);
        } catch (error) {
          // Critical failure - we generated bundles but can't save them
          // Throw to trigger retry
          throw new Error(
            `DB update failed after successful generation: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      } else {
        // Failure case: Update with error
        try {
          await db
            .update(generations)
            .set({
              status: 'failed',
              error: result.error,
              updatedAt: new Date(),
            })
            .where(eq(generations.id, generationId));

          console.log(`[Inngest] Updated with error status`);
        } catch (error) {
          // Best effort - generation already failed, don't retry forever
          // Log error but don't throw to avoid infinite retries
          console.error(`[Inngest] Failed to update with error status:`, error);
          console.error(`[Inngest] Original generation error: ${result.error}`);
        }
      }
    });

    return { generationId, success: result.success };
  }
);
```

**Key Error Handling Strategies:**

1. **DB Creation Failure:**
   - Throws error → Inngest retries entire function
   - No orphaned UUID without DB record

2. **Generation Failure:**
   - Caught and returned as `{ success: false, error }`
   - DB updated with failed status
   - Worker completes successfully (no retry)

3. **DB Update Failure (Success Case):**
   - Throws error → Inngest retries
   - Critical because bundles were successfully generated

4. **DB Update Failure (Failure Case):**
   - Logs but doesn't throw
   - Prevents infinite retries when generation already failed
   - Client sees 404 (acceptable edge case)

---

### 4. GET Endpoint (`src/app/api/generations/[id]/route.ts`)

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

### 5. Client Polling (`src/app/loading_bundles/page.tsx`)

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
- No loss of progress: worker continues independently on Inngest
- First poll may return 404 (worker creating DB record) - retries until found

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

### 1. Why Inngest Workers Instead of Vercel Functions?

**v3.0 Problem:** `waitUntil()` only works with Edge Runtime, not Node.js runtime

**v4.0 Solution:** Inngest workers run on separate infrastructure

**Benefits:**
- No Vercel timeout limits (workers can run 1+ hour)
- Works with Node.js runtime (required for some dependencies)
- Automatic retries for transient failures
- Better monitoring and observability via Inngest dashboard
- Step-based execution for granular control
- Cleaner separation of concerns

**Trade-off:** Additional service dependency (Inngest)
- **Acceptable:** Inngest has generous free tier, simpler than managing own queue

---

### 2. Why Worker Creates DB Record (Not POST Endpoint)?

**Design:** Worker owns entire lifecycle from DB creation to completion

**Benefits:**
- **Atomic operations:** If worker fails before DB creation, no orphaned records
- **No cleanup needed:** UUID without DB record doesn't exist
- **Consistent state:** Worker manages all DB mutations
- **Proper retries:** Inngest retries include DB creation

**Trade-off:** Client first poll may get 404
- **Acceptable:** Client retries, worker creates record within seconds

---

### 3. Why Not await in POST Endpoint?

**Design:** POST sends event to Inngest, returns immediately

**Why not await worker completion?**
- Client needs immediate response (< 1s)
- Worker takes 2-5 minutes
- Vercel would timeout waiting for worker
- No benefit to blocking client request

**Benefits:**
- Fast POST response
- Worker runs independently
- Client can refresh without losing progress

---

### 4. Why 25-Second Polling Interval?

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

### 5. Why Remove Reasoning Summaries?

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

### 6. Why Store Bundles in Database?

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

### v4.0 - Inngest Worker with Client Polling (Current)
**Date:** 2025-10-23
**Changes:**
- Migrated from `waitUntil()` to Inngest workers
- Worker manages all DB operations (create and update)
- POST endpoint only generates UUID and sends event
- Node.js runtime (no Edge Runtime requirement)
- Comprehensive error handling with retry logic
- Step-based worker execution

**Benefits:**
- No Vercel timeout issues (worker runs on Inngest)
- Atomic DB operations (worker owns lifecycle)
- Automatic retries for transient failures
- Better observability via Inngest dashboard
- Works with Node.js runtime

**Trade-offs:**
- Additional service dependency (Inngest)
- Client first poll may get 404 (worker creating record)
- Slightly more complex setup (webhook registration)

### v3.0 - Synchronous Mode with waitUntil (Deprecated)
**Date:** 2025-10-21
**Changes:**
- Switched to `background: false` for OpenAI (synchronous)
- Fire-and-forget with `waitUntil()` in POST endpoint
- Removed reasoning summaries
- Simplified GET endpoint to pure DB read

**Issues:**
- `waitUntil()` only works with Edge Runtime, not Node.js
- Some dependencies incompatible with Edge Runtime
- Still subject to Vercel timeout limits

**Replaced by:** v4.0

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

## Setup & Configuration

### Environment Variables

Required environment variables for Inngest integration:

```bash
# OpenAI API
OPENAI_API_KEY=sk-...

# Database
SPECIAL_TRIPS_STORAGE_POSTGRES_URL=postgres://...

# Inngest (get from https://app.inngest.com/)
INNGEST_EVENT_KEY=...        # For sending events from API routes
INNGEST_SIGNING_KEY=...      # For authenticating webhook requests
```

### Inngest Setup

1. **Create Inngest Account:** Sign up at https://app.inngest.com
2. **Create App:** Create a new app in Inngest dashboard
3. **Get API Keys:**
   - Event Key: Used by your API to send events
   - Signing Key: Used to authenticate Inngest webhook calls
4. **Add to Vercel:** Add both keys as environment variables in Vercel
5. **Deploy:** Deploy your app to Vercel
6. **Sync Webhook:** In Inngest dashboard, sync your webhook URL:
   - URL: `https://your-domain.vercel.app/api/inngest`
   - Inngest will auto-discover the `generate-trip-bundles` function

### Monitoring

**Inngest Dashboard:**
- View function runs and their status
- See event history
- Monitor errors and retries
- Check execution time and costs

**Vercel Logs:**
- POST endpoint: Event send confirmation
- GET endpoint: Polling requests
- Worker logs appear in Inngest dashboard (not Vercel)

---

## Questions & Answers

**Q: What happens if Vercel crashes mid-generation?**
A: Worker runs on Inngest infrastructure, not Vercel. Generation continues unaffected.

**Q: What if client never polls after generation completes?**
A: Bundles remain in database. Record expires after 24 hours and is cleaned up.

**Q: Can multiple clients poll the same generation ID?**
A: Yes. All clients get the same result from database. No duplicate work is done.

**Q: What if OpenAI function call fails?**
A: Error caught in worker's `generate-bundles` step, database updated with status `'failed'`, error message returned to client.

**Q: What happens if Inngest event send fails?**
A: POST endpoint catches the error and returns 500 to client. No DB record is created.

**Q: What if worker fails during DB creation?**
A: Inngest retries entire function (up to 3 times). If all retries fail, client sees 404 when polling.

**Q: What if worker succeeds but DB update fails?**
A: Worker throws error to trigger Inngest retry. Critical to save successfully generated bundles.

---

## References

- [OpenAI Responses API Documentation](https://platform.openai.com/docs/api-reference/responses)
- [Inngest Documentation](https://www.inngest.com/docs)
- [Vercel Serverless Functions](https://vercel.com/docs/functions)
- [Supabase Postgres](https://supabase.com/docs/guides/database)
- [Drizzle ORM](https://orm.drizzle.team/)

---

**Document Maintained By:** Development Team
**Review Cycle:** Update on significant architecture changes
**Feedback:** Submit issues or questions via GitHub
