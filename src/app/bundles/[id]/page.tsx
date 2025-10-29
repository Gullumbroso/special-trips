"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { TripBundle } from "@/lib/types";
import { getBundleById } from "@/lib/bundleService";
import { formatDateRange } from "@/lib/utils";
import EventCard from "@/components/bundles/EventCard";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import { usePreferences } from "@/lib/context/PreferencesContext";
import { INTEREST_EMOJIS } from "@/lib/constants";

export default function BundleDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const { bundles: generatedBundles, isHydrated } = usePreferences();
  const [bundle, setBundle] = useState<TripBundle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadBundle() {
      // Wait for context to hydrate from localStorage first
      if (!isHydrated) {
        return;
      }

      if (params.id) {
        const index = parseInt(params.id as string, 10);

        // Use generated bundles if available, otherwise fall back to static data
        if (generatedBundles && generatedBundles.length > 0) {
          const data = generatedBundles[index] || null;
          setBundle(data);
        } else {
          const data = await getBundleById(params.id as string);
          setBundle(data);
        }
        setLoading(false);
      }
    }
    loadBundle();
  }, [params.id, generatedBundles, isHydrated]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!bundle) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-text-gray mb-4">Bundle not found</p>
          <Button onClick={() => router.push("/bundles")}>
            Back to Bundles
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Back Button - Fixed Header */}
      <div className="sticky top-0 bg-background px-4 py-4 z-10">
        <button
          onClick={() => router.push("/bundles")}
          className="flex items-center gap-2 text-foreground hover:text-text-gray transition-colors"
        >
          <span>←</span>
          <span className="font-medium">Back</span>
        </button>
      </div>

      {/* Content */}
      <div className="px-4 py-8">
        {/* Header Info */}
        <div className="mb-6">
          <h1 className="mb-4 leading-tight">
            {bundle.title}
          </h1>

          <div className="flex gap-2 mb-4">
            <Chip>{formatDateRange(bundle.dateRange)}</Chip>
            <Chip>{bundle.city}</Chip>
          </div>

          <p className="text-base font-normal text-black leading-relaxed">
            {bundle.description}
          </p>
        </div>

        {/* Events Overview */}
        <div className="mb-8 p-4 rounded-lg" style={{ backgroundColor: '#F2F2F7' }}>
          <div className="text-base font-bold mb-3">Key events</div>
          <div className="space-y-3">
            {bundle.keyEvents.map((event, idx) => (
              <div key={idx} className="text-sm leading-relaxed">
                {INTEREST_EMOJIS[event.interestType]} {event.title}
              </div>
            ))}
          </div>
          {bundle.minorEvents.length > 0 && (
            <>
              <div className="text-base font-bold mb-3 mt-6">Other interesting events</div>
              <div className="space-y-3">
                {bundle.minorEvents.map((event, idx) => (
                  <div key={idx} className="text-sm leading-relaxed">
                    {INTEREST_EMOJIS[event.interestType]} {event.title}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Key Events */}
        <div className="mb-8">
          <h4 className="mb-4 sticky top-[56px] bg-background pb-2 z-[5]">Key Events</h4>
          {bundle.keyEvents.map((event, idx) => (
            <EventCard key={idx} event={event} />
          ))}
        </div>

        {/* Minor Events */}
        {bundle.minorEvents.length > 0 && (
          <div>
            <h4 className="mb-4 sticky top-[56px] bg-background pb-2 z-[5]">
              Other Interesting Events
            </h4>
            {bundle.minorEvents.map((event, idx) => (
              <EventCard key={idx} event={event} isMinor />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
