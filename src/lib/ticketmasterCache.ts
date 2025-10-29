/**
 * Ticketmaster Classifications Cache Service
 *
 * Caches Ticketmaster classification data (segments and genres) in the database
 * to reduce API calls and improve response times. Cache expires after 7 days.
 */

import { db } from '@/db/client';
import { ticketmasterClassificationsCache } from '@/db/schema';
import { desc, gt } from 'drizzle-orm';
import { rateLimitedFetch } from './ticketmaster';

const TICKETMASTER_API_KEY = process.env.TICKETMASTER_API_KEY;
const TICKETMASTER_BASE_URL = "https://app.ticketmaster.com/discovery/v2";
const CACHE_DURATION_DAYS = 7;

// Type for the raw Ticketmaster classifications API response
interface ClassificationsResponse {
  _embedded?: {
    classifications?: Array<{
      segment?: {
        id: string;
        name: string;
        _embedded?: {
          genres?: Array<{
            id: string;
            name: string;
          }>;
        };
      };
    }>;
  };
}

/**
 * Fetches classifications directly from Ticketmaster API
 */
async function fetchClassificationsFromAPI(): Promise<ClassificationsResponse> {
  const url = new URL(`${TICKETMASTER_BASE_URL}/classifications.json`);

  if (TICKETMASTER_API_KEY) {
    url.searchParams.append('apikey', TICKETMASTER_API_KEY);
  } else {
    throw new Error('Ticketmaster API key is not configured');
  }

  url.searchParams.append('size', '500');
  url.searchParams.append('locale', '*');

  console.log(`[TICKETMASTER CACHE] Fetching fresh classifications from API...`);
  const startTime = Date.now();

  const response = await rateLimitedFetch(url.toString());

  if (!response.ok) {
    const duration = Date.now() - startTime;
    throw new Error(
      `Failed to fetch classifications from Ticketmaster API: ${response.status} ${response.statusText} (${duration}ms)`
    );
  }

  const data: ClassificationsResponse = await response.json();
  const duration = Date.now() - startTime;
  console.log(`[TICKETMASTER CACHE] Successfully fetched classifications from API (${duration}ms)`);

  return data;
}

/**
 * Saves classifications data to the database cache
 */
async function saveClassificationsToCache(data: ClassificationsResponse): Promise<void> {
  console.log(`[TICKETMASTER CACHE] Saving classifications to database...`);
  const startTime = Date.now();

  const now = new Date();
  const expiresAt = new Date(now.getTime() + CACHE_DURATION_DAYS * 24 * 60 * 60 * 1000);

  // Delete any existing cache entries (we only keep one)
  await db.delete(ticketmasterClassificationsCache);

  // Insert new cache entry
  await db.insert(ticketmasterClassificationsCache).values({
    data: data as unknown as Record<string, unknown>, // Store as JSONB
    fetchedAt: now,
    expiresAt: expiresAt,
  });

  const duration = Date.now() - startTime;
  console.log(`[TICKETMASTER CACHE] Saved to database, expires at ${expiresAt.toISOString()} (${duration}ms)`);
}

/**
 * Retrieves cached classifications from the database if valid
 * @returns Cached data or null if cache is expired or doesn't exist
 */
async function getCachedClassifications(): Promise<ClassificationsResponse | null> {
  console.log(`[TICKETMASTER CACHE] Checking database cache...`);
  const startTime = Date.now();

  try {
    // Fetch the most recent cache entry that hasn't expired
    const [cached] = await db
      .select()
      .from(ticketmasterClassificationsCache)
      .where(gt(ticketmasterClassificationsCache.expiresAt, new Date()))
      .orderBy(desc(ticketmasterClassificationsCache.fetchedAt))
      .limit(1);

    if (!cached) {
      const duration = Date.now() - startTime;
      console.log(`[TICKETMASTER CACHE] No valid cache found (${duration}ms)`);
      return null;
    }

    const duration = Date.now() - startTime;
    const fetchedAt = new Date(cached.fetchedAt);
    const expiresAt = new Date(cached.expiresAt);
    const age = Math.floor((Date.now() - fetchedAt.getTime()) / (1000 * 60 * 60 * 24));

    console.log(
      `[TICKETMASTER CACHE] Cache hit! Age: ${age} day(s), expires: ${expiresAt.toISOString()} (${duration}ms)`
    );

    return cached.data as ClassificationsResponse;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[TICKETMASTER CACHE] Error reading from cache (${duration}ms):`, error);
    return null;
  }
}

/**
 * Refreshes the classifications cache by fetching from API and saving to database
 * @returns Fresh classifications data
 */
export async function refreshClassifications(): Promise<ClassificationsResponse> {
  const data = await fetchClassificationsFromAPI();
  await saveClassificationsToCache(data);
  return data;
}

/**
 * Gets classifications data from cache or fetches fresh if needed
 * This is the main function to use for getting classifications
 *
 * @returns Classifications data (either from cache or fresh from API)
 */
export async function getClassifications(): Promise<ClassificationsResponse> {
  console.log(`[TICKETMASTER CACHE] === Getting classifications ===`);
  const totalStartTime = Date.now();

  try {
    // Try to get from cache first
    const cached = await getCachedClassifications();

    if (cached) {
      const totalDuration = Date.now() - totalStartTime;
      console.log(`[TICKETMASTER CACHE] === Using cached data (${totalDuration}ms) ===`);
      return cached;
    }

    // Cache miss or expired - fetch fresh data
    console.log(`[TICKETMASTER CACHE] Cache miss - fetching fresh data...`);
    const fresh = await refreshClassifications();

    const totalDuration = Date.now() - totalStartTime;
    console.log(`[TICKETMASTER CACHE] === Fresh data retrieved (${totalDuration}ms) ===`);

    return fresh;
  } catch (error) {
    const totalDuration = Date.now() - totalStartTime;
    console.error(`[TICKETMASTER CACHE] === Error getting classifications (${totalDuration}ms) ===`, error);
    throw error;
  }
}
