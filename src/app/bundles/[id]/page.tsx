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
import { COLOR_SCHEMES, ColorScheme, hexToRgba } from "@/lib/colorScheme";
import { useColorTheme } from "@/lib/context/ColorThemeContext";

export default function BundleDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const { bundles: generatedBundles, bundleColors, isHydrated } = usePreferences();
  const [bundle, setBundle] = useState<TripBundle | null>(null);
  const [colorScheme, setColorSchemeState] = useState<ColorScheme>(COLOR_SCHEMES.WHITE_BLACK);
  const [loading, setLoading] = useState(true);
  const { setColorScheme: setGlobalColorScheme } = useColorTheme();

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

        // Load the color scheme for this bundle
        const colorName = bundleColors[index];
        if (colorName) {
          const scheme = Object.values(COLOR_SCHEMES).find(s => s.name === colorName);
          if (scheme) {
            setColorSchemeState(scheme);
          }
        }

        setLoading(false);
      }
    }
    loadBundle();
  }, [params.id, generatedBundles, bundleColors, isHydrated]);

  // Set global color scheme when component mounts
  useEffect(() => {
    setGlobalColorScheme(colorScheme);
  }, [colorScheme, setGlobalColorScheme]);

  // Scroll to top when page loads
  useEffect(() => {
    // Use instant behavior and ensure it happens immediately
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

    // Also scroll after a brief delay to handle mobile browser timing issues
    const timeoutId = setTimeout(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [params.id]); // Scroll to top whenever the bundle ID changes

  // Strip country from city name (e.g., "Paris, France" -> "Paris")
  const cityName = bundle?.city.split(',')[0].trim() || '';

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
    <div className="min-h-screen pb-20" style={{ backgroundColor: colorScheme.background }}>
      {/* Back Button - Fixed Header */}
      <div className="sticky top-0 px-4 py-4 z-10" style={{ backgroundColor: colorScheme.background }}>
        <button
          onClick={() => router.push("/bundles")}
          className="flex items-center gap-2 hover:opacity-70 transition-opacity"
          style={{ color: colorScheme.foreground }}
        >
          <span>←</span>
          <span className="font-medium">Back</span>
        </button>
      </div>

      {/* Content */}
      <div className="px-4 py-8">
        {/* Header Info */}
        <div className="mb-6">
          <h1 className="mb-4 leading-tight" style={{ color: colorScheme.foreground }}>
            {bundle.title}
          </h1>

          <div className="flex gap-2 mb-4">
            <Chip>{formatDateRange(bundle.dateRange)}</Chip>
            <Chip>{cityName}</Chip>
          </div>

          <p className="text-base font-normal leading-relaxed" style={{ color: colorScheme.foreground }}>
            {bundle.description}
          </p>
        </div>

        {/* Events Overview */}
        <div className="mb-8 p-4 rounded-lg" style={{ backgroundColor: hexToRgba(colorScheme.foreground, 0.08) }}>
          <div className="text-base font-bold mb-3" style={{ color: colorScheme.foreground }}>Key events</div>
          <div className="space-y-3">
            {bundle.keyEvents.map((event, idx) => (
              <div key={idx} className="text-sm leading-relaxed" style={{ color: colorScheme.foreground }}>
                {INTEREST_EMOJIS[event.interestType]} {event.title}
              </div>
            ))}
          </div>
          {bundle.minorEvents.length > 0 && (
            <>
              <div className="text-base font-bold mb-3 mt-6" style={{ color: colorScheme.foreground }}>Other interesting events</div>
              <div className="space-y-3">
                {bundle.minorEvents.map((event, idx) => (
                  <div key={idx} className="text-sm leading-relaxed" style={{ color: colorScheme.foreground }}>
                    {INTEREST_EMOJIS[event.interestType]} {event.title}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Key Events */}
        <div className="mb-8">
          <h2 className="mb-4 sticky top-[56px] pb-2 z-[5]" style={{ backgroundColor: colorScheme.background, color: colorScheme.foreground }}>Key Events</h2>
          {bundle.keyEvents.map((event, idx) => (
            <EventCard key={idx} event={event} />
          ))}
        </div>

        {/* Minor Events */}
        {bundle.minorEvents.length > 0 && (
          <div>
            <h2 className="mb-4 sticky top-[56px] pb-2 z-[5]" style={{ backgroundColor: colorScheme.background, color: colorScheme.foreground }}>
              Other Interesting Events
            </h2>
            {bundle.minorEvents.map((event, idx) => (
              <EventCard key={idx} event={event} isMinor />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
