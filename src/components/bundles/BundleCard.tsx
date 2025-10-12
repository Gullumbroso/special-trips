import Link from "next/link";
import { TripBundle } from "@/lib/types";
import { formatDateRange } from "@/lib/utils";
import { INTEREST_EMOJIS } from "@/lib/constants";
import ImageWithFallback from "../ui/ImageWithFallback";
import Chip from "../ui/Chip";
import { useEffect, useRef, useState } from "react";

interface BundleCardProps {
  bundle: TripBundle;
  index: number;
}

export default function BundleCard({ bundle, index }: BundleCardProps) {
  const [isSticky, setIsSticky] = useState(false);
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const buttonContainer = buttonRef.current;
    if (!buttonContainer) return;

    // Use scroll listener to detect sticky state
    const handleScroll = () => {
      const rect = buttonContainer.getBoundingClientRect();
      const viewportHeight = window.innerHeight;

      // Button is sticky when it's at the bottom of viewport (with 16px offset for bottom-4)
      const isAtBottom = Math.abs(rect.bottom - viewportHeight + 16) < 5;
      setIsSticky(isAtBottom);
    };

    // Check initial state
    handleScroll();

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="bg-white rounded-lg mb-20 relative">
      {/* Image */}
      <div className="relative w-full h-48 rounded-t-lg overflow-hidden">
        <ImageWithFallback
          src={bundle.imageUrl}
          alt={bundle.title}
          fill
          className="object-cover"
        />
      </div>

      {/* Content */}
      <div className="mt-4">
        {/* Title */}
        <Link href={`/bundles/${index}`}>
          <h2 className="font-serif text-2xl font-semibold mb-4 leading-tight">
            {bundle.title}
          </h2>
        </Link>

        {/* Date and Location Chips */}
        <div className="flex gap-2 mb-4">
          <Chip>{formatDateRange(bundle.dateRange)}</Chip>
          <Chip>{bundle.city}</Chip>
        </div>

        {/* Description */}
        <p className="text-base text-black mb-6 leading-relaxed">
          {bundle.description}
        </p>

        {/* Key Events Section */}
        <div className="mb-6">
          <h3 className="font-serif text-xl font-semibold mb-3">Key Events</h3>
          <div className="space-y-3">
            {bundle.keyEvents.map((event, idx) => (
              <div key={idx} className="text-sm leading-relaxed">
                <div className="font-bold">
                  {INTEREST_EMOJIS[event.interestType]} {event.title}
                </div>
                <p className="text-sm text-black mt-1">
                  {event.shortDescription}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Button - Sticky to bottom */}
        <div
          ref={buttonRef}
          className={`sticky bottom-4 bg-white rounded-b-lg transition-shadow duration-300 ${isSticky ? 'shadow-lg' : 'shadow-none'}`}
        >
          <Link href={`/bundles/${index}`} className="block">
            <button className="w-full bg-primary text-black font-bold py-4 rounded-lg hover:bg-primary/90 active:bg-primary/80 transition-all duration-200">
              → Explore {bundle.city} Trip
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
