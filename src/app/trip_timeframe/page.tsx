"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { usePreferences } from "@/lib/context/PreferencesContext";
import Link from "next/link";
import Logo from "@/components/ui/Logo";
import ClearDataButton from "@/components/ui/ClearDataButton";
import PageColorWrapper from "@/components/ui/PageColorWrapper";
import { COLOR_SCHEMES } from "@/lib/colorScheme";

export default function TripTimeframePage() {
  const router = useRouter();
  const { preferences, updateTimeframe } = usePreferences();
  const [timeframe, setTimeframe] = useState(preferences.timeframe || "");
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when page loads
  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleNext = () => {
    updateTimeframe(timeframe);
    router.push("/other_details");
  };

  return (
    <PageColorWrapper colorScheme={COLOR_SCHEMES.BLUE_GREEN} className="flex flex-col px-6 pb-8">
      {/* Header with Logo and Clear Data Button */}
      <div className="flex justify-between items-center h-16 mb-12">
        <div>
          <Logo size="md" variant="type" />
        </div>
        <ClearDataButton />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col max-w-md">
        <h2 className="mb-4">
          When are you planning to travel?
        </h2>

        <Input
          ref={inputRef}
          value={timeframe}
          onChange={(e) => setTimeframe(e.target.value)}
          placeholder='e.g., "November 2025", "Spring 2026", "next 3 months"'
          className="mb-8"
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
    </PageColorWrapper>
  );
}
