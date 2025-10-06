import { SpotifyMusicProfile } from "./types";

// Spotify API Types
export interface SpotifyArtist {
  id: string;
  name: string;
  genres: string[];
  popularity: number;
  images: Array<{ url: string; height: number; width: number }>;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: { id: string; name: string }[];
}

export interface SpotifyTopArtistsResponse {
  items: SpotifyArtist[];
  next: string | null;
}

export interface SpotifyFollowedArtistsResponse {
  artists: {
    items: SpotifyArtist[];
    next: string | null;
  };
}

export interface SpotifyTopTracksResponse {
  items: SpotifyTrack[];
  next: string | null;
}

export interface SpotifySavedTracksResponse {
  items: { track: SpotifyTrack }[];
  next: string | null;
}

interface ArtistData {
  id: string;
  name: string;
  genres: string[];
  imageUrl: string;
  topArtistsRank?: number;
  isFollowed: boolean;
  trackCount: number;
}

/**
 * Fetch paginated data from Spotify API
 */
async function fetchPaginated<T>(
  initialUrl: string,
  accessToken: string,
  maxItems: number = 500
): Promise<T[]> {
  const results: T[] = [];
  let url: string | null = initialUrl;

  while (url && results.length < maxItems) {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Spotify API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Handle different response structures
    if (data.items) {
      results.push(...data.items);
      url = data.next;
    } else if (data.artists?.items) {
      // For followed artists
      results.push(...data.artists.items);
      url = data.artists.next;
    } else {
      break;
    }
  }

  return results.slice(0, maxItems);
}

/**
 * Generate Spotify Music Profile using the ranking algorithm
 */
export async function generateSpotifyMusicProfile(
  accessToken: string
): Promise<{
  musicProfile: SpotifyMusicProfile;
  debug: {
    dataFetched: {
      topArtists: number;
      followedArtists: number;
      topTracks: number;
      savedTracks: number;
    };
    totalArtists: number;
    totalGenres: number;
    topArtists: Array<{
      name: string;
      score: string;
      rankScore: number;
      followBonus: number;
      trackPresence: number;
    }>;
    topGenres: Array<{
      name: string;
      score: string;
    }>;
  };
}> {
  const baseUrl = "https://api.spotify.com/v1";

  // 1. Fetch all data in parallel
  const [topArtists, followedArtists, topTracks, savedTracks] = await Promise.all([
    fetchPaginated<SpotifyArtist>(
      `${baseUrl}/me/top/artists?time_range=long_term&limit=50`,
      accessToken,
      500
    ),
    fetchPaginated<SpotifyArtist>(
      `${baseUrl}/me/following?type=artist&limit=50`,
      accessToken,
      500
    ),
    fetchPaginated<SpotifyTrack>(
      `${baseUrl}/me/top/tracks?time_range=long_term&limit=50`,
      accessToken,
      500
    ),
    fetchPaginated<{ track: SpotifyTrack }>(
      `${baseUrl}/me/tracks?limit=50`,
      accessToken,
      500
    ),
  ]);


  // 2. Build artist data map
  const artistMap = new Map<string, ArtistData>();

  // Add top artists with ranks
  topArtists.forEach((artist, index) => {
    artistMap.set(artist.id, {
      id: artist.id,
      name: artist.name,
      genres: artist.genres,
      imageUrl: artist.images[0]?.url || "",
      topArtistsRank: index + 1,
      isFollowed: false,
      trackCount: 0,
    });
  });

  // Mark followed artists
  const followedIds = new Set(followedArtists.map((a) => a.id));
  followedIds.forEach((id) => {
    const existing = artistMap.get(id);
    if (existing) {
      existing.isFollowed = true;
    } else {
      const artist = followedArtists.find((a) => a.id === id)!;
      artistMap.set(id, {
        id: artist.id,
        name: artist.name,
        genres: artist.genres,
        imageUrl: artist.images[0]?.url || "",
        isFollowed: true,
        trackCount: 0,
      });
    }
  });

  // Count track appearances from top tracks and saved tracks
  const allTracks = [
    ...topTracks,
    ...savedTracks.map((item) => item.track),
  ];

  allTracks.forEach((track) => {
    track.artists.forEach((artist) => {
      const existing = artistMap.get(artist.id);
      if (existing) {
        existing.trackCount++;
      } else {
        artistMap.set(artist.id, {
          id: artist.id,
          name: artist.name,
          genres: [], // Will need to fetch if we want genres for these
          imageUrl: "", // No image available for artists only from tracks
          trackCount: 1,
          isFollowed: false,
        });
      }
    });
  });

  // 3. Calculate artist scores and rank
  const artistScores = Array.from(artistMap.values()).map((artist) => {
    const rankScore = artist.topArtistsRank ? 101 - artist.topArtistsRank : 0;
    const followBonus = artist.isFollowed ? 15 : 0;
    const trackPresence = Math.min(artist.trackCount, 10) * 5;
    const artistScore = 0.6 * rankScore + 0.2 * followBonus + 0.2 * trackPresence;

    return {
      ...artist,
      artistScore,
    };
  });

  // Sort by score descending
  artistScores.sort((a, b) => b.artistScore - a.artistScore);

  // 4. Calculate genre scores
  const genreScores = new Map<string, number>();

  artistScores.forEach((artist) => {
    artist.genres.forEach((genre) => {
      const currentScore = genreScores.get(genre) || 0;
      genreScores.set(genre, currentScore + artist.artistScore);
    });
  });

  // Sort genres by score
  const rankedGenres = Array.from(genreScores.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([genre]) => genre);

  const musicProfile = {
    artists: artistScores
      .slice(0, 1000)
      .filter((a) => a.imageUrl) // Only include artists with images
      .map((a) => ({
        name: a.name,
        imageUrl: a.imageUrl,
      })),
    genres: rankedGenres.slice(0, 1000),
  };


  // Build debug data for browser console
  const debug = {
    dataFetched: {
      topArtists: topArtists.length,
      followedArtists: followedArtists.length,
      topTracks: topTracks.length,
      savedTracks: savedTracks.length,
    },
    totalArtists: artistScores.length,
    totalGenres: rankedGenres.length,
    topArtists: artistScores.slice(0, 20).map((artist) => ({
      name: artist.name,
      score: artist.artistScore.toFixed(2),
      rankScore: artist.topArtistsRank ? (101 - artist.topArtistsRank) * 0.6 : 0,
      followBonus: artist.isFollowed ? 15 * 0.2 : 0,
      trackPresence: Math.min(artist.trackCount, 10) * 5 * 0.2,
    })),
    topGenres: rankedGenres.slice(0, 20).map((genre) => ({
      name: genre,
      score: genreScores.get(genre)?.toFixed(2) || "0",
    })),
  };

  // 5. Return music profile and debug data
  return { musicProfile, debug };
}

/**
 * Generate OAuth authorization URL
 */
export function getSpotifyAuthUrl(
  clientId: string,
  redirectUri: string,
  state: string
): string {
  const scopes = [
    "user-top-read",
    "user-follow-read",
    "user-library-read",
  ];

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    state: state,
    scope: scopes.join(" "),
  });

  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.statusText}`);
  }

  return response.json();
}
