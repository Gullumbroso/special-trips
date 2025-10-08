"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TripBundle } from "@/lib/types";
import { getBundles } from "@/lib/bundleService";
import { usePreferences } from "@/lib/context/PreferencesContext";
import BundleCard from "@/components/bundles/BundleCard";
import Button from "@/components/ui/Button";
import Dialog from "@/components/ui/Dialog";

export default function BundlesPage() {
  const router = useRouter();
  const { bundles: generatedBundles, isHydrated, resetPreferences } = usePreferences();
  const [bundles, setBundles] = useState<TripBundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRestartDialog, setShowRestartDialog] = useState(false);

  useEffect(() => {
    async function loadBundles() {
      // Wait for context to hydrate from localStorage first
      if (!isHydrated) {
        return;
      }

      console.log('Loading bundles, generatedBundles:', generatedBundles);
      // Use generated bundles from context if available, otherwise fall back to static data
      // generatedBundles is always an array (or null)
      if (generatedBundles && generatedBundles.length > 0) {
        console.log('Using generated bundles:', generatedBundles.length);
        setBundles(generatedBundles);
        setLoading(false);
      } else {
        // Fallback to static data for development
        console.log('Using fallback sample data');
        const data = await getBundles();
        setBundles(data);
        setLoading(false);
      }
    }
    loadBundles();
  }, [generatedBundles, isHydrated]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 bg-background border-b border-gray-200 px-6 py-4 z-10">
        <div className="flex items-center gap-2">
          <div className="text-2xl">🍀</div>
          <span className="text-lg font-bold">SpecialTrips</span>
        </div>
      </div>

      {/* Bundles Feed */}
      <div className="px-6 py-8">
        <h1 className="font-serif text-3xl font-bold mb-6">
          Your Trip Bundles
        </h1>

        {bundles.map((bundle, index) => (
          <BundleCard key={index} bundle={bundle} index={index} />
        ))}

        {/* Restart CTA */}
        <div className="text-center py-8">
          <Button
            variant="secondary"
            fullWidth={false}
            onClick={() => setShowRestartDialog(true)}
            className="px-8"
          >
            🔄 Start Over
          </Button>
        </div>
      </div>

      {/* Restart Confirmation Dialog */}
      <Dialog
        isOpen={showRestartDialog}
        onClose={() => setShowRestartDialog(false)}
        title="Start Over?"
        description="This will clear your preferences and take you back to the beginning. Your current trip bundles will be lost."
        confirmLabel="Yes, Restart"
        cancelLabel="Cancel"
        onConfirm={() => {
          resetPreferences();
          router.push("/welcome");
        }}
      />
    </div>
  );
}
