"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Textarea from "@/components/ui/Textarea";
import { usePreferences } from "@/lib/context/PreferencesContext";
import Link from "next/link";
import Logo from "@/components/ui/Logo";

export default function OtherDetailsPage() {
  const router = useRouter();
  const { preferences, updateOtherPreferences } = usePreferences();
  const [otherPreferences, setOtherPreferences] = useState(preferences.otherPreferences || "");

  const handleDone = () => {
    updateOtherPreferences(otherPreferences);
    router.push("/loading_bundles");
  };

  return (
    <div className="min-h-screen flex flex-col px-6 pt-3 pb-8">
      {/* Logo */}
      <div className="mb-12 -ml-2">
        <Logo size="md" />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col max-w-md">
        <h1 className="font-serif text-[32px] font-semibold mb-4 leading-tight">
          Any other preferences?
        </h1>

        <p className="text-base font-normal text-black mb-8">(Optional)</p>

        <Textarea
          value={otherPreferences}
          onChange={(e) => setOtherPreferences(e.target.value)}
          placeholder="e.g., Budget friendly, not too cold, focus on big events, I like history..."
          className="mb-12"
          rows={6}
        />

        <div className="flex gap-3">
          <Link href="/trip_timeframe" className="flex-shrink-0">
            <Button variant="secondary" fullWidth={false} className="px-8">
              Back
            </Button>
          </Link>
          <Button onClick={handleDone}>
            Done →
          </Button>
        </div>
      </div>
    </div>
  );
}
