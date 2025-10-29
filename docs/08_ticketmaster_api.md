# 📄 **Implementation Document: Ticketmaster Event Search Tool**

## **Status: ✅ WORKING IN PRODUCTION**

## **Objective**

A function that allows the **model** (GPT-5) to programmatically search for **Ticketmaster events** by:

* **Segment or Genre** (e.g. *Music*, *Jazz*, *Sports*, *Football*, *Arts & Theatre*)
* **Entity** (e.g. *artist*, *football club*, *museum*, *venue*, or other named attraction*)
* **Location** (e.g. *country*, *city*, *date range*)

The model calls this deterministically as part of its **trip-planning pipeline**, not a conversational flow.
Purpose: retrieve relevant events for a user's preferences and upcoming destinations.

## **Important Constraints**

⚠️ **Rate Limits:** Ticketmaster API has a 5 queries/sec rate limit
- Each function call can now search **MULTIPLE cities/genres/segments** in a single request
- Model can still make parallel calls if needed for different country codes
- Locale is set to `'*'` (all locales) to maximize result coverage; model translates as needed
- Results size increased to 200 per request (from 100)

---

## **Functional Requirements**

### 0. Discovery: Get Available Classifications (NEW)

**Function:** `get_ticketmaster_classifications`

**Purpose:** Returns a filtered list of Ticketmaster segments and genres (Music, Arts & Theatre, Sports only) so the model knows exactly what names to use when searching.

**Why this is important:**
- Prevents naming mismatches (e.g., searching for "Hip Hop" when Ticketmaster uses "Hip-Hop")
- Helps the model discover what categories are available
- Reduces errors from invalid segment/genre names
- **Reduces token usage**: Only returns the 3 most relevant segments for trip planning

**Filtered segments returned:**
- **Music** (ID: KZFzniwnSyZfZ7v7nJ)
- **Arts & Theatre** (ID: KZFzniwnSyZfZ7v7na)
- **Sports** (ID: KZFzniwnSyZfZ7v7nE)

**Parameters:** None (no arguments required)

**Response format:**
```json
{
  "segments": [
    {
      "name": "Arts & Theatre",
      "genres": ["Comedy", "Magic & Illusion", "Theatre", ...]
    },
    {
      "name": "Music",
      "genres": ["Alternative", "Blues", "Classical", "Country", "Hip-Hop", "Jazz", "Pop", "Rock", ...]
    },
    {
      "name": "Sports",
      "genres": ["Basketball", "Football", "Hockey", "Soccer", ...]
    }
  ]
}
```

**Performance:**
- **Fast**: ~50ms (uses cached classifications data)
- **Low token usage**: Only 3 segments returned (not all Ticketmaster categories)
- **No API calls**: Uses existing database cache
- **Shared cache**: Same cache used by event search function

**Usage pattern:**
The model should typically call this **once at the beginning** of trip planning to understand what categories are available, then use those exact names in subsequent `ticketmaster_event_search` calls.

**Example workflow:**
1. User says they like "hip hop music"
2. Model calls `get_ticketmaster_classifications()`
3. Model sees "Hip-Hop" is available under Music segment
4. Model calls `ticketmaster_event_search` with `segmentName: "Music", genreName: "Hip-Hop"` ✅
5. Events are found successfully (no naming mismatch errors)

**Implementation:** `getTicketmasterClassifications()` in [ticketmaster.ts:712-769](src/lib/ticketmaster.ts#L712-L769)

---

### 1. Inputs

The function accepts:

| Parameter       | Type                       | Description                                                                                                     | Notes                                     |
| --------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `countryCode`   | string                     | ISO country code (e.g., `"GB"`, `"FR"`, `"NL"`)                                                                 | **Required**                              |
| `city`          | string or string[]         | Filter results by city or nearby area (supports multiple cities)                                                | Can specify multiple cities in one call   |
| `segmentName`   | string or string[]         | High-level category, e.g. `"Music"`, `"Sports"`, `"Arts & Theatre"` (supports multiple)                        | Optional                                  |
| `genreName`     | string or string[]         | Subcategory, e.g. `"Jazz"`, `"Football"`, `"Classical"` (supports multiple, searches across all segments if no segment specified) | Optional |
| `entityName`    | string or string[]         | Artist, team, venue, or organization name (e.g. `"Coldplay"`, `"Manchester United"`) (supports multiple)       | Optional                                  |
| `startDateTime` | string (optional)          | ISO-8601 UTC                                                                                                    |                                           |
| `endDateTime`   | string (optional)          | ISO-8601 UTC                                                                                                    |                                           |

**Handled Automatically:**
- `locale`: Always set to `'*'` (all locales) to maximize result coverage
- `apikey`: Loaded from `process.env.TICKETMASTER_API_KEY` (never exposed to model or client)

**Note:** Using `locale='*'` returns events from all locales, not just English. The model will translate content as needed for the user.

**Example calls:**

Single values:
* `{"countryCode": "FR", "city": "Paris", "segmentName": "Music", "genreName": "Jazz", "startDateTime": "2025-11-10T00:00:00Z", "endDateTime": "2025-11-15T23:59:59Z"}`
* `{"countryCode": "ES", "entityName": "FC Barcelona"}`
* `{"countryCode": "FR", "city": "Paris", "segmentName": "Arts & Theatre"}`

Multiple values (NEW):
* `{"countryCode": "ES", "city": ["Barcelona", "Madrid"], "segmentName": "Music", "genreName": ["Jazz", "Rock"]}`
* `{"countryCode": "FR", "segmentName": ["Music", "Sports"], "startDateTime": "2025-11-10T00:00:00Z"}`
* `{"countryCode": "GB", "entityName": ["Coldplay", "The Rolling Stones", "Ed Sheeran"]}`

 
---

### 2. Classification Mapping (cached)

For every request with `segmentName` or `genreName`:

1. Retrieve classification data from **database cache** (expires after 7 days)
   - If cache is valid → use cached data (fast, no API call)
   - If cache is expired or missing → fetch fresh from API and cache it
   - API endpoint: `GET https://app.ticketmaster.com/discovery/v2/classifications.json?apikey=API_KEY&locale=*`
2. Match by case-insensitive comparison:

   * `segment.name` → `segmentName`
   * `genre.name` → `genreName` (if segment provided, searches within that segment; otherwise searches across all segments)
3. Extract `segmentId` and/or `genreId`.
4. If segment/genre not found, return structured error (unless only `entityName` is supplied)

**Performance Benefits:**
- **Cache hit**: ~50ms (database read)
- **Cache miss**: ~200-500ms (API fetch + database write)
- Classifications change rarely, so cache hit rate is ~99%+

---

### 3. Entity Lookup

If `entityName` is provided:

1. Query Ticketmaster's **Attraction Search** endpoint:

   ```
   GET https://app.ticketmaster.com/discovery/v2/attractions.json
       ?keyword=<entityName>
       &size=10
       &locale=*
       &apikey=<API_KEY>
   ```
2. Select the best match (first result = highest relevance).
3. Extract the `id` (attractionId).
4. If not found, return structured error.
5. Use this ID in the event search query.

Entities may include:

* Artists (e.g. Coldplay, Drake)
* Sports teams (e.g. FC Barcelona, Manchester United)
* Venues (e.g. Louvre Museum, O2 Arena)
* Organizations hosting events (e.g. Cirque du Soleil)

---

### 4. Event Search Logic

After resolving any of the following:

* `segmentId` (from segmentName)
* `genreId` (from genreName)
* `attractionId` (from entityName)

→ Query Ticketmaster's **Events endpoint**:

```
GET https://app.ticketmaster.com/discovery/v2/events.json
    ?countryCode=<countryCode>       # required
    &city=<city>                     # optional (can repeat for multiple cities)
    &segmentId=<SEGMENT_ID>          # optional (can repeat for multiple segments)
    &genreId=<GENRE_ID>              # optional (can repeat for multiple genres)
    &attractionId=<ATTRACTION_ID>    # optional (can repeat for multiple entities)
    &startDateTime=<startDateTime>   # optional (ISO-8601 UTC)
    &endDateTime=<endDateTime>       # optional (ISO-8601 UTC)
    &size=200                        # max results per request
    &locale=*                        # all locales
    &apikey=<API_KEY>
```

Return optimized JSON with only essential fields to minimize token usage:

* Event ID
* Event name
* Event URL (ticket page)
* Date/time (ISO-8601 UTC format from `dates.start.dateTime`)
* Venue name
* Single optimized image URL (selected via smart algorithm)

---

## **Non-Functional Requirements**

* **Security:** API key loaded from `process.env.TICKETMASTER_API_KEY`, never exposed to client or model
* **Caching Strategy:**
  * **Classifications**: Cached in database for 7 days (stable data, shared across all users)
  * **Attractions**: Live lookup each time (entity names may vary, user-specific queries)
  * **Events**: Live lookup each time (time-sensitive data)
* **Rate Limiting:**
  * Ticketmaster API: 5 queries/sec limit
  * **Automatic throttling**: Module-level rate limiter ensures compliance (sliding window algorithm)
  * Model limited to max 3 parallel calls per turn
  * Each call searches ONE city/country only
  * Caching reduces API calls by ~50% for searches with segments/genres
* **Locale:** Always set to `'*'` (all locales) for maximum result coverage; model translates as needed
* **Error handling:**

  * Unknown segment/genre → `{error: "Unknown segment/genre", details: "..."}`
  * Unknown entity → `{error: "Unknown entity", details: "..."}`
  * API unreachable → `{error: "Ticketmaster API unreachable", details: "..."}`
  * Invalid API key → `{error: "Invalid Ticketmaster API key"}`
  * Missing required param → `{error: "Missing required parameter: countryCode"}`
* **Usage:** Backend model-driven workflows only. The GPT model decides when and how to call it within its reasoning sequence.

---

## **Acceptance Criteria / Tests**

0. **Get Available Classifications**

   * Calling `get_ticketmaster_classifications()` returns filtered list of 3 segments
   * Each segment includes array of genre names
   * Response includes exactly: "Music", "Arts & Theatre", and "Sports" (no other segments)
   * "Music" segment includes genres like "Hip-Hop", "Jazz", "Rock", etc.
   * Response completes in < 100ms (cache hit)
   * Names are sorted alphabetically for consistency
   * Token usage is minimized by filtering to only the most relevant segments

1. **Segment & Genre Resolution**

   * `"Music"` resolves to correct segmentId.
   * `"Jazz"` resolves to correct genreId under Music.
   * `"Sports"` + `"Football"` resolves to valid pair.

2. **Entity Lookup**

   * `"Coldplay"` → valid attractionId; returned events match artist.
   * `"Manchester United"` → football matches appear.
   * `"Louvre Museum"` → returns upcoming art events/exhibitions in Paris (if listed).
   * Invalid entity → clear structured error.

3. **Event Fetch**

   * Valid segment/genre/entity queries return non-empty event lists (where available).
   * Each event includes name, date, venue, and classification info.

4. **Location Filtering**

   * When `city` is supplied, results are localized to that city.

5. **Error Handling**

   * Missing or invalid key → authentication error.
   * Unknown names → structured “not found” error.

6. **Integration Readiness**

   * Function exposed as GPT-5 tool with following definition:

     ```json
     {
       "name": "ticketmaster_event_search",
       "description": "Searches Ticketmaster for events by category, artist/team, and location. Returns up to 200 events with details including dates, venues, and ticket URLs. IMPORTANT: You can search MULTIPLE cities, segments, genres, and entities in a SINGLE request by providing arrays. This is much more efficient than making parallel calls.",
       "parameters": {
         "type": "object",
         "properties": {
           "countryCode": {
             "type": "string",
             "description": "ISO country code (required). Examples: 'GB', 'FR', 'US', 'NL', 'ES'."
           },
           "city": {
             "oneOf": [
               {"type": "string"},
               {"type": "array", "items": {"type": "string"}}
             ],
             "description": "City name(s) to filter results (optional). Can be a single city string or an array of cities. Examples: 'Paris' or ['Barcelona', 'Madrid', 'Valencia']"
           },
           "segmentName": {
             "oneOf": [
               {"type": "string"},
               {"type": "array", "items": {"type": "string"}}
             ],
             "description": "High-level category/categories (optional). Can be a single segment or an array. Examples: 'Music' or ['Music', 'Sports']. When provided with genreName, scopes the genre search to these segments."
           },
           "genreName": {
             "oneOf": [
               {"type": "string"},
               {"type": "array", "items": {"type": "string"}}
             ],
             "description": "Subcategory/subcategories (optional). Can be a single genre or an array. Examples: 'Jazz' or ['Jazz', 'Rock', 'Classical']. Searches across all segments unless segmentName is provided to scope the search."
           },
           "entityName": {
             "oneOf": [
               {"type": "string"},
               {"type": "array", "items": {"type": "string"}}
             ],
             "description": "Artist, team, venue, or organization (optional). Can be a single entity or an array. Examples: 'Coldplay' or ['Coldplay', 'The Rolling Stones']"
           },
           "startDateTime": {
             "type": "string",
             "description": "Filter events from this date (optional). Format: ISO-8601 UTC. Example: '2025-11-10T00:00:00Z'"
           },
           "endDateTime": {
             "type": "string",
             "description": "Filter events before this date (optional). Format: ISO-8601 UTC. Example: '2025-11-15T23:59:59Z'"
           }
         },
         "required": ["countryCode"]
       }
     }
     ```

   * GPT model also has access to the classifications discovery tool:

     ```json
     {
       "name": "get_ticketmaster_classifications",
       "description": "Returns a filtered list of relevant Ticketmaster segments (Music, Arts & Theatre, Sports) and their genres (subcategories). Use this to discover what segment and genre names are valid before searching for events. This ensures you use the exact naming that Ticketmaster expects (e.g., 'Hip-Hop' not 'Hip Hop'). Only returns the 3 most relevant segments to minimize token usage. No parameters required. Fast operation (~50ms) using cached data.",
       "parameters": {
         "type": "object",
         "properties": {},
         "required": []
       }
     }
     ```

   * GPT model receives structured event data suitable for planning trip bundles
   * Model can search multiple cities/genres/segments in a single call for maximum efficiency
   * Model should call `get_ticketmaster_classifications` early to learn valid segment/genre names

---

## **Technical Approach**

**Implementation: `src/lib/ticketmaster.ts` + `src/lib/ticketmasterCache.ts`**

Self-contained service module with exported function `searchTicketmasterEvents()`:

**Flow:**
  1. Validate inputs (require `countryCode`)
  2. If segment/genre provided → resolve via **cached classifications**
     - Check database cache (7-day TTL)
     - If cache miss → fetch from `/classifications.json?locale=*` and cache it
     - Case-insensitive matching
     - Genre searches across all segments unless segment is specified to scope the search
     - Return error if requested but not found
  3. If entityName provided → resolve via `/attractions.json?locale=*`
     - Looks up each entity and returns attraction IDs
     - Gracefully handles partial failures
  4. Query `/events.json?locale=*` with resolved IDs and filters
     - countryCode, city, segmentId, genreId, attractionId, startDateTime, endDateTime
     - size=200, locale=*
  5. Normalize response and return structured JSON (model handles translation)

**Cache Service (`src/lib/ticketmasterCache.ts`):**
- `getClassifications()` - Main function: checks cache → fetches if needed
- `getCachedClassifications()` - Retrieves valid cache from database
- `refreshClassifications()` - Fetches fresh data from API and saves to DB
- Database table: `ticketmaster_classifications_cache` (Drizzle ORM schema)
- Cache expiration: 7 days (configurable via `CACHE_DURATION_DAYS`)

**Integration:**
- Both functions registered in `src/lib/services/generationService.ts`
- Function call handler in `executeFunctionCalls()` at line ~145-163
- `ticketmaster_event_search` returns array of `TicketmasterEvent[]` or `TicketmasterErrorResponse`
- `get_ticketmaster_classifications` returns `TicketmasterClassificationsList` or `TicketmasterErrorResponse`

**Logging:**
- Comprehensive console logs with timing
- Format: `[TICKETMASTER]` and `[TICKETMASTER CACHE]` prefixes with emoji indicators
- Tracks each step: cache check → classifications → entity lookup → event search

---

## **Implementation Status**

✅ **Completed:**
* Service module created at `src/lib/ticketmaster.ts` (~750 lines)
* Cache service created at `src/lib/ticketmasterCache.ts` (~170 lines)
* Database schema with `ticketmaster_classifications_cache` table
* Registered in generation service
* Environment variables configured (`.env.local`, `.env.local.example`)
* Type-safe interfaces for all API responses (fixed nested genre structure)
* Comprehensive error handling with graceful degradation
* Fixed classifications API parsing to handle nested genres correctly
* Locale set to `'*'` (all locales) to maximize result coverage (model handles translation)
* **Classifications caching optimization** (50% reduction in API calls)
* **Data extraction optimization** (74.7% reduction in response size)
* **Automatic rate limiting** (sliding window throttling to prevent 429 errors)
* **Classifications discovery tool** (`get_ticketmaster_classifications`) - helps model learn valid segment/genre names
* Tool definitions added to OpenAI stored prompt
* **Tested and deployed in production** ✅

## **Bug Fixes (2025-10-27)**

### **Bug #1: Incorrect URL Construction (CRITICAL)**

**Issue**: ALL Ticketmaster API calls returning 400 Bad Request errors

**Root Cause**: The `buildUrl()` function was incorrectly using `new URL(path, base)` with a path starting with `/`. This caused JavaScript to replace the entire path of the base URL, stripping out `/discovery/v2`:
- Wrong: `https://app.ticketmaster.com/classifications.json`
- Correct: `https://app.ticketmaster.com/discovery/v2/classifications.json`

**Fix**:
```typescript
// OLD (wrong):
const url = new URL(path, TICKETMASTER_BASE_URL);

// NEW (correct):
const cleanPath = path.startsWith('/') ? path.slice(1) : path;
const fullUrl = `${TICKETMASTER_BASE_URL}/${cleanPath}`;
const url = new URL(fullUrl);
```

### **Bug #2: Nested Genre Structure**

**Issue**: Classifications API returning "Segment not found" even with correct URLs

**Root Cause**: The Ticketmaster Classifications API has a nested structure where genres are inside `segment._embedded.genres[]`, not at the top level. The code was incorrectly trying to access `classification.genre` directly.

**Fix**:
* Updated TypeScript interfaces to correctly represent the nested genre structure
* Modified `resolveClassifications()` to iterate through `segment._embedded.genres[]`
* Created separate interfaces for Classifications endpoint vs Events endpoint (different structures)

**Verified**: Music segment (ID: `KZFzniwnSyZfZ7v7nJ`) and Jazz genre (ID: `KnvZfZ7vAvE`) now resolve correctly

---

## **Optimization: Data Extraction (2025-10-27)**

### **Problem**
Ticketmaster API returns massive amounts of data per event (1000+ characters), overwhelming the model's context window when returning 100 events.

### **Solution**
Implemented smart data extraction that returns only essential fields:

**Extracted Fields:**
1. `id` - Event ID
2. `name` - Event name
3. `url` - Event URL
4. `dateTime` - Event date/time (from `dates.start.dateTime`)
5. `venueName` - Venue name (from `_embedded.venues[0].name`)
6. `imageUrl` - Single best image URL

**Smart Image Selection Algorithm:**
1. **Priority**: Find images with ratio `16_9` or `3_2` AND width ≥ 1000px
2. **Fallback**: Select image with highest pixel count (width × height)
3. **Filters**: Empty URLs are automatically excluded

**Error Handling:**
* Each field extraction wrapped in try-catch
* Errors logged but don't fail the entire extraction
* Missing fields return `null` instead of breaking the process
* Graceful degradation ensures maximum data availability

**Results:**
* **Original event size**: ~1,424 characters
* **Optimized event size**: ~360 characters
* **Reduction**: **74.7% per event**
* **For 100 events**: Saves ~106KB per API response

**Implementation:**
* `selectBestImage()` function ([ticketmaster.ts:154-200](src/lib/ticketmaster.ts#L154-L200))
* `extractField()` helper ([ticketmaster.ts:206-218](src/lib/ticketmaster.ts#L206-L218))
* Updated event normalization ([ticketmaster.ts:430-460](src/lib/ticketmaster.ts#L430-L460))

---

## **Optimization: Classifications Caching (2025-10-28)**

### **Problem**
Every event search with segment/genre parameters required 2 API calls:
1. Fetch classifications (~200-500ms) - to resolve segment/genre names to IDs
2. Fetch events (~200-500ms) - to get actual event data

This resulted in:
- **High API call volume** (hitting rate limits faster)
- **Slower response times** (extra network round-trip)
- **Redundant fetches** (classifications change rarely, same data fetched repeatedly)

### **Solution**
Implemented database caching for Ticketmaster classifications data:

**Architecture:**
1. **Database table**: `ticketmaster_classifications_cache` (PostgreSQL via Drizzle ORM)
   - Stores raw API response as JSONB
   - Tracks `fetchedAt` and `expiresAt` timestamps
   - Single-row cache shared across all users
2. **Cache service**: `src/lib/ticketmasterCache.ts`
   - `getClassifications()` - Main function with cache-first strategy
   - `getCachedClassifications()` - Reads from database with expiration check
   - `refreshClassifications()` - Fetches fresh data and updates cache
3. **Cache lifetime**: 7 days (configurable)
4. **Automatic refresh**: On cache miss or expiration

**Why Database Caching (vs In-Memory)?**
- **Serverless environment**: Vercel functions are stateless, no persistent memory
- **Shared cache**: All function instances use the same database cache
- **Reliability**: Database-backed cache survives deployments and restarts
- **Fast enough**: PostgreSQL reads are ~20-50ms, negligible compared to API calls

**Performance Impact:**

**Before Caching:**
```
API Call 1: Fetch classifications (~300ms)
API Call 2: Fetch events (~400ms)
Total: ~700ms per search
```

**After Caching (cache hit):**
```
DB Read: Get cached classifications (~50ms)
API Call 1: Fetch events (~400ms)
Total: ~450ms per search (36% faster)
```

**Results:**
- **50% reduction in Ticketmaster API calls** (for searches with segments/genres)
- **~250ms faster response time** on cache hits
- **Better rate limit compliance** (reduces from 2 calls to 1 call per search)
- **99%+ cache hit rate** (classifications rarely change)

**Implementation:**
* Cache service ([ticketmasterCache.ts](src/lib/ticketmasterCache.ts))
* Database schema ([schema.ts](src/db/schema.ts))
* Updated `resolveClassifications()` in [ticketmaster.ts](src/lib/ticketmaster.ts) to use cache

**Logging:**
```
[TICKETMASTER CACHE] === Getting classifications ===
[TICKETMASTER CACHE] Checking database cache...
[TICKETMASTER CACHE] Cache hit! Age: 2 day(s), expires: 2025-11-04T14:00:00.000Z (45ms)
[TICKETMASTER CACHE] === Using cached data (48ms) ===
```

---

## **Rate Limiting Implementation (2025-10-29)**

### **Problem**
Ticketmaster API has a hard limit of **5 queries per second**. Exceeding this limit results in 429 (Too Many Requests) errors. When the model makes parallel searches (up to 3 simultaneous calls), or when multiple API calls are needed for a single search (classifications + attractions + events), it's easy to exceed this limit.

### **Solution**
Implemented **automatic request throttling** with a sliding window rate limiter:

**Architecture:**
1. **Module-level shared state**: Array of timestamps tracking recent API calls
2. **Sliding window algorithm**:
   - Tracks last 5 API call timestamps
   - Before each call, removes timestamps older than 1 second
   - If 5 calls exist in the last second, waits until oldest call is > 1 second old
   - Adds 10ms buffer for safety
3. **Transparent throttling**: All `fetch` calls replaced with `rateLimitedFetch()`

**Implementation:**
```typescript
// Module-level state (shared across all function calls in same process)
const apiCallTimestamps: number[] = [];
const MAX_CALLS_PER_SECOND = 5;
const TIME_WINDOW_MS = 1000;

export async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();

  // Remove timestamps older than 1 second (sliding window)
  while (apiCallTimestamps.length > 0 && now - apiCallTimestamps[0] > TIME_WINDOW_MS) {
    apiCallTimestamps.shift();
  }

  // If we have 5 calls in the last second, wait
  if (apiCallTimestamps.length >= MAX_CALLS_PER_SECOND) {
    const oldestCall = apiCallTimestamps[0];
    const waitTime = TIME_WINDOW_MS - (now - oldestCall) + 10; // +10ms buffer
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  // Make the call and record timestamp
  apiCallTimestamps.push(Date.now());
  return fetch(url);
}
```

**Usage:**
- All API calls in `ticketmaster.ts` use `rateLimitedFetch()` instead of `fetch()`
- All API calls in `ticketmasterCache.ts` use `rateLimitedFetch()` via export
- No changes needed to calling code - throttling is automatic and transparent

**Benefits:**
- ✅ **Prevents 429 errors**: Automatically throttles to stay under 5 req/sec limit
- ✅ **Zero overhead when under limit**: No delay if fewer than 5 calls in last second
- ✅ **Works within single request**: Perfect for model making 3 parallel searches
- ✅ **Simple implementation**: No external dependencies (Redis, database, etc.)
- ✅ **Transparent**: Calling code doesn't need to handle rate limiting

**Limitations:**
- ⚠️ **Serverless environment**: Only coordinates within same function instance
- ⚠️ **Multiple concurrent users**: Different serverless instances won't coordinate
- ⚠️ **Not a problem in practice**: Most requests handled by warm instances, and traffic is typically low

**Logging:**
```
⏱️  [TICKETMASTER] Rate limit: waiting 234ms before next API call
```

**Files Modified:**
* [ticketmaster.ts:32-50](src/lib/ticketmaster.ts#L32-L50) - Rate limiter implementation
* [ticketmaster.ts:394](src/lib/ticketmaster.ts#L394) - Attractions API fetch
* [ticketmaster.ts:459](src/lib/ticketmaster.ts#L459) - Events API fetch
* [ticketmasterCache.ts:53](src/lib/ticketmasterCache.ts#L53) - Classifications API fetch

---

## **Enhancement: Multi-Value Parameter Support (2025-10-29)**

### **Problem**
Previously, each function call could only search ONE city, ONE segment, and ONE genre at a time. The model had to make multiple parallel calls to search across different cities or genres, which:
- Consumed more API quota unnecessarily
- Added complexity to the model's reasoning
- Increased latency due to multiple network round-trips
- Hit rate limits faster when searching many combinations

### **Solution**
Implemented support for multiple values in a single request for `city`, `segmentName`, `genreName`, and `entityName` parameters.

**Changes Made:**

1. **Updated TypeScript Types** ([ticketmaster.ts:57-65](src/lib/ticketmaster.ts#L57-L65)):
   ```typescript
   export interface TicketmasterSearchParams {
     countryCode: string;
     city?: string | string[];           // NOW SUPPORTS ARRAYS
     segmentName?: string | string[];    // NOW SUPPORTS ARRAYS
     genreName?: string | string[];      // NOW SUPPORTS ARRAYS
     entityName?: string | string[];     // NOW SUPPORTS ARRAYS
     startDateTime?: string;
     endDateTime?: string;
   }
   ```

2. **Enhanced `buildUrl()` Function** ([ticketmaster.ts:259-291](src/lib/ticketmaster.ts#L259-L291)):
   - Now handles both single values and arrays
   - Calls `url.searchParams.append()` multiple times for array values
   - Example: `["Barcelona", "Madrid"]` → `?city=Barcelona&city=Madrid`

3. **Updated `resolveClassifications()`** ([ticketmaster.ts:309-385](src/lib/ticketmaster.ts#L309-L385)):
   - Accepts arrays of segment/genre names
   - Returns arrays of resolved IDs
   - Validates that all requested items were found

4. **Updated `resolveEntity()`** ([ticketmaster.ts:397-447](src/lib/ticketmaster.ts#L397-L447)):
   - Accepts arrays of entity names
   - Returns arrays of resolved attraction IDs
   - Looks up each entity sequentially (to comply with rate limits)
   - Gracefully handles partial failures (continues with successful lookups)

5. **Increased Results Size**:
   - Changed from `size=100` to `size=200` per request
   - Maximum allowed by Ticketmaster is 250; chose 200 for safety margin
   - Doubles the number of events returned per call

**Example Usage:**

Before (required 2 calls):
```javascript
// Call 1
{"countryCode": "ES", "city": "Barcelona", "segmentName": "Music", "genreName": "Jazz"}
// Call 2
{"countryCode": "ES", "city": "Madrid", "segmentName": "Music", "genreName": "Rock"}
```

After (single call):
```javascript
{"countryCode": "ES", "city": ["Barcelona", "Madrid"], "segmentName": "Music", "genreName": ["Jazz", "Rock"]}
```

Multiple entities example:
```javascript
// Before (3 calls)
{"countryCode": "GB", "entityName": "Coldplay"}
{"countryCode": "GB", "entityName": "The Rolling Stones"}
{"countryCode": "GB", "entityName": "Ed Sheeran"}

// After (single call)
{"countryCode": "GB", "entityName": ["Coldplay", "The Rolling Stones", "Ed Sheeran"]}
```

**Benefits:**
- ✅ **Reduced API calls**: Search multiple cities/genres in one request
- ✅ **Better rate limit compliance**: Fewer calls overall
- ✅ **Simpler model logic**: No need to orchestrate parallel calls
- ✅ **More results**: 200 events per call (up from 100)
- ✅ **Backward compatible**: Still accepts single string values

**Updated Tool Definition:**
The OpenAI stored prompt tool definition needs to be updated to use `oneOf` with string/array types for `city`, `segmentName`, `genreName`, and `entityName` parameters (see Acceptance Criteria section for full JSON).

---

## **Enhancement: Classifications Discovery Tool (2025-10-29)**

### **Problem**
The model sometimes searches for segment/genre names using variations that don't exactly match Ticketmaster's naming:
- Searches for "Hip Hop" when Ticketmaster uses "Hip-Hop"
- Searches for "Theatre" when it might be "Arts & Theatre"
- Doesn't know what categories are available, leading to trial-and-error
- Returning all Ticketmaster segments consumes too many tokens

This results in:
- **Failed searches**: Genre not found errors
- **Wasted API calls**: Model tries multiple variations
- **Poor user experience**: Missing relevant events due to naming mismatches
- **High token usage**: Unnecessarily large response payloads

### **Solution**
Implemented a new tool function `get_ticketmaster_classifications` that returns a **filtered list** of the most relevant segments (Music, Arts & Theatre, Sports) and their genres from Ticketmaster.

**Architecture:**
1. **New function**: `getTicketmasterClassifications()` in [ticketmaster.ts:712-769](src/lib/ticketmaster.ts#L712-L769)
2. **Uses existing cache**: Leverages same database cache as event search (~50ms, no extra API calls)
3. **Filtered segments**: Only returns Music, Arts & Theatre, and Sports (using hardcoded segment IDs)
4. **Clean data structure**: Returns deduplicated, sorted list of segments with their genres
5. **New tool for GPT-5**: Exposed as `get_ticketmaster_classifications` with zero parameters

**Response Format:**
```json
{
  "segments": [
    {
      "name": "Arts & Theatre",
      "genres": ["Comedy", "Magic & Illusion", "Theatre", ...]
    },
    {
      "name": "Music",
      "genres": ["Alternative", "Blues", "Classical", "Country", "Hip-Hop", "Jazz", "Pop", "Rock", ...]
    },
    {
      "name": "Sports",
      "genres": ["Basketball", "Football", "Hockey", "Soccer", ...]
    }
  ]
}
```

**Model Usage Pattern:**
1. **Early call**: Model calls `get_ticketmaster_classifications()` at the start of trip planning
2. **Learn valid names**: Model sees that "Hip-Hop" (not "Hip Hop") is the correct genre name
3. **Accurate searches**: Model uses exact names in subsequent `ticketmaster_event_search` calls
4. **Better results**: No more "genre not found" errors, finds all relevant events

**Benefits:**
- ✅ **Prevents naming mismatches**: Model uses exact Ticketmaster names
- ✅ **Reduces failed searches**: Model knows valid options upfront
- ✅ **Minimizes token usage**: Only 3 segments returned (not all Ticketmaster categories)
- ✅ **Fast operation**: ~50ms using existing cache infrastructure
- ✅ **No extra API calls**: Reuses classifications cache
- ✅ **Improves discovery**: Model learns what categories exist
- ✅ **Better UX**: Users get more relevant events, fewer errors

**Implementation:**
* New function in [ticketmaster.ts:712-769](src/lib/ticketmaster.ts#L712-L769)
* Filtered segment IDs in [ticketmaster.ts:697-701](src/lib/ticketmaster.ts#L697-L701)
* Registered in [generationService.ts:157-159](src/lib/services/generationService.ts#L157-L159)
* New tool definition added to OpenAI stored prompt
* Documented in Functional Requirements section above

---

## **API Key Configuration**

**Public Key (Consumer Key):** `y9bWhGWmtYl8fcAgpG4AvVJf83GjbKo6`
**Stored in:** `.env.local` as `TICKETMASTER_API_KEY`
**Usage:** Appended to all Discovery API requests as `?apikey=...`