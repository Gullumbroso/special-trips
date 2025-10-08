"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@/components/ui/Button";
import Textarea from "@/components/ui/Textarea";
import { usePreferences } from "@/lib/context/PreferencesContext";
import Link from "next/link";
import InfiniteCarousel from "@/components/spotify/InfiniteCarousel";
import Logo from "@/components/ui/Logo";

function MusicTasteContent() {
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
      <div className="mb-12 -ml-2">
        <Logo size="md" />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col max-w-md">
        {hasSpotifyProfile ? (
          // Spotify connected view
          <>
            <h1 className="font-serif text-[32px] font-semibold mb-8 leading-tight">
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
            <h1 className="font-serif text-[32px] font-semibold mb-4 leading-tight">
              What type of music are you into?
            </h1>

            <p className="text-base font-medium text-text-gray mb-6">
              Connect your Spotify for a detailed understanding of your musical tastes.
            </p>

            <button
              onClick={handleConnectSpotify}
              className="w-full bg-[#1ED760] hover:bg-[#1DB954] active:bg-[#169C46] text-black text-base font-bold py-4 px-6 rounded-lg mb-8 flex items-center justify-center gap-2 transition-colors"
            >
              <svg width="19" height="16" viewBox="0 0 19 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12.2975 13.8379C12.5858 13.786 12.8416 13.6218 13.0089 13.3813C13.176 13.1408 13.2407 12.8437 13.1888 12.5554C13.137 12.2671 12.9727 12.0112 12.7323 11.844C11.6358 11.082 10.3696 10.5996 9.04409 10.4387C7.71855 10.2778 6.37376 10.4433 5.1268 10.9208C4.85909 11.0297 4.64474 11.2393 4.52973 11.5044C4.41472 11.7696 4.4082 12.0693 4.51158 12.3392C4.61496 12.6091 4.81999 12.8277 5.08271 12.9482C5.34543 13.0687 5.6449 13.0814 5.91689 12.9836C6.82639 12.6283 7.80977 12.504 8.7791 12.6216C9.74842 12.7393 10.6735 13.0953 11.4716 13.6579C11.7121 13.825 12.0092 13.8898 12.2975 13.8379Z" fill="black"/>
                <path d="M18.0159 6.5353C18.1383 6.45733 18.2442 6.356 18.3275 6.23709L18.3258 6.23966C18.4096 6.12084 18.4692 5.98664 18.501 5.84475C18.5329 5.70286 18.5364 5.55607 18.5114 5.41281C18.4864 5.26955 18.4334 5.13264 18.3553 5.00992C18.2773 4.88721 18.1758 4.78111 18.0567 4.69771C15.7 3.04287 12.9712 1.99546 10.1125 1.64844C7.25386 1.30143 4.35373 1.66554 1.66956 2.70847C1.39624 2.81438 1.17619 3.02452 1.05781 3.29268C0.939432 3.56083 0.932425 3.86503 1.03833 4.13835C1.14424 4.41167 1.35439 4.63172 1.62254 4.7501C1.8907 4.86848 2.19489 4.87549 2.46821 4.76958C4.81361 3.85736 7.34805 3.53872 9.84626 3.84198C12.3445 4.14523 14.7291 5.061 16.7881 6.50788C16.9069 6.59124 17.041 6.65036 17.1827 6.68186C17.3244 6.71337 17.4709 6.71664 17.6139 6.6915C17.7569 6.66635 17.8935 6.61327 18.0159 6.5353Z" fill="black"/>
                <path d="M14.9555 10.2639C15.2439 10.2128 15.5003 10.0493 15.6682 9.80921L15.6665 9.81178C15.75 9.69291 15.8093 9.55872 15.841 9.41689C15.8726 9.27506 15.876 9.12838 15.8508 8.98526C15.8257 8.84214 15.7726 8.70538 15.6945 8.58282C15.6164 8.46026 15.5149 8.35431 15.3958 8.27104C13.6691 7.06238 11.6714 6.2973 9.57903 6.04331C7.48667 5.78932 5.36395 6.05421 3.39818 6.81463C3.12975 6.92363 2.91488 7.13371 2.79986 7.39961C2.68484 7.66551 2.67888 7.96596 2.78326 8.23621C2.88764 8.50647 3.094 8.72491 3.35789 8.84447C3.62178 8.96403 3.92208 8.97514 4.19409 8.87541C5.82201 8.24544 7.57999 8.02595 9.31283 8.2363C11.0457 8.44665 12.7001 9.08037 14.13 10.0815C14.3701 10.2494 14.667 10.3149 14.9555 10.2639Z" fill="black"/>
              </svg>
              Connect Spotify
            </button>

            <div className="flex items-center gap-4 mb-8">
              <div className="flex-1 h-px bg-gray-300"></div>
              <span className="text-gray-500 text-sm">or</span>
              <div className="flex-1 h-px bg-gray-300"></div>
            </div>

            <p className="text-base font-medium text-text-gray mb-4">
              Describe your preferred genres, favorite artists, or any other detail about your musical taste.
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

export default function MusicTastePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <MusicTasteContent />
    </Suspense>
  );
}
