"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { TripBundle } from "@/lib/types";
import { getBundles } from "@/lib/bundleService";
import { usePreferences } from "@/lib/context/PreferencesContext";
import { getRandomFallbackImage } from "@/lib/utils";
import BundleCard from "@/components/bundles/BundleCard";
import Button from "@/components/ui/Button";
import Dialog from "@/components/ui/Dialog";
import Logo from "@/components/ui/Logo";
import { COLOR_SCHEMES, ColorScheme, getUniqueRandomColorSchemes } from "@/lib/colorScheme";
import { useColorTheme } from "@/lib/context/ColorThemeContext";

export default function BundlesPage() {
  const router = useRouter();
  const { bundles: generatedBundles, bundleColors, isHydrated, resetPreferences, setBundleColors } = usePreferences();
  const [bundles, setBundles] = useState<TripBundle[]>([]);
  const [colorSchemes, setColorSchemes] = useState<ColorScheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRestartDialog, setShowRestartDialog] = useState(false);
  const [navbarColorScheme, setNavbarColorScheme] = useState<ColorScheme>(COLOR_SCHEMES.WHITE_BLACK);
  const { setColorScheme } = useColorTheme();
  const bundleRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    // Function to add imageUrl to each bundle from its events
    function addBundleImages(bundles: TripBundle[]): TripBundle[] {
      return bundles.map((bundle) => {
        let selectedImageUrl: string | null = null;

        // Try to find an image from keyEvents first
        if (bundle.keyEvents && bundle.keyEvents.length > 0) {
          for (const event of bundle.keyEvents) {
            if (event.imageUrl && event.imageUrl.trim() !== '') {
              selectedImageUrl = event.imageUrl;
              console.log(`Bundle "${bundle.title}" using image from key event "${event.title}": ${event.imageUrl}`);
              break;
            }
          }
        }

        // Try minorEvents as fallback
        if (!selectedImageUrl && bundle.minorEvents && bundle.minorEvents.length > 0) {
          for (const event of bundle.minorEvents) {
            if (event.imageUrl && event.imageUrl.trim() !== '') {
              selectedImageUrl = event.imageUrl;
              console.log(`Bundle "${bundle.title}" using image from minor event "${event.title}": ${event.imageUrl}`);
              break;
            }
          }
        }

        // If no images found in events, use random fallback
        if (!selectedImageUrl) {
          selectedImageUrl = getRandomFallbackImage();
          console.log(`Bundle "${bundle.title}" has no event images, using fallback: ${selectedImageUrl}`);
        }

        return { ...bundle, imageUrl: selectedImageUrl };
      });
    }

    async function loadBundles() {
      // Wait for context to hydrate from localStorage first
      if (!isHydrated) {
        return;
      }

      console.log('Loading bundles, generatedBundles:', generatedBundles);
      // Use generated bundles from context if available, otherwise fall back to static data
      // generatedBundles is always an array (or null)
      let bundlesToUse: TripBundle[] = [];
      if (generatedBundles && generatedBundles.length > 0) {
        console.log('Using generated bundles:', generatedBundles.length);
        bundlesToUse = addBundleImages(generatedBundles);
      } else {
        // Fallback to static data for development
        console.log('Using fallback sample data');
        const data = await getBundles();
        bundlesToUse = addBundleImages(data);
      }

      setBundles(bundlesToUse);

      // Generate or retrieve color schemes for bundles
      if (Object.keys(bundleColors).length > 0) {
        // Use existing colors
        const schemes = bundlesToUse.map((_, index) => {
          const colorName = bundleColors[index];
          return Object.values(COLOR_SCHEMES).find(s => s.name === colorName) || COLOR_SCHEMES.PINK_BLUE;
        });
        setColorSchemes(schemes);
      } else {
        // Generate new random colors for each bundle
        const schemes = getUniqueRandomColorSchemes(bundlesToUse.length);
        setColorSchemes(schemes);

        // Store color assignments
        const colorMap: Record<number, string> = {};
        schemes.forEach((scheme, index) => {
          colorMap[index] = scheme.name;
        });
        setBundleColors(colorMap);
      }

      setLoading(false);
    }
    loadBundles();
  }, [generatedBundles, bundleColors, isHydrated, setBundleColors]);

  // Scroll detection for navbar color switching
  useEffect(() => {
    if (bundleRefs.current.length === 0 || colorSchemes.length === 0) return;

    const handleScroll = () => {
      const NAVBAR_HEIGHT = 64; // 16 * 4 = 64px (h-16)

      // Find which bundle section the navbar bottom edge is touching
      for (let i = 0; i < bundleRefs.current.length; i++) {
        const bundleElement = bundleRefs.current[i];
        if (!bundleElement) continue;

        const rect = bundleElement.getBoundingClientRect();

        // Check if navbar bottom edge (64px from top) is within this bundle section
        if (rect.top <= NAVBAR_HEIGHT && rect.bottom > NAVBAR_HEIGHT) {
          // Navbar is within this bundle
          setNavbarColorScheme(colorSchemes[i]);
          setColorScheme(colorSchemes[i]);
          return;
        }
      }

      // Default to white/black if above all bundles
      setNavbarColorScheme(COLOR_SCHEMES.WHITE_BLACK);
      setColorScheme(COLOR_SCHEMES.WHITE_BLACK);
    };

    // Initial check
    handleScroll();

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [colorSchemes, setColorScheme]);

  // Generate summary message
  const getSummaryMessage = () => {
    if (bundles.length === 0) return null;

    const cities = bundles.map(b => b.city);
    const uniqueCities = Array.from(new Set(cities));

    let cityText = "";
    if (uniqueCities.length === 1) {
      cityText = uniqueCities[0];
    } else if (uniqueCities.length === 2) {
      cityText = `${uniqueCities[0]} and ${uniqueCities[1]}`;
    } else {
      // For 3+ cities: "city1, city2, and city3"
      cityText = uniqueCities.slice(0, -1).join(", ") + ", and " + uniqueCities[uniqueCities.length - 1];
    }

    const tripWord = bundles.length === 1 ? "trip" : "trips";
    return `Found ${bundles.length} interesting ${tripWord}:\nin ${cityText}.`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: colorSchemes[colorSchemes.length - 1]?.background || '#FFFFFF'
      }}
    >
      {/* Header */}
      <div
        className="sticky top-0 px-4 h-16 flex items-center z-10"
        style={{
          backgroundColor: navbarColorScheme.background,
          borderBottom: navbarColorScheme.name === "White Black"
            ? '1px solid #FFFFFF'
            : `1px solid ${navbarColorScheme.foreground}80`,
          transition: 'background-color 0.4s ease',
        }}
      >
        <Logo size="md" variant="type" />
      </div>

      {/* Summary Message - White Section */}
      <div className="px-4 pt-8 pb-8" style={{ backgroundColor: '#FFFFFF' }}>
        {bundles.length > 0 && (
          <div className="mb-[42px]">
            <h4 className="whitespace-pre-line" style={{ color: '#000000' }}>
              {getSummaryMessage()}
            </h4>
          </div>
        )}
      </div>

      {/* Bundles Feed */}
      <div className="px-4">
        {bundles.map((bundle, index) => (
          <div key={index} ref={(el) => { bundleRefs.current[index] = el; }}>
            <BundleCard
              bundle={bundle}
              index={index}
              colorScheme={colorSchemes[index] || COLOR_SCHEMES.PINK_BLUE}
            />
          </div>
        ))}
      </div>

      {/* Restart CTA */}
      <div className="text-center pt-10 pb-20 px-4">
        <Button
          variant="secondary"
          fullWidth={false}
          onClick={() => setShowRestartDialog(true)}
          className="px-8"
        >
          Start Over
        </Button>
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
          // Clear ALL storage items for a completely fresh start
          localStorage.removeItem('special-trips-generation-id');
          router.push("/welcome");
        }}
        backgroundColor={navbarColorScheme.background}
        foregroundColor={navbarColorScheme.foreground}
      />
    </div>
  );
}
