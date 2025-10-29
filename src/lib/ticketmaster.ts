/**
 * Ticketmaster Discovery API integration for event search
 *
 * This service searches for events by:
 * - Segment/Genre (e.g., Music > Jazz, Sports > Football)
 * - Entity (e.g., artist, sports team, venue)
 * - Location (country, city)
 * - Date range
 */

import { getClassifications } from './ticketmasterCache';

const TICKETMASTER_API_KEY = process.env.TICKETMASTER_API_KEY;
const TICKETMASTER_BASE_URL = "https://app.ticketmaster.com/discovery/v2";

// ============================================================================
// Rate Limiting
// ============================================================================

/**
 * Module-level rate limiter for Ticketmaster API (5 requests per second limit)
 * Tracks timestamps of recent API calls and throttles when necessary
 */
const apiCallTimestamps: number[] = [];
const MAX_CALLS_PER_SECOND = 5;
const TIME_WINDOW_MS = 1000;

/**
 * Rate-limited fetch wrapper for Ticketmaster API
 * Ensures no more than 5 calls per second (sliding window)
 */
export async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();

  // Remove timestamps older than 1 second
  while (apiCallTimestamps.length > 0 && now - apiCallTimestamps[0] > TIME_WINDOW_MS) {
    apiCallTimestamps.shift();
  }

  // If we have 5 calls in the last second, wait
  if (apiCallTimestamps.length >= MAX_CALLS_PER_SECOND) {
    const oldestCall = apiCallTimestamps[0];
    const waitTime = TIME_WINDOW_MS - (now - oldestCall) + 10; // +10ms buffer
    console.log(`⏱️  [TICKETMASTER] Rate limit: waiting ${waitTime}ms before next API call`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  // Make the call and record timestamp
  apiCallTimestamps.push(Date.now());
  return fetch(url);
}

// ============================================================================
// Type Definitions
// ============================================================================

export interface TicketmasterSearchParams {
  countryCode: string;
  city?: string | string[];
  segmentName?: string | string[];
  genreName?: string | string[];
  entityName?: string | string[];
  startDateTime?: string;
  endDateTime?: string;
}

export interface TicketmasterEvent {
  id: string | null;
  name: string | null;
  url: string | null;
  dateTime: string | null;
  venueName: string | null;
  imageUrl: string | null;
}

export interface TicketmasterErrorResponse {
  error: string;
  details?: string;
}

export interface TicketmasterSegment {
  name: string;
  genres: string[];
}

export interface TicketmasterClassificationsList {
  segments: TicketmasterSegment[];
}

// Internal API response types

// For /classifications endpoint - genres are nested inside segment
interface ClassificationGenre {
  id: string;
  name: string;
}

interface ClassificationSegment {
  id: string;
  name: string;
  _embedded?: {
    genres?: ClassificationGenre[];
  };
}

interface Classification {
  segment?: ClassificationSegment;
}

interface ClassificationsResponse {
  _embedded?: {
    classifications?: Classification[];
  };
}

// For /events endpoint - segment and genre are at the same level
interface EventClassificationItem {
  id: string;
  name: string;
}

interface EventClassification {
  segment?: EventClassificationItem;
  genre?: EventClassificationItem;
  subGenre?: EventClassificationItem;
}

interface Attraction {
  id: string;
  name: string;
  classifications?: EventClassification[];
}

interface AttractionsResponse {
  _embedded?: {
    attractions?: Attraction[];
  };
}

interface EventsResponse {
  _embedded?: {
    events?: Array<{
      id: string;
      name: string;
      url: string;
      dates?: {
        start?: {
          localDate?: string;
          localTime?: string;
          dateTime?: string;
        };
        timezone?: string;
      };
      classifications?: EventClassification[];
      images?: Array<{
        url: string;
        ratio?: string;
        width?: number;
        height?: number;
      }>;
      priceRanges?: Array<{
        min?: number;
        max?: number;
        currency?: string;
      }>;
      _embedded?: {
        venues?: Array<{
          name?: string;
          city?: {
            name?: string;
          };
          country?: {
            name?: string;
            countryCode?: string;
          };
        }>;
        attractions?: Array<{
          id: string;
          name: string;
        }>;
      };
    }>;
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms.toFixed(0)}ms`;
  }
  const seconds = ms / 1000;
  return `${seconds.toFixed(2)}s`;
}

/**
 * Selects the best image from an array of images
 * Priority: 16_9 or 3_2 ratio with width >= 1000, otherwise largest by total pixels
 */
function selectBestImage(images?: Array<{
  url?: string;
  ratio?: string;
  width?: number;
  height?: number;
}>): string | null {
  try {
    if (!images || images.length === 0) {
      return null;
    }

    // Filter out images with empty URLs
    const validImages = images.filter(img => img.url && img.url.trim() !== '');

    if (validImages.length === 0) {
      return null;
    }

    // Try to find 16_9 or 3_2 with width >= 1000
    const preferredImage = validImages.find(img =>
      (img.ratio === '16_9' || img.ratio === '3_2') &&
      img.width &&
      img.width >= 1000
    );

    if (preferredImage?.url) {
      return preferredImage.url;
    }

    // Fallback: find image with highest pixel count
    let bestImage = validImages[0];
    let maxPixels = (bestImage.width || 0) * (bestImage.height || 0);

    for (const img of validImages) {
      const pixels = (img.width || 0) * (img.height || 0);
      if (pixels > maxPixels) {
        maxPixels = pixels;
        bestImage = img;
      }
    }

    return bestImage.url || null;
  } catch (error) {
    console.error('[TICKETMASTER] Error selecting best image:', error);
    return null;
  }
}

/**
 * Safely extracts a field with error handling
 * Returns null and logs error if extraction fails
 */
function extractField<T>(
  extractor: () => T | undefined | null,
  fieldName: string,
  eventIdentifier?: string
): T | null {
  try {
    const value = extractor();
    return value !== undefined && value !== null ? value : null;
  } catch (error) {
    console.error(`[TICKETMASTER] Error extracting field "${fieldName}" for event ${eventIdentifier || 'unknown'}:`, error);
    return null;
  }
}

function buildUrl(path: string, params: Record<string, string | string[] | undefined>): string {
  // Remove leading slash from path if present, then append to base URL
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  const fullUrl = `${TICKETMASTER_BASE_URL}/${cleanPath}`;
  const url = new URL(fullUrl);

  // Add API key
  if (TICKETMASTER_API_KEY) {
    url.searchParams.append('apikey', TICKETMASTER_API_KEY);
  } else {
    console.error('[TICKETMASTER] WARNING: API key is missing!');
  }

  // Add other params (supports arrays for multiple values per key)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      if (Array.isArray(value)) {
        // Add each array element as a separate parameter with the same key
        for (const item of value) {
          if (item !== undefined && item !== null && item !== '') {
            url.searchParams.append(key, item);
          }
        }
      } else {
        url.searchParams.append(key, value);
      }
    }
  }

  const finalUrl = url.toString();
  console.log(`[TICKETMASTER] Request URL: ${finalUrl.replace(TICKETMASTER_API_KEY || '', 'API_KEY_HIDDEN')}`);
  return finalUrl;
}

// ============================================================================
// Step 1: Classification Mapping
// ============================================================================

interface ClassificationIds {
  segmentIds: string[];
  genreIds: string[];
}

/**
 * Fetches classifications and maps segment/genre names to IDs
 * Supports single or multiple segments/genres
 * @param segmentName Optional segment name(s) (e.g., "Music", ["Music", "Sports"])
 * @param genreName Optional genre name(s) (e.g., "Jazz", ["Jazz", "Rock"])
 * @returns Object with arrays of segmentIds and genreIds
 */
async function resolveClassifications(
  segmentName?: string | string[],
  genreName?: string | string[]
): Promise<ClassificationIds> {
  const startTime = Date.now();
  const result: ClassificationIds = { segmentIds: [], genreIds: [] };

  if (!segmentName && !genreName) {
    return result;
  }

  try {
    console.log(`🏷️  [TICKETMASTER] Resolving classifications...`);

    // Use cached classifications instead of direct API fetch
    const data: ClassificationsResponse = await getClassifications();
    const classifications = data._embedded?.classifications || [];

    // Normalize to arrays
    const segmentNames = segmentName ? (Array.isArray(segmentName) ? segmentName : [segmentName]) : [];
    const genreNames = genreName ? (Array.isArray(genreName) ? genreName : [genreName]) : [];

    // Find all segment IDs
    for (const name of segmentNames) {
      const nameLower = name.toLowerCase();
      for (const classification of classifications) {
        if (classification.segment?.name?.toLowerCase() === nameLower) {
          result.segmentIds.push(classification.segment.id);
          break;
        }
      }
    }

    // Find all genre IDs
    for (const name of genreNames) {
      const nameLower = name.toLowerCase();
      let found = false;

      for (const classification of classifications) {
        // If segments were specified, only search in those segments
        if (result.segmentIds.length > 0) {
          if (result.segmentIds.includes(classification.segment?.id || '')) {
            const genres = classification.segment?._embedded?.genres || [];
            for (const genre of genres) {
              if (genre.name?.toLowerCase() === nameLower) {
                result.genreIds.push(genre.id);
                found = true;
                break;
              }
            }
            if (found) break;
          }
        } else {
          // No segment constraint, search all genres
          const genres = classification.segment?._embedded?.genres || [];
          for (const genre of genres) {
            if (genre.name?.toLowerCase() === nameLower) {
              result.genreIds.push(genre.id);
              found = true;
              break;
            }
          }
          if (found) break;
        }
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ [TICKETMASTER] Resolved classifications: segmentIds=[${result.segmentIds.join(', ') || 'none'}], genreIds=[${result.genreIds.join(', ') || 'none'}] (${formatDuration(duration)})`);

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[TICKETMASTER] Error resolving classifications (${formatDuration(duration)}):`, error);
    return result;
  }
}

// ============================================================================
// Step 2: Entity Lookup
// ============================================================================

/**
 * Looks up entities (artists, teams, venues) and returns their attraction IDs
 * Supports single or multiple entity names
 * @param entityName The entity name(s) to search for
 * @returns Array of attraction IDs
 */
async function resolveEntity(entityName: string | string[]): Promise<string[]> {
  const startTime = Date.now();
  const result: string[] = [];

  // Normalize to array
  const entityNames = Array.isArray(entityName) ? entityName : [entityName];

  console.log(`🎭 [TICKETMASTER] Looking up ${entityNames.length} entity/entities...`);

  try {
    // Look up each entity
    for (const name of entityNames) {
      const url = buildUrl('/attractions.json', {
        keyword: name,
        size: '10',
        locale: '*',
      });

      const truncatedName = name.length > 40 ? name.substring(0, 37) + '...' : name;

      const response = await rateLimitedFetch(url);

      if (!response.ok) {
        console.error(`[TICKETMASTER] Attractions API error for "${truncatedName}": ${response.status} ${response.statusText}`);
        continue; // Skip this entity but continue with others
      }

      const data: AttractionsResponse = await response.json();
      const attractions = data._embedded?.attractions || [];

      if (attractions.length === 0) {
        console.warn(`[TICKETMASTER] No attractions found for "${truncatedName}"`);
        continue; // Skip this entity but continue with others
      }

      // Select best match (first result is highest relevance)
      const bestMatch = attractions[0];
      console.log(`✅ [TICKETMASTER] Found attraction: "${bestMatch.name}" (ID: ${bestMatch.id})`);
      result.push(bestMatch.id);
    }

    const duration = Date.now() - startTime;
    console.log(`✅ [TICKETMASTER] Resolved ${result.length} of ${entityNames.length} entities (${formatDuration(duration)})`);

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[TICKETMASTER] Error looking up entities (${formatDuration(duration)}):`, error);
    return result;
  }
}

// ============================================================================
// Step 3: Event Search
// ============================================================================

/**
 * Searches for events with the provided filters
 * Supports multiple cities, segments, genres, and attractions
 * @param params Search parameters including IDs resolved from previous steps
 * @returns Array of events or error response
 */
async function searchEvents(
  countryCode: string,
  city?: string | string[],
  segmentIds?: string[],
  genreIds?: string[],
  attractionIds?: string[],
  startDateTime?: string,
  endDateTime?: string
): Promise<TicketmasterEvent[] | TicketmasterErrorResponse> {
  const startTime = Date.now();

  try {
    const url = buildUrl('/events.json', {
      countryCode,
      city,
      segmentId: segmentIds,
      genreId: genreIds,
      attractionId: attractionIds,
      startDateTime,
      endDateTime,
      size: '200',
      locale: '*',
    });

    const cityDisplay = city ? (Array.isArray(city) ? `[${city.join(', ')}]` : city) : 'any';
    const segmentDisplay = segmentIds && segmentIds.length > 0 ? `[${segmentIds.join(', ')}]` : 'none';
    const genreDisplay = genreIds && genreIds.length > 0 ? `[${genreIds.join(', ')}]` : 'none';
    const attractionDisplay = attractionIds && attractionIds.length > 0 ? `[${attractionIds.join(', ')}]` : 'none';
    console.log(`🎫 [TICKETMASTER] Searching events with filters: country=${countryCode}, city=${cityDisplay}, segmentIds=${segmentDisplay}, genreIds=${genreDisplay}, attractionIds=${attractionDisplay}`);

    const response = await rateLimitedFetch(url);

    if (!response.ok) {
      const duration = Date.now() - startTime;

      if (response.status === 401) {
        console.error(`[TICKETMASTER] Invalid API key (${formatDuration(duration)})`);
        return { error: 'Invalid Ticketmaster API key' };
      }

      console.error(`[TICKETMASTER] Events API error: ${response.status} ${response.statusText} (${formatDuration(duration)})`);
      return { error: 'Ticketmaster API unreachable', details: `HTTP ${response.status}` };
    }

    const data: EventsResponse = await response.json();
    const events = data._embedded?.events || [];

    // Extract only essential event data with graceful error handling
    const normalizedEvents: TicketmasterEvent[] = events.map((event) => {
      try {
        // Extract each field with error handling
        const id = extractField(() => event.id, 'id', event.name);
        const name = extractField(() => event.name, 'name', event.id);
        const url = extractField(() => event.url, 'url', event.id);
        const dateTime = extractField(() => event.dates?.start?.dateTime, 'dateTime', event.id);
        const venueName = extractField(() => event._embedded?.venues?.[0]?.name, 'venueName', event.id);
        const imageUrl = extractField(() => selectBestImage(event.images), 'imageUrl', event.id);

        return {
          id,
          name,
          url,
          dateTime,
          venueName,
          imageUrl,
        };
      } catch (error) {
        console.error(`[TICKETMASTER] Error extracting event data for event ${event.id || 'unknown'}:`, error);
        // Return event with all null fields if extraction completely fails
        return {
          id: event.id || null,
          name: event.name || null,
          url: null,
          dateTime: null,
          venueName: null,
          imageUrl: null,
        };
      }
    });

    const duration = Date.now() - startTime;
    console.log(`✅ [TICKETMASTER] Found ${normalizedEvents.length} event(s) (${formatDuration(duration)})`);

    return normalizedEvents;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[TICKETMASTER] Error searching events (${formatDuration(duration)}):`, error);
    return { error: 'Ticketmaster API unreachable', details: String(error) };
  }
}

// ============================================================================
// Main Exported Function
// ============================================================================

/**
 * Searches Ticketmaster for events based on segment, genre, entity, and location
 *
 * @param params Search parameters
 * @returns Array of events or error response
 *
 * @example
 * // Search for Jazz concerts in Paris
 * await searchTicketmasterEvents({
 *   countryCode: 'FR',
 *   city: 'Paris',
 *   segmentName: 'Music',
 *   genreName: 'Jazz',
 *   startDateTime: '2025-11-10T00:00:00Z',
 *   endDateTime: '2025-11-15T23:59:59Z'
 * })
 *
 * @example
 * // Search for Coldplay concerts
 * await searchTicketmasterEvents({
 *   countryCode: 'GB',
 *   entityName: 'Coldplay'
 * })
 */
export async function searchTicketmasterEvents(
  params: TicketmasterSearchParams
): Promise<TicketmasterEvent[] | TicketmasterErrorResponse> {
  const totalStartTime = Date.now();

  console.log('🚀 [TICKETMASTER] === STARTING EVENT SEARCH ===');
  console.log(`📋 [TICKETMASTER] Params:`, JSON.stringify(params, null, 2));

  // Validate API key
  if (!TICKETMASTER_API_KEY) {
    console.error(`[TICKETMASTER] API key is missing!`);
    return { error: 'Invalid Ticketmaster API key', details: 'API key not configured' };
  }

  // Validate required parameters
  if (!params.countryCode) {
    console.error(`[TICKETMASTER] Missing required parameter: countryCode`);
    return { error: 'Missing required parameter: countryCode' };
  }

  try {
    let segmentIds: string[] = [];
    let genreIds: string[] = [];
    let attractionIds: string[] = [];

    // Step 1: Resolve classifications (if segment/genre provided)
    if (params.segmentName || params.genreName) {
      const classifications = await resolveClassifications(params.segmentName, params.genreName);
      segmentIds = classifications.segmentIds;
      genreIds = classifications.genreIds;

      // Check if segment/genre was requested but not found
      if (params.segmentName) {
        const requestedSegments = Array.isArray(params.segmentName) ? params.segmentName : [params.segmentName];
        if (requestedSegments.length > segmentIds.length) {
          console.warn(`[TICKETMASTER] Some segments not found. Requested: ${requestedSegments.join(', ')}, Found: ${segmentIds.length}`);
          return {
            error: 'Unknown segment',
            details: `Some segments not found in Ticketmaster classifications. Requested ${requestedSegments.length}, found ${segmentIds.length}.`
          };
        }
      }

      if (params.genreName) {
        const requestedGenres = Array.isArray(params.genreName) ? params.genreName : [params.genreName];
        if (requestedGenres.length > genreIds.length) {
          console.warn(`[TICKETMASTER] Some genres not found. Requested: ${requestedGenres.join(', ')}, Found: ${genreIds.length}`);
          return {
            error: 'Unknown genre',
            details: `Some genres not found in Ticketmaster classifications. Requested ${requestedGenres.length}, found ${genreIds.length}.`
          };
        }
      }
    }

    // Step 2: Resolve entity (if provided)
    if (params.entityName) {
      attractionIds = await resolveEntity(params.entityName);

      const requestedEntities = Array.isArray(params.entityName) ? params.entityName : [params.entityName];
      if (attractionIds.length === 0) {
        console.warn(`[TICKETMASTER] No entities found`);
        return {
          error: 'Unknown entity',
          details: `No entities found in Ticketmaster attractions`
        };
      }
      if (attractionIds.length < requestedEntities.length) {
        console.warn(`[TICKETMASTER] Some entities not found. Requested: ${requestedEntities.length}, Found: ${attractionIds.length}`);
        // Continue with partial results rather than erroring
      }
    }

    // Step 3: Search events with resolved IDs
    const result = await searchEvents(
      params.countryCode,
      params.city,
      segmentIds.length > 0 ? segmentIds : undefined,
      genreIds.length > 0 ? genreIds : undefined,
      attractionIds.length > 0 ? attractionIds : undefined,
      params.startDateTime,
      params.endDateTime
    );

    const totalDuration = Date.now() - totalStartTime;
    const minutes = Math.floor(totalDuration / 60000);
    const seconds = ((totalDuration % 60000) / 1000).toFixed(2);

    if ('error' in result) {
      console.log(`❌ [TICKETMASTER] Search failed: ${result.error} (${minutes}m ${seconds}s)`);
    } else {
      console.log(`✅ [TICKETMASTER] === SEARCH COMPLETE: ${result.length} events found in ${minutes}m ${seconds}s ===`);
    }

    return result;
  } catch (error) {
    const totalDuration = Date.now() - totalStartTime;
    console.error(`[TICKETMASTER] Unexpected error (${formatDuration(totalDuration)}):`, error);
    return { error: 'Ticketmaster API unreachable', details: String(error) };
  }
}

// ============================================================================
// Get Available Classifications
// ============================================================================

/**
 * Allowed segment IDs to return in classifications (to reduce token usage).
 * Only the most relevant segments for trip planning are included.
 */
const ALLOWED_SEGMENT_IDS = new Set([
  'KZFzniwnSyZfZ7v7nJ',  // Music
  'KZFzniwnSyZfZ7v7na',  // Arts & Theatre
  'KZFzniwnSyZfZ7v7nE',  // Sports
]);

/**
 * Returns a filtered list of segments (Music, Arts & Theatre, Sports) and their genres from Ticketmaster.
 * This helps the model know exactly what segment/genre names to use when searching.
 *
 * Only returns the most relevant segments to keep token usage low.
 * Uses cached classifications data (fast, ~50ms)
 *
 * @returns List of segments with their available genres, or error response
 */
export async function getTicketmasterClassifications(): Promise<TicketmasterClassificationsList | TicketmasterErrorResponse> {
  const startTime = Date.now();
  console.log(`📋 [TICKETMASTER] === GETTING AVAILABLE CLASSIFICATIONS ===`);

  try {
    // Use cached classifications (fast!)
    const data: ClassificationsResponse = await getClassifications();
    const classifications = data._embedded?.classifications || [];

    // Build a map to deduplicate segments (some appear multiple times)
    // Only include allowed segments to reduce token usage
    const segmentMap = new Map<string, Set<string>>();

    for (const classification of classifications) {
      const segmentId = classification.segment?.id;
      const segmentName = classification.segment?.name;

      // Skip segments not in our allowed list
      if (!segmentId || !segmentName || !ALLOWED_SEGMENT_IDS.has(segmentId)) {
        continue;
      }

      // Initialize segment if not exists
      if (!segmentMap.has(segmentName)) {
        segmentMap.set(segmentName, new Set());
      }

      // Add all genres for this segment
      const genres = classification.segment?._embedded?.genres || [];
      for (const genre of genres) {
        if (genre.name) {
          segmentMap.get(segmentName)!.add(genre.name);
        }
      }
    }

    // Convert to output format
    const segments: TicketmasterSegment[] = [];
    for (const [segmentName, genreSet] of segmentMap.entries()) {
      segments.push({
        name: segmentName,
        genres: Array.from(genreSet).sort() // Sort alphabetically for consistency
      });
    }

    // Sort segments alphabetically
    segments.sort((a, b) => a.name.localeCompare(b.name));

    const duration = Date.now() - startTime;
    console.log(`✅ [TICKETMASTER] Found ${segments.length} segments (filtered) with ${segments.reduce((sum, s) => sum + s.genres.length, 0)} total genres (${formatDuration(duration)})`);

    return { segments };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[TICKETMASTER] Error getting classifications (${formatDuration(duration)}):`, error);
    return { error: 'Failed to get Ticketmaster classifications', details: String(error) };
  }
}
