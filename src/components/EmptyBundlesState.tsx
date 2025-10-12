"use client";

import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";

export default function EmptyBundlesState() {
  const router = useRouter();

  const handleChangeDates = () => {
    router.push("/trip_timeframe");
  };

  const handleAdjustPreferences = () => {
    router.push("/other_details");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-8">
      <div className="text-center max-w-md">
        {/* Map Icon */}
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100">
            <span className="text-3xl">🗺️</span>
          </div>
        </div>

        <h1 className="font-serif text-3xl font-bold mb-4">
          No trips yet
        </h1>

        <p className="text-lg text-text-gray mb-8">
          We didn&apos;t find any trips that fit your current criteria. Try widening your time window or changing your travel preferences to discover new possibilities.
        </p>

        <div className="space-y-3">
          <Button onClick={handleChangeDates}>
            Try Different Dates
          </Button>
          <Button variant="secondary" onClick={handleAdjustPreferences}>
            Adjust Preferences
          </Button>
        </div>
      </div>
    </div>
  );
}
