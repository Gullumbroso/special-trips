import { Event } from "@/lib/types";
import { formatDateRange } from "@/lib/utils";
import { INTEREST_LABELS, INTEREST_EMOJIS } from "@/lib/constants";
import ImageWithFallback from "../ui/ImageWithFallback";

interface EventCardProps {
  event: Event;
  isMinor?: boolean;
}

export default function EventCard({ event, isMinor = false }: EventCardProps) {
  return (
    <div className={`bg-white rounded-lg overflow-hidden mb-6 ${isMinor ? "opacity-90" : ""}`}>
      {/* Event Image */}
      <div className="relative w-full">
        {event.imageUrl ? (
          <ImageWithFallback
            src={event.imageUrl}
            alt={event.title}
            width={800}
            height={600}
            className="w-full h-auto"
          />
        ) : (
          <div className="w-full h-40 bg-gradient-to-br from-secondary/10 to-primary/10 flex items-center justify-center">
            <span className="text-5xl">{INTEREST_EMOJIS[event.interestType]}</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5">
        {/* Interest Badge */}
        <div className="inline-flex items-center gap-1 px-3 py-1 bg-secondary/10 rounded-full text-sm mb-3">
          <span>{INTEREST_EMOJIS[event.interestType]}</span>
          <span className="text-text-gray">{INTEREST_LABELS[event.interestType]}</span>
        </div>

        <h3 className="font-serif text-xl font-bold mb-2">
          {event.title}
        </h3>

        <div className="text-sm text-text-gray mb-4">
          {formatDateRange(event.dateRange)}
        </div>

        <p className="text-text-gray mb-4 text-sm leading-relaxed">
          {event.fullDescription}
        </p>

        {/* Website Link */}
        {event.eventWebsite && (
          <a
            href={event.eventWebsite}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-secondary font-medium hover:text-secondary/80 transition-colors"
          >
            <span>Go to website</span>
            <span>→</span>
          </a>
        )}
      </div>
    </div>
  );
}
