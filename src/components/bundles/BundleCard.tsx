import Link from "next/link";
import { TripBundle } from "@/lib/types";
import { formatDateRange } from "@/lib/utils";
import { INTEREST_EMOJIS } from "@/lib/constants";
import ImageWithFallback from "../ui/ImageWithFallback";
import Chip from "../ui/Chip";
import { ColorScheme } from "@/lib/colorScheme";

interface BundleCardProps {
  bundle: TripBundle;
  index: number;
  colorScheme: ColorScheme;
}

export default function BundleCard({ bundle, index, colorScheme }: BundleCardProps) {
  // Strip country from city name (e.g., "Paris, France" -> "Paris")
  const cityName = bundle.city.split(',')[0].trim();

  return (
    <div
      className="relative py-10 -mx-4 px-4"
      style={{
        backgroundColor: colorScheme.background,
        borderTop: `1px solid ${colorScheme.foreground}`,
        borderTopColor: `${colorScheme.foreground}80`,
      }}
    >
      {/* Content wrapper */}
      <div className="relative">
        {/* Image */}
        <div className="relative w-full overflow-hidden" style={{ borderRadius: '8px' }}>
          <ImageWithFallback
            src={bundle.imageUrl}
            alt={bundle.title}
            width={800}
            height={600}
            className="w-full h-auto"
            style={{ borderRadius: '8px' }}
          />
        </div>

        {/* Content */}
        <div className="mt-4">
        {/* Title */}
        <Link href={`/bundles/${index}`}>
          <h2 className="mb-4 leading-tight" style={{ color: colorScheme.foreground }}>
            {bundle.title}
          </h2>
        </Link>

        {/* Date and Location Chips */}
        <div className="flex gap-2 mb-4">
          <Chip foregroundColor={colorScheme.foreground}>{formatDateRange(bundle.dateRange)}</Chip>
          <Chip foregroundColor={colorScheme.foreground}>{cityName}</Chip>
        </div>

        {/* Key Events Section */}
        <div className="mb-6">
          <h3 className="mb-3" style={{ color: colorScheme.foreground }}>Key Events</h3>
          <div className="space-y-3">
            {bundle.keyEvents.map((event, idx) => (
              <div key={idx} className="text-sm leading-relaxed">
                <div className="font-bold" style={{ color: colorScheme.foreground }}>
                  {INTEREST_EMOJIS[event.interestType]} {event.title}
                </div>
                <p className="text-sm mt-1" style={{ color: colorScheme.foreground }}>
                  {event.shortDescription}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* About This Trip Section */}
        <div className="mb-6">
          <h3 className="mb-3" style={{ color: colorScheme.foreground }}>About This Trip</h3>
          <p className="text-base leading-relaxed" style={{ color: colorScheme.foreground }}>
            {bundle.description}
          </p>
        </div>

        {/* CTA Button - Sticky to bottom */}
        <div
          className="sticky bottom-4"
          style={{ borderRadius: '8px', backgroundColor: colorScheme.background }}
        >
          <Link href={`/bundles/${index}`} className="block">
            <button
              className="w-full font-bold py-3 hover:opacity-90 active:opacity-80 transition-all duration-200"
              style={{
                borderRadius: '8px',
                backgroundColor: colorScheme.foreground,
                color: '#FFFFFF',
              }}
            >
              → Explore {cityName} Trip
            </button>
          </Link>
        </div>
        </div>
      </div>
    </div>
  );
}
