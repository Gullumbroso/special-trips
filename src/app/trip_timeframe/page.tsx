"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { usePreferences } from "@/lib/context/PreferencesContext";
import Link from "next/link";
import Logo from "@/components/ui/Logo";
import ClearDataButton from "@/components/ui/ClearDataButton";

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
      {/* Header with Logo and Clear Data Button */}
      <div className="flex justify-between items-center mb-12">
        <div className="-ml-2">
          <Logo size="md" />
        </div>
        <ClearDataButton />
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
