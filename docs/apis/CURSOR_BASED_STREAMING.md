# Cursor-Based Streaming Implementation

This document explains how we implemented OpenAI's cursor-based streaming pattern for resilient, resumable background responses.

## OpenAI Pattern (From Documentation)

```javascript
import OpenAI from "openai";
const client = new OpenAI();

const stream = await client.responses.create({
  model: "o3",
  input: "Write a very long novel about otters in space.",
  background: true,  // Runs in background (no timeouts)
  stream: true,      // Stream events with cursor
});

let cursor = null;
for await (const event of stream) {
  console.log(event);
  cursor = event.sequence_number;  // Track cursor
}

// If connection drops, resume from cursor:
const resumedStream = await client.responses.stream(resp.id, {
  starting_after: cursor
});
```

## Our Implementation

### Architecture Overview

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────┐
│   Client    │ SSE     │  /api/generate-  │  Stream │   OpenAI    │
│ (EventSource│◄────────┤    bundles       ├────────►│ Background  │
│  + cursor)  │         │  (GET endpoint)  │         │   + Stream  │
└──────┬──────┘         └──────────────────┘         └─────────────┘
       │
       │ localStorage
       │ ┌─────────────────────┐
       └─┤ response_id         │
         │ cursor (updated     │
         │  continuously)      │
         └─────────────────────┘
```

### Flow Diagram

#### New Generation
```
1. Client loads → No stored responseId
2. EventSource → GET /api/generate-bundles?preferences={...}
3. Server → openai.responses.create({ background: true, stream: true })
4. Server sends SSE events:
   - event: response_id → Store responseId + cursor
   - event: cursor → Update cursor continuously
   - event: summary → Update cursor + add summary
   - event: completed → Clear cursor + fetch bundles
5. Every event updates cursor in localStorage
```

#### Resume After Refresh
```
1. Client loads → Found stored responseId + cursor
2. EventSource → GET /api/generate-bundles?responseId=...&startingAfter=cursor
3. Server → OpenAI API: /responses/{id}?stream=true&starting_after={cursor}
4. Server streams events from cursor onwards (no duplicates)
5. Continue tracking cursor as before
```

### Server Implementation

**File:** `src/app/api/generate-bundles/route.ts`

```typescript
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const responseId = url.searchParams.get('responseId');
  const startingAfter = url.searchParams.get('startingAfter');
  const preferences = url.searchParams.get('preferences');

  if (responseId && startingAfter) {
    // Resume from cursor
    const response = await fetch(
      `https://api.openai.com/v1/responses/${responseId}?stream=true&starting_after=${startingAfter}`,
      { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` } }
    );
    return new Response(response.body, { headers: { 'Content-Type': 'text/event-stream' } });
  }

  if (responseId) {
    // Resume from beginning (no cursor)
    const response = await fetch(
      `https://api.openai.com/v1/responses/${responseId}?stream=true`,
      { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` } }
    );
    return new Response(response.body, { headers: { 'Content-Type': 'text/event-stream' } });
  }

  // Create new stream
  const stream = await openai.responses.create({
    prompt: { id: PROMPT_ID, variables: ... },
    background: true,
    stream: true,
    store: true,
    reasoning: { effort: 'medium', summary: 'auto' },
  });

  // Forward SSE events with cursor tracking
  for await (const event of stream) {
    // Send: response_id, cursor, summary, completed events
    // Each includes evt.sequence_number as cursor
  }
}
```

### Client Implementation

**File:** `src/app/loading_bundles/page.tsx`

```typescript
function startStreaming(existingResponseId: string | null, existingCursor: string | null) {
  // Build URL
  const params = new URLSearchParams();
  if (existingResponseId) {
    params.set('responseId', existingResponseId);
    if (existingCursor) {
      params.set('startingAfter', existingCursor);  // Resume from cursor
    }
  } else {
    params.set('preferences', JSON.stringify(preferences));
  }

  const eventSource = new EventSource(`/api/generate-bundles?${params}`);

  let currentCursor = existingCursor || '';

  eventSource.addEventListener('cursor', (e) => {
    const data = JSON.parse(e.data);
    currentCursor = data.cursor;
    localStorage.setItem('special-trips-cursor', currentCursor);  // Save continuously
  });

  eventSource.addEventListener('summary', (e) => {
    const data = JSON.parse(e.data);
    currentCursor = data.cursor;
    localStorage.setItem('special-trips-cursor', currentCursor);
    // Add summary to UI
  });

  eventSource.addEventListener('completed', (e) => {
    localStorage.removeItem('special-trips-cursor');  // Clear after completion
    // Fetch bundles
  });
}
```

## Key Features

### 1. Continuous Cursor Tracking
- Every SSE event includes `sequence_number` (cursor)
- Cursor saved to localStorage after **every event**
- If page refreshes mid-generation, can resume from exact position

### 2. No Duplicate Summaries
- `starting_after` parameter tells OpenAI to start from cursor
- Only new events are sent (events after the cursor)
- UI shows seamless continuation

### 3. Resilient to Connection Drops
- If connection drops, cursor is already saved
- On page reload, automatically resumes from cursor
- OpenAI continues processing in background (no work lost)

### 4. Unified Architecture
- Same endpoint handles new streams and resumptions
- Same EventSource code on client
- Just different query parameters

## SSE Event Types

### `response_id`
```json
{
  "responseId": "resp_abc123...",
  "cursor": "seq_xyz..."
}
```
Sent once at stream start. Client stores both values.

### `cursor`
```json
{
  "cursor": "seq_xyz..."
}
```
Sent with every event. Client updates cursor continuously.

### `summary`
```json
{
  "text": "Planning concerts in San Francisco",
  "cursor": "seq_xyz..."
}
```
Sent when reasoning summary completes. Client adds to UI and updates cursor.

### `completed`
```json
{
  "responseId": "resp_abc123...",
  "cursor": "seq_final..."
}
```
Sent when generation completes. Client clears cursor and fetches final bundles.

### `error`
```json
{
  "error": "Error message",
  "cursor": "seq_xyz..."
}
```
Sent if generation fails. Client shows error.

## LocalStorage Schema

### Keys
- `special-trips-response-id` - OpenAI response ID (resp_...)
- `special-trips-cursor` - Current cursor position (seq_...)

### Lifecycle
1. **Generation starts:** Store responseId + initial cursor
2. **During generation:** Update cursor continuously
3. **Page refresh:** Read both, resume from cursor
4. **Generation completes:** Clear both keys
5. **Bundles saved:** Different key (handled by PreferencesContext)

## Testing Scenarios

### Test 1: Fresh Generation
```javascript
localStorage.clear();
// Navigate to /interests
// Complete flow
// ✓ Should see summaries appearing
// ✓ Should complete and show bundles
```

### Test 2: Resume from Cursor (Page Refresh)
```javascript
// Start generation
// Wait for 3-4 summaries
// Refresh page
// ✓ Should resume streaming from cursor
// ✓ Should NOT show duplicate summaries
// ✓ Should continue to completion
```

### Test 3: Connection Drop
```javascript
// Start generation
// Open DevTools → Network → Throttle to Offline
// Wait 5 seconds
// Go back Online
// Refresh page
// ✓ Should resume from last cursor
```

### Test 4: Multiple Tabs
```javascript
// Tab 1: Start generation
// Tab 2: Open same app
// ✓ Both tabs should see same responseId
// ✓ Should not interfere with each other
```

## Benefits

### vs. Original Inngest Architecture
| Feature | Inngest | Cursor Streaming |
|---------|---------|------------------|
| Timeouts | 300s limit ❌ | No limit ✅ |
| Retries | Automatic (causes loops) ❌ | None needed ✅ |
| Resumption | No ❌ | From cursor ✅ |
| State storage | Redis | OpenAI + localStorage |
| Complexity | High (3 services) | Low (1 service) |
| Real-time summaries | Yes ✅ | Yes ✅ |

### vs. Simple Polling
| Feature | Polling | Cursor Streaming |
|---------|---------|------------------|
| Real-time summaries | No ❌ | Yes ✅ |
| Resumption | Restart from 0 | From cursor ✅ |
| Network efficiency | Poll every 5s | SSE (push) |
| Complexity | Simple | Moderate |

## Error Handling

### Connection Errors
- Client: EventSource `onerror` triggered
- Action: Log error, keep cursor saved
- Recovery: User refreshes → resumes from cursor

### OpenAI Errors
- Server: Catches errors, sends `error` event
- Client: Navigates to `/error` page
- Recovery: User can retry (new generation)

### Invalid Cursor
- Server: OpenAI returns 400 if cursor invalid
- Fallback: Resume from beginning (no cursor)
- Rare: Only if cursor corrupted

## Performance

### Network
- SSE: Single long-lived connection
- vs. Polling: 120 requests over 10 minutes
- Bandwidth: ~1KB per summary (minimal)

### Storage
- localStorage: 2 keys (~100 bytes total)
- Updated: After every event (~20-50 times per generation)
- Edge Runtime: No server-side storage needed

## Security

- Response ID is safe to expose (public identifier)
- Cursor is safe to expose (just a sequence number)
- API key stays server-side (never sent to client)
- Same security model as before

## Future Enhancements

1. **Automatic retry on disconnect**
   - Currently: Manual refresh to resume
   - Future: Auto-retry with exponential backoff

2. **Progress indicator**
   - Currently: Spinner only
   - Future: Show cursor position as % complete

3. **Offline support**
   - Currently: Requires connection
   - Future: Queue resumption when back online

4. **Summary deduplication**
   - Currently: Assumes starting_after works
   - Future: Client-side dedup by summary ID

## References

- [OpenAI Background Mode Docs](https://docs.openai.com/docs/background-mode)
- [Server-Sent Events (SSE) Spec](https://html.spec.whatwg.org/multipage/server-sent-events.html)
- [EventSource API](https://developer.mozilla.org/en-US/docs/Web/API/EventSource)
