"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@/components/ui/Button";
import Textarea from "@/components/ui/Textarea";
import { usePreferences } from "@/lib/context/PreferencesContext";
import Link from "next/link";
import InfiniteCarousel from "@/components/spotify/InfiniteCarousel";
import Logo from "@/components/ui/Logo";

export default function MusicTastePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { preferences, updateMusicProfile } = usePreferences();
  const [musicProfile, setMusicProfile] = useState(preferences.musicProfile || "");

  const hasSpotifyProfile = !!preferences.spotifyMusicProfile;
  const spotifyConnected = searchParams.get("spotify") === "connected";

  useEffect(() => {
    // Update local state if Spotify profile was just connected
    if (spotifyConnected && preferences.musicProfile) {
      setMusicProfile(preferences.musicProfile);
    }
  }, [spotifyConnected, preferences.musicProfile]);

  const handleNext = () => {
    updateMusicProfile(musicProfile);
    router.push("/trip_timeframe");
  };

  const handleConnectSpotify = () => {
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
    <div className="min-h-screen flex flex-col px-6 py-8">
      {/* Logo */}
      <div className="mb-12">
        <Logo size="md" />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col max-w-md">
        {hasSpotifyProfile ? (
          // Spotify connected view
          <>
            <h1 className="font-serif text-4xl font-bold mb-8">
              Your music taste profile is ready.
            </h1>

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
            <h1 className="font-serif text-4xl font-bold mb-4">
              What type of music are you into?
            </h1>

            <p className="text-gray-600 mb-6">
              Connect your Spotify for a detailed understanding of your musical tastes.
            </p>

            <button
              onClick={handleConnectSpotify}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-4 px-6 rounded-lg mb-6 flex items-center justify-center gap-2 transition-colors"
            >
              <span className="text-lg">🎵</span>
              Connect Spotify
            </button>

            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1 h-px bg-gray-300"></div>
              <span className="text-gray-500 text-sm">or</span>
              <div className="flex-1 h-px bg-gray-300"></div>
            </div>

            <p className="text-gray-600 text-sm mb-4">
              Describe your preferred genres, favorite artists, or any other detail about your musical taste. The more details the better the results.
            </p>

            <Textarea
              value={musicProfile}
              onChange={(e) => setMusicProfile(e.target.value)}
              placeholder="Jazz, hip hop, and house, with touches of latin and classic rock"
              className="mb-8"
              rows={6}
            />

            <div className="flex gap-3">
              <Link href="/interests" className="flex-shrink-0">
                <Button variant="secondary" fullWidth={false} className="px-8">
                  Back
                </Button>
              </Link>
              <Button onClick={handleNext} disabled={!musicProfile.trim()}>
                Next →
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

