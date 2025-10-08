"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { TripBundle } from "@/lib/types";
import { getBundleById } from "@/lib/bundleService";
import { formatDateRange } from "@/lib/utils";
import EventCard from "@/components/bundles/EventCard";
import ImageWithFallback from "@/components/ui/ImageWithFallback";
import Button from "@/components/ui/Button";
import { usePreferences } from "@/lib/context/PreferencesContext";

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
      <div className="sticky top-0 bg-background/95 backdrop-blur border-b border-gray-200 px-6 py-4 z-10">
        <button
          onClick={() => router.push("/bundles")}
          className="flex items-center gap-2 text-foreground hover:text-text-gray transition-colors"
        >
          <span>←</span>
          <span className="font-medium">Back</span>
        </button>
      </div>

      {/* Hero Image */}
      <div className="relative w-full h-64">
        <ImageWithFallback
          src={bundle.imageUrl}
          alt={bundle.title}
          fill
          className="object-cover"
        />
      </div>

      {/* Content */}
      <div className="px-6 py-8">
        {/* Header Info */}
        <div className="mb-6">
          <div className="flex gap-2 text-sm text-text-gray mb-3">
            <span>{formatDateRange(bundle.dateRange)}</span>
            <span>•</span>
            <span>{bundle.city}</span>
          </div>

          <h1 className="font-serif text-[32px] font-semibold mb-4 leading-tight">
            {bundle.title}
          </h1>

          <p className="text-base font-medium text-text-gray leading-relaxed">
            {bundle.description}
          </p>
        </div>

        {/* Events Overview */}
        <div className="mb-8">
          <h3 className="text-xl mb-2">
            Key Events ({bundle.keyEvents.length})
          </h3>
          {bundle.minorEvents.length > 0 && (
            <p className="text-text-gray text-sm">
              + {bundle.minorEvents.length} other interesting events
            </p>
          )}
        </div>

        {/* Key Events */}
        <div className="mb-8">
          <h3 className="text-xl mb-4">Key Events</h3>
          {bundle.keyEvents.map((event, idx) => (
            <EventCard key={idx} event={event} />
          ))}
        </div>

        {/* Minor Events */}
        {bundle.minorEvents.length > 0 && (
          <div>
            <h3 className="text-xl mb-4">
              Other Interesting Events
            </h3>
            {bundle.minorEvents.map((event, idx) => (
              <EventCard key={idx} event={event} isMinor />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
