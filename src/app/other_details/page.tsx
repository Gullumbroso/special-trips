"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Textarea from "@/components/ui/Textarea";
import { usePreferences } from "@/lib/context/PreferencesContext";
import Link from "next/link";
import Logo from "@/components/ui/Logo";
import ClearDataButton from "@/components/ui/ClearDataButton";
import PageColorWrapper from "@/components/ui/PageColorWrapper";
import { COLOR_SCHEMES } from "@/lib/colorScheme";

export default function OtherDetailsPage() {
  const router = useRouter();
  const { preferences, updateOtherPreferences } = usePreferences();
  const [otherPreferences, setOtherPreferences] = useState(preferences.otherPreferences || "");

  const handleDone = () => {
    updateOtherPreferences(otherPreferences);
    router.push("/loading_bundles");
  };

  return (
    <PageColorWrapper colorScheme={COLOR_SCHEMES.YELLOW_PURPLE} className="flex flex-col px-6 pb-8">
      {/* Header with Logo and Clear Data Button */}
      <div className="flex justify-between items-center h-16 mb-12">
        <div>
          <Logo size="md" variant="type" />
        </div>
        <ClearDataButton />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col max-w-md">
        <h2 className="mb-3">
          Any other preferences?
        </h2>

        <p className="text-base font-normal mb-6">(Optional)</p>

        <Textarea
          value={otherPreferences}
          onChange={(e) => setOtherPreferences(e.target.value)}
          placeholder="e.g., Budget friendly, not too cold, focus on big events, I like history..."
          className="mb-8"
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
    </PageColorWrapper>
  );
}
