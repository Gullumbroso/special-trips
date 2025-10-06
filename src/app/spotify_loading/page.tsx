"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePreferences } from "@/lib/context/PreferencesContext";

export default function SpotifyLoadingPage() {
  const router = useRouter();
  const { updateSpotifyMusicProfile, updateMusicProfile } = usePreferences();

  useEffect(() => {
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
        const topArtistNames = musicProfile.artists.slice(0, 5).map((a) => a.name).join(", ");
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
    <div className="min-h-screen flex flex-col px-6 py-8">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-12">
        <div className="text-3xl">🍀</div>
        <span className="text-xl font-bold">SpecialTrips</span>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center max-w-md">
        <h1 className="font-serif text-4xl font-bold mb-6">
          Connecting Spotify...
        </h1>

        <p className="text-gray-600 mb-8 text-center">
          We're connecting Spotify and learning your music taste.
          <br />
          This might take a few moments.
        </p>

        {/* Loading spinner */}
        <div className="w-12 h-12 border-4 border-gray-200 border-t-green-500 rounded-full animate-spin"></div>
      </div>
    </div>
  );
}
