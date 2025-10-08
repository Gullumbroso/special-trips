import Link from "next/link";
import { TripBundle } from "@/lib/types";
import { formatDateRange } from "@/lib/utils";
import { INTEREST_EMOJIS } from "@/lib/constants";
import ImageWithFallback from "../ui/ImageWithFallback";

interface BundleCardProps {
  bundle: TripBundle;
  index: number;
}

export default function BundleCard({ bundle, index }: BundleCardProps) {
  return (
    <Link href={`/bundles/${index}`} className="block">
      <div className="bg-white rounded-lg overflow-hidden mb-6">
        {/* Image */}
        <div className="relative w-full h-48">
          <ImageWithFallback
            src={bundle.imageUrl}
            alt={bundle.title}
            fill
            className="object-cover"
          />
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="flex gap-2 text-sm text-text-gray mb-3">
            <span>{formatDateRange(bundle.dateRange)}</span>
            <span>•</span>
            <span>{bundle.city}</span>
          </div>

          <h2 className="font-serif text-2xl font-semibold mb-3 leading-tight">
            {bundle.title}
          </h2>

          <p className="text-sm text-text-gray mb-4 line-clamp-3">
            {bundle.description}
          </p>

          {/* Key Events Pills */}
          <div className="flex flex-wrap gap-2 mb-4">
            {bundle.keyEvents.map((event, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-3 py-1 bg-secondary/10 rounded-full text-sm"
              >
                <span>{INTEREST_EMOJIS[event.interestType]}</span>
                <span className="text-text-gray">{event.title.split(" ")[0]}...</span>
              </span>
            ))}
          </div>

          {/* CTA */}
          <div className="inline-flex items-center gap-2 text-primary font-medium">
            <span>Explore {bundle.city} Trip</span>
            <span>→</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
