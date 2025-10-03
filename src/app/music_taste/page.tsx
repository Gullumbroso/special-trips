"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Textarea from "@/components/ui/Textarea";
import { usePreferences } from "@/lib/context/PreferencesContext";
import Link from "next/link";

export default function MusicTastePage() {
  const router = useRouter();
  const { preferences, updateMusicProfile } = usePreferences();
  const [musicProfile, setMusicProfile] = useState(preferences.musicProfile || "");

  const handleNext = () => {
    updateMusicProfile(musicProfile);
    router.push("/trip_timeframe");
  };

  return (
    <div className="min-h-screen flex flex-col px-6 py-8">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-12">
        <div className="text-3xl">🍀</div>
        <span className="text-xl font-bold">SpecialTrips</span>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col max-w-md">
        <h1 className="font-serif text-4xl font-bold mb-8">
          Tell us about your music taste
        </h1>

        <Textarea
          value={musicProfile}
          onChange={(e) => setMusicProfile(e.target.value)}
          placeholder="e.g., Indie Rock, Neo-Soul, Jazz, Electronic..."
          className="mb-12"
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
      </div>
    </div>
  );
}
