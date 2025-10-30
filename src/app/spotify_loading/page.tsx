"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { usePreferences } from "@/lib/context/PreferencesContext";
import Logo from "@/components/ui/Logo";

export default function SpotifyLoadingPage() {
  const router = useRouter();
  const { updateSpotifyMusicProfile, updateMusicProfile } = usePreferences();
  const hasProcessedRef = useRef(false);

  useEffect(() => {
    // Prevent multiple API calls and redirects
    if (hasProcessedRef.current) {
      console.log("⚠️ Preventing duplicate Spotify profile fetch");
      return;
    }
    hasProcessedRef.current = true;
    console.log("✅ Fetching Spotify profile once");

    async function fetchSpotifyProfile() {
      try {
        // Get access token from URL hash
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const accessToken = params.get("access_token");

        if (!accessToken) {
          router.push("/music_taste?error=no_token");
          return;
        }

        // Call API to generate music profile
        const response = await fetch("/api/spotify/profile", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ accessToken }),
        });

        if (!response.ok) {
          throw new Error("Failed to fetch Spotify profile");
        }

        const { musicProfile } = await response.json();

        // Update context with Spotify data
        updateSpotifyMusicProfile(musicProfile);

        // Generate a text summary for the musicProfile field
        const topGenres = musicProfile.genres.slice(0, 5).join(", ");
        const topArtistNames = musicProfile.artists.slice(0, 5).map((a: { name: string }) => a.name).join(", ");
        const summary = `${topGenres} • ${topArtistNames}`;
        updateMusicProfile(summary);

        // Redirect to music taste page with success
        router.push("/music_taste?spotify=connected");
      } catch (error) {
        console.error("Error fetching Spotify profile:", error);
        router.push("/music_taste?error=profile_fetch_failed");
      }
    }

    fetchSpotifyProfile();
  }, [router, updateSpotifyMusicProfile, updateMusicProfile]);

  return (
    <div className="min-h-screen flex flex-col px-6 pb-8">
      {/* Logo */}
      <div className="h-16 flex items-center mb-20">
        <Logo size="md" variant="type" />
      </div>

      {/* Content */}
      <div className="max-w-2xl">
        <h1 className="mb-3 leading-tight">
          Connecting Spotify...
        </h1>

        <p className="text-base font-normal text-black mb-6">
          We&apos;re connecting Spotify and learning your music taste.
          <br />
          This might take a few moments.
        </p>

        {/* Loading spinner */}
        <div className="mb-8">
          <svg width="36" height="36" viewBox="0 0 36 36" className="animate-spin">
            <circle cx="18" cy="18" r="16" fill="none" stroke="#000000" strokeWidth="4" opacity="0.25"/>
            <path d="M18 2 A16 16 0 0 1 34 18" fill="none" stroke="#000000" strokeWidth="4" strokeLinecap="round"/>
          </svg>
        </div>
      </div>
    </div>
  );
}
