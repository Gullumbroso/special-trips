"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@/components/ui/Button";
import Textarea from "@/components/ui/Textarea";
import { usePreferences } from "@/lib/context/PreferencesContext";
import Link from "next/link";
import InfiniteCarousel from "@/components/spotify/InfiniteCarousel";
import Logo from "@/components/ui/Logo";
import ClearDataButton from "@/components/ui/ClearDataButton";
import PageColorWrapper from "@/components/ui/PageColorWrapper";
import { COLOR_SCHEMES } from "@/lib/colorScheme";

function MusicTasteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { preferences, updateMusicProfile, disconnectSpotify } = usePreferences();
  const [musicProfile, setMusicProfile] = useState("");
  const [favoriteArtists, setFavoriteArtists] = useState("");

  const hasSpotifyProfile = !!preferences.spotifyMusicProfile;
  const spotifyConnected = searchParams.get("spotify") === "connected";
  const spotifyError = searchParams.get("error");

  // Initialize fields from saved preferences
  useEffect(() => {
    if (preferences.musicProfile) {
      // Parse the saved concatenated format back into separate fields
      const saved = preferences.musicProfile;

      // Extract music taste
      const musicTasteMatch = saved.match(/Music taste: ([^.]+)\./);
      if (musicTasteMatch) {
        setMusicProfile(musicTasteMatch[1].trim());
      }

      // Extract favorite artists
      const artistsMatch = saved.match(/Favorite artists: ([^.]+)\./);
      if (artistsMatch) {
        setFavoriteArtists(artistsMatch[1].trim());
      }
    }
  }, [preferences.musicProfile]);

  const handleNext = () => {
    // Concatenate both fields into musicProfile
    const parts = [];
    if (musicProfile.trim()) {
      parts.push(`Music taste: ${musicProfile.trim()}`);
    }
    if (favoriteArtists.trim()) {
      parts.push(`Favorite artists: ${favoriteArtists.trim()}`);
    }
    const combinedProfile = parts.join(". ") + (parts.length > 0 ? "." : "");

    updateMusicProfile(combinedProfile);

    // Wait for React to flush state updates and effects before navigating
    setTimeout(() => {
      router.push("/trip_timeframe");
    }, 50);
  };

  const handleConnectSpotify = () => {
    window.location.href = "/api/auth/spotify/authorize";
  };

  const handleReconnectSpotify = () => {
    disconnectSpotify();
    window.location.href = "/api/auth/spotify/authorize";
  };

  // Split artists into 3 rows for the carousel - aim for 20 per row
  const getArtistRows = () => {
    if (!preferences.spotifyMusicProfile) return [[], [], []];

    const artists = preferences.spotifyMusicProfile.artists;

    // If we have fewer than 60 artists, divide evenly into 3 rows
    if (artists.length < 60) {
      const rowSize = Math.ceil(artists.length / 3);
      return [
        artists.slice(0, rowSize),
        artists.slice(rowSize, rowSize * 2),
        artists.slice(rowSize * 2),
      ];
    }

    // Otherwise, use 20 per row
    return [
      artists.slice(0, 20),
      artists.slice(20, 40),
      artists.slice(40, 60),
    ];
  };

  // Split genres into 3 rows for the carousel - aim for 20 per row
  const getGenreRows = () => {
    if (!preferences.spotifyMusicProfile) return [[], [], []];

    const genres = preferences.spotifyMusicProfile.genres;

    // If we have fewer than 60 genres, divide evenly into 3 rows
    if (genres.length < 60) {
      const rowSize = Math.ceil(genres.length / 3);
      return [
        genres.slice(0, rowSize),
        genres.slice(rowSize, rowSize * 2),
        genres.slice(rowSize * 2),
      ];
    }

    // Otherwise, use 20 per row
    return [
      genres.slice(0, 20),
      genres.slice(20, 40),
      genres.slice(40, 60),
    ];
  };

  return (
    <PageColorWrapper colorScheme={COLOR_SCHEMES.GREEN_RED} className="flex flex-col px-6 pb-8">
      {/* Header with Logo and Clear Data Button */}
      <div className="flex justify-between items-center h-16 mb-12">
        <div>
          <Logo size="md" variant="type" />
        </div>
        <ClearDataButton />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col max-w-md">
        {/* Error Banner */}
        {spotifyError && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800 mb-2 font-medium">
              {spotifyError === "profile_fetch_failed"
                ? "Spotify Connection Failed"
                : spotifyError === "access_denied"
                ? "Spotify Access Denied"
                : "Something went wrong"}
            </p>
            <p className="text-sm text-red-700 mb-3">
              {spotifyError === "profile_fetch_failed"
                ? "We couldn't access your Spotify data. This usually happens when you deny permissions during authorization. Please try connecting again and make sure to allow all requested permissions."
                : spotifyError === "access_denied"
                ? "You denied access to Spotify. To use this feature, you'll need to allow the requested permissions."
                : "An error occurred while connecting to Spotify. Please try again."}
            </p>
            <button
              onClick={handleReconnectSpotify}
              className="text-sm text-red-800 hover:text-red-900 font-medium underline"
            >
              Try connecting again
            </button>
          </div>
        )}

        {hasSpotifyProfile ? (
          // Spotify connected view
          <>
            <h2 className="mb-4">
              Your music taste profile is ready.
            </h2>

            <div className="flex gap-3 mb-16">
              <Link href="/interests" className="flex-shrink-0">
                <Button variant="secondary" fullWidth={false} className="px-8">
                  Back
                </Button>
              </Link>
              <Button onClick={handleNext}>Continue →</Button>
            </div>

            {/* Artist Carousels */}
            {preferences.spotifyMusicProfile && preferences.spotifyMusicProfile.artists.length > 0 && (
              <div className="mb-6 -mx-6">
                <div className="space-y-[10px]">
                  {getArtistRows().map((row, index) => (
                    <InfiniteCarousel
                      key={`artist-${index}`}
                      items={row}
                      direction={index % 2 === 0 ? "right" : "left"}
                      type="artist"
                      speed={0.5}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Genre Carousels */}
            {preferences.spotifyMusicProfile && preferences.spotifyMusicProfile.genres.length > 0 && (
              <div className="-mx-6 mt-6">
                <div className="space-y-[10px]">
                  {getGenreRows().map((row, index) => (
                    <InfiniteCarousel
                      key={`genre-${index}`}
                      items={row}
                      direction={index % 2 === 0 ? "right" : "left"}
                      type="genre"
                      speed={1}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          // Default view (connect Spotify or manual entry)
          <>
            <h2 className="mb-4">
              What music are you into?
            </h2>

            <p className="text-base font-normal mb-3">
              What kind of music do you enjoy? Tell us about your favorite genres or vibes.
            </p>

            <Textarea
              value={musicProfile}
              onChange={(e) => setMusicProfile(e.target.value)}
              placeholder="Hip hop, indie rock, electronic, underground jazz venues..."
              className="mb-6"
              rows={6}
            />

            <p className="text-base font-normal mb-3">
              Who are some artists you love? List a few so we can get a feel for your taste.
            </p>

            <Textarea
              value={favoriteArtists}
              onChange={(e) => setFavoriteArtists(e.target.value)}
              placeholder="Beyoncé, Kendrick Lamar, Bad Bunny, Radiohead, Black Coffee, Rosalía..."
              className="mb-6"
              rows={6}
            />

            <div className="flex gap-3">
              <Link href="/interests" className="flex-shrink-0">
                <Button variant="secondary" fullWidth={false} className="px-8">
                  Back
                </Button>
              </Link>
              <Button onClick={handleNext} disabled={!musicProfile.trim() && !favoriteArtists.trim()}>
                Next →
              </Button>
            </div>
          </>
        )}
      </div>
    </PageColorWrapper>
  );
}

export default function MusicTastePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <MusicTasteContent />
    </Suspense>
  );
}
