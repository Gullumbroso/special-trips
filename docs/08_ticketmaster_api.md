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
- Each function call searches **ONE city/country only**
- Model can make **UP TO 3 PARALLEL CALLS** to search multiple cities simultaneously
- Locale is automatically set to `'en'` for all queries (English results)

---

## **Functional Requirements**

### 1. Inputs

The function accepts:

| Parameter       | Type              | Description                                                                                             | Notes                                     |
| --------------- | ----------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `countryCode`   | string            | ISO country code (e.g., `"GB"`, `"FR"`, `"NL"`)                                                         | **Required**                              |
| `city`          | string (optional) | Filter results by city or nearby area                                                                   | One city per call                         |
| `segmentName`   | string (optional) | High-level category, e.g. `"Music"`, `"Sports"`, `"Arts & Theatre"`                                     | **Required when `genreName` is provided** |
| `genreName`     | string (optional) | Subcategory, e.g. `"Jazz"`, `"Football"`, `"Classical"`                                                 | Must be used with `segmentName`           |
| `entityName`    | string (optional) | Artist, team, venue, or organization name (e.g. `"Coldplay"`, `"Manchester United"`, `"Louvre Museum"`) |                                           |
| `startDateTime` | string (optional) | ISO-8601 UTC                                                                                            |                                           |
| `endDateTime`   | string (optional) | ISO-8601 UTC                                                                                            |                                           |

**Handled Automatically:**
- `locale`: Always set to `'en'` (English results)
- `apikey`: Loaded from `process.env.TICKETMASTER_API_KEY` (never exposed to model or client)

**Example calls:**

* `{"countryCode": "FR", "city": "Paris", "segmentName": "Music", "genreName": "Jazz", "startDateTime": "2025-11-10T00:00:00Z", "endDateTime": "2025-11-15T23:59:59Z"}`
* `{"countryCode": "ES", "entityName": "FC Barcelona"}`
* `{"countryCode": "FR", "city": "Paris", "segmentName": "Arts & Theatre"}`

 
---

### 2. Classification Mapping (per call)

For every request with `segmentName` or `genreName`:

1. Fetch fresh classification data from
   `GET https://app.ticketmaster.com/discovery/v2/classifications.json?apikey=API_KEY&locale=en`
2. Match by case-insensitive comparison:

   * `segment.name` → `segmentName`
   * `genre.name` → `genreName` (scoped by segment if both provided)
3. Extract `segmentId` and/or `genreId`.
4. **Important:** If `genreName` is provided without `segmentName`, return error (segmentName is required)
5. If segment/genre not found, return structured error (unless only `entityName` is supplied)

---

### 3. Entity Lookup

If `entityName` is provided:

1. Query Ticketmaster's **Attraction Search** endpoint:

   ```
   GET https://app.ticketmaster.com/discovery/v2/attractions.json
       ?keyword=<entityName>
       &locale=en
       &size=10
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
    &city=<city>                     # optional
    &segmentId=<SEGMENT_ID>          # optional
    &genreId=<GENRE_ID>              # optional
    &attractionId=<ATTRACTION_ID>    # optional
    &startDateTime=<startDateTime>   # optional (ISO-8601 UTC)
    &endDateTime=<endDateTime>       # optional (ISO-8601 UTC)
    &locale=en                       # always set
    &size=100                        # max results
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
* **No caching:** Perform live lookups for classifications and attractions each time (as per requirements)
* **Rate Limiting:**
  * Ticketmaster API: 5 queries/sec limit
  * Model limited to max 3 parallel calls per turn
  * Each call searches ONE city/country only
* **Locale:** Always set to `'en'` for consistent English results
* **Error handling:**

  * Unknown segment/genre → `{error: "Unknown segment/genre", details: "..."}`
  * Unknown entity → `{error: "Unknown entity", details: "..."}`
  * API unreachable → `{error: "Ticketmaster API unreachable", details: "..."}`
  * Invalid API key → `{error: "Invalid Ticketmaster API key"}`
  * Missing required param → `{error: "Missing required parameter: countryCode"}`
* **Usage:** Backend model-driven workflows only. The GPT model decides when and how to call it within its reasoning sequence.

---

## **Acceptance Criteria / Tests**

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
       "description": "Searches Ticketmaster for events by category, artist/team, and location. Returns event details including dates, venues, and ticket URLs. IMPORTANT: Each call searches ONE city/country only. You can make UP TO 3 PARALLEL CALLS to search multiple cities simultaneously (rate limit: 5 queries/sec). Always provide segmentName when using genreName.",
       "parameters": {
         "type": "object",
         "properties": {
           "countryCode": {
             "type": "string",
             "description": "ISO country code (required). Examples: 'GB', 'FR', 'US', 'NL', 'ES'. Each call searches only ONE country."
           },
           "city": {
             "type": "string",
             "description": "City name to filter results (optional). Example: 'Paris', 'London', 'Barcelona'. Each call searches only ONE city."
           },
           "segmentName": {
             "type": "string",
             "description": "High-level category (optional). Examples: 'Music', 'Sports', 'Arts & Theatre'. Required when genreName is used."
           },
           "genreName": {
             "type": "string",
             "description": "Subcategory within segment (optional). Examples: 'Jazz', 'Rock', 'Football', 'Classical'. Must be used with segmentName."
           },
           "entityName": {
             "type": "string",
             "description": "Artist, team, venue, or organization (optional). Examples: 'Coldplay', 'Manchester United', 'FC Barcelona'"
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
   * GPT model receives structured event data suitable for planning trip bundles
   * Model can make up to 3 parallel calls to search multiple cities efficiently

---

## **Technical Approach**

**Implementation: `src/lib/ticketmaster.ts`**

Self-contained service module with exported function `searchTicketmasterEvents()`:

**Flow:**
  1. Validate inputs (require `countryCode`, validate `genreName` requires `segmentName`)
  2. If segment/genre provided → resolve via `/classifications.json?locale=en`
     - Case-insensitive matching
     - Genre scoped by segment if both provided
     - Return error if requested but not found
  3. If entityName provided → resolve via `/attractions.json?locale=en`
     - Take first result (highest relevance)
     - Return error if not found
  4. Query `/events.json?locale=en` with resolved IDs and filters
     - countryCode, city, segmentId, genreId, attractionId, startDateTime, endDateTime
     - size=100, locale=en
  5. Normalize response and return structured JSON

**Integration:**
- Registered in `src/lib/services/generationService.ts`
- Function call handler in `executeFunctionCalls()` at line ~158
- Returns array of `TicketmasterEvent[]` or `TicketmasterErrorResponse`

**Logging:**
- Comprehensive console logs with timing
- Format: `[TICKETMASTER]` prefix with emoji indicators
- Tracks each step: classifications → entity lookup → event search

---

## **Implementation Status**

✅ **Completed:**
* Service module created at `src/lib/ticketmaster.ts` (~600 lines)
* Registered in generation service
* Environment variables configured (`.env.local`, `.env.local.example`)
* Type-safe interfaces for all API responses (fixed nested genre structure)
* Comprehensive error handling with graceful degradation
* Automatic locale='en' for all requests
* Fixed classifications API parsing to handle nested genres correctly
* **Data extraction optimization** (74.7% reduction in response size)
* Tool definition added to OpenAI stored prompt
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

## **API Key Configuration**

**Public Key (Consumer Key):** `y9bWhGWmtYl8fcAgpG4AvVJf83GjbKo6`
**Stored in:** `.env.local` as `TICKETMASTER_API_KEY`
**Usage:** Appended to all Discovery API requests as `?apikey=...`