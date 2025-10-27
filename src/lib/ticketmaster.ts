/**
 * Ticketmaster Discovery API integration for event search
 *
 * This service searches for events by:
 * - Segment/Genre (e.g., Music > Jazz, Sports > Football)
 * - Entity (e.g., artist, sports team, venue)
 * - Location (country, city)
 * - Date range
 */

const TICKETMASTER_API_KEY = process.env.TICKETMASTER_API_KEY;
const TICKETMASTER_BASE_URL = "https://app.ticketmaster.com/discovery/v2";

// ============================================================================
// Type Definitions
// ============================================================================

export interface TicketmasterSearchParams {
  countryCode: string;
  city?: string;
  segmentName?: string;
  genreName?: string;
  entityName?: string;
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

function buildUrl(path: string, params: Record<string, string | undefined>): string {
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

  // Add other params
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.append(key, value);
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
  segmentId?: string;
  genreId?: string;
}

/**
 * Fetches classifications and maps segment/genre names to IDs
 * @param segmentName Optional segment name (e.g., "Music", "Sports")
 * @param genreName Optional genre name (e.g., "Jazz", "Football")
 * @returns Object with segmentId and/or genreId
 */
async function resolveClassifications(
  segmentName?: string,
  genreName?: string
): Promise<ClassificationIds> {
  const startTime = Date.now();
  const result: ClassificationIds = {};

  if (!segmentName && !genreName) {
    return result;
  }

  try {
    const url = buildUrl('/classifications.json', { size: '500', locale: 'en' });
    console.log(`🏷️  [TICKETMASTER] Fetching classifications...`);

    const response = await fetch(url);

    if (!response.ok) {
      const duration = Date.now() - startTime;
      const errorBody = await response.text();
      console.error(`[TICKETMASTER] Classifications API error: ${response.status} ${response.statusText} (${formatDuration(duration)})`);
      console.error(`[TICKETMASTER] Error response body:`, errorBody);
      return result;
    }

    const data: ClassificationsResponse = await response.json();
    const classifications = data._embedded?.classifications || [];

    // Case-insensitive matching
    const segmentLower = segmentName?.toLowerCase();
    const genreLower = genreName?.toLowerCase();

    // Find segment ID first
    if (segmentLower) {
      for (const classification of classifications) {
        if (classification.segment?.name?.toLowerCase() === segmentLower) {
          result.segmentId = classification.segment.id;
          break;
        }
      }
    }

    // Find genre ID (scoped by segment if both provided)
    if (genreLower) {
      for (const classification of classifications) {
        // If segment was specified, only search in that segment
        if (segmentLower && result.segmentId) {
          if (classification.segment?.id === result.segmentId) {
            // Search through genres in this segment
            const genres = classification.segment._embedded?.genres || [];
            for (const genre of genres) {
              if (genre.name?.toLowerCase() === genreLower) {
                result.genreId = genre.id;
                break;
              }
            }
            if (result.genreId) break;
          }
        } else {
          // No segment constraint, search all genres
          const genres = classification.segment?._embedded?.genres || [];
          for (const genre of genres) {
            if (genre.name?.toLowerCase() === genreLower) {
              result.genreId = genre.id;
              break;
            }
          }
          if (result.genreId) break;
        }
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ [TICKETMASTER] Resolved classifications: segmentId=${result.segmentId || 'none'}, genreId=${result.genreId || 'none'} (${formatDuration(duration)})`);

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
 * Looks up an entity (artist, team, venue) and returns its attraction ID
 * @param entityName The entity to search for
 * @returns Attraction ID or undefined if not found
 */
async function resolveEntity(entityName: string): Promise<string | undefined> {
  const startTime = Date.now();

  try {
    const url = buildUrl('/attractions.json', {
      keyword: entityName,
      size: '10',
      locale: 'en',
    });

    const truncatedName = entityName.length > 40 ? entityName.substring(0, 37) + '...' : entityName;
    console.log(`🎭 [TICKETMASTER] Looking up entity: "${truncatedName}"`);

    const response = await fetch(url);

    if (!response.ok) {
      const duration = Date.now() - startTime;
      console.error(`[TICKETMASTER] Attractions API error: ${response.status} ${response.statusText} (${formatDuration(duration)})`);
      return undefined;
    }

    const data: AttractionsResponse = await response.json();
    const attractions = data._embedded?.attractions || [];

    if (attractions.length === 0) {
      const duration = Date.now() - startTime;
      console.warn(`[TICKETMASTER] No attractions found for "${truncatedName}" (${formatDuration(duration)})`);
      return undefined;
    }

    // Select best match (first result is highest relevance)
    const bestMatch = attractions[0];
    const duration = Date.now() - startTime;
    console.log(`✅ [TICKETMASTER] Found attraction: "${bestMatch.name}" (ID: ${bestMatch.id}) (${formatDuration(duration)})`);

    return bestMatch.id;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[TICKETMASTER] Error looking up entity "${entityName}" (${formatDuration(duration)}):`, error);
    return undefined;
  }
}

// ============================================================================
// Step 3: Event Search
// ============================================================================

/**
 * Searches for events with the provided filters
 * @param params Search parameters including IDs resolved from previous steps
 * @returns Array of events or error response
 */
async function searchEvents(
  countryCode: string,
  city?: string,
  segmentId?: string,
  genreId?: string,
  attractionId?: string,
  startDateTime?: string,
  endDateTime?: string
): Promise<TicketmasterEvent[] | TicketmasterErrorResponse> {
  const startTime = Date.now();

  try {
    const url = buildUrl('/events.json', {
      countryCode,
      city,
      segmentId,
      genreId,
      attractionId,
      startDateTime,
      endDateTime,
      size: '100',
      locale: 'en',
    });

    console.log(`🎫 [TICKETMASTER] Searching events with filters: country=${countryCode}, city=${city || 'any'}, segmentId=${segmentId || 'none'}, genreId=${genreId || 'none'}, attractionId=${attractionId || 'none'}`);

    const response = await fetch(url);

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
    let segmentId: string | undefined;
    let genreId: string | undefined;
    let attractionId: string | undefined;

    // Step 1: Resolve classifications (if segment/genre provided)
    if (params.segmentName || params.genreName) {
      const classifications = await resolveClassifications(params.segmentName, params.genreName);
      segmentId = classifications.segmentId;
      genreId = classifications.genreId;

      // Check if segment/genre was requested but not found
      if (params.segmentName && !segmentId) {
        console.warn(`[TICKETMASTER] Segment "${params.segmentName}" not found`);
        return {
          error: 'Unknown segment',
          details: `Segment "${params.segmentName}" not found in Ticketmaster classifications`
        };
      }

      if (params.genreName && !genreId) {
        console.warn(`[TICKETMASTER] Genre "${params.genreName}" not found`);
        return {
          error: 'Unknown genre',
          details: `Genre "${params.genreName}" not found in Ticketmaster classifications`
        };
      }
    }

    // Step 2: Resolve entity (if provided)
    if (params.entityName) {
      attractionId = await resolveEntity(params.entityName);

      if (!attractionId) {
        console.warn(`[TICKETMASTER] Entity "${params.entityName}" not found`);
        return {
          error: 'Unknown entity',
          details: `Entity "${params.entityName}" not found in Ticketmaster attractions`
        };
      }
    }

    // Step 3: Search events with resolved IDs
    const result = await searchEvents(
      params.countryCode,
      params.city,
      segmentId,
      genreId,
      attractionId,
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
