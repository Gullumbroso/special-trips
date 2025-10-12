"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { usePreferences } from "@/lib/context/PreferencesContext";
import Link from "next/link";
import Logo from "@/components/ui/Logo";

export default function TripTimeframePage() {
  const router = useRouter();
  const { preferences, updateTimeframe } = usePreferences();
  const [timeframe, setTimeframe] = useState(preferences.timeframe || "");

  const handleNext = () => {
    updateTimeframe(timeframe);
    router.push("/other_details");
  };

  return (
    <div className="min-h-screen flex flex-col px-6 pt-3 pb-8">
      {/* Logo */}
      <div className="mb-12 -ml-2">
        <Logo size="md" />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col max-w-md">
        <h1 className="font-serif text-[32px] font-semibold mb-8 leading-tight">
          When are you planning to travel?
        </h1>

        <Input
          value={timeframe}
          onChange={(e) => setTimeframe(e.target.value)}
          placeholder='e.g., "November 2025", "Spring 2026", "next 3 months"'
          className="mb-12"
        />

        <div className="flex gap-3">
          <Link href="/music_taste" className="flex-shrink-0">
            <Button variant="secondary" fullWidth={false} className="px-8">
              Back
            </Button>
          </Link>
          <Button onClick={handleNext} disabled={!timeframe.trim()}>
            Next →
          </Button>
        </div>
      </div>
    </div>
  );
}
