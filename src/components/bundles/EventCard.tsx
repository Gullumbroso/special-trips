import { Event } from "@/lib/types";
import { formatDateRange } from "@/lib/utils";
import { INTEREST_EMOJIS } from "@/lib/constants";
import ImageWithFallback from "../ui/ImageWithFallback";
import Chip from "../ui/Chip";
import { useColorTheme } from "@/lib/context/ColorThemeContext";

interface EventCardProps {
  event: Event;
  isMinor?: boolean;
}

export default function EventCard({ event, isMinor = false }: EventCardProps) {
  const { colorScheme } = useColorTheme();

  // Generate random fallback image number (1-10)
  const fallbackImageNumber = Math.floor(Math.random() * 10) + 1;

  // Define the fallback content to use for both missing and failed images
  const fallbackContent = (
    <div className="relative w-full h-48">
      <img
        src={`/fallback-images/${fallbackImageNumber}.png`}
        alt={event.title}
        className="w-full h-full object-cover absolute inset-0"
      />
      {/* Emoji overlay */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-white/80 rounded-full p-4 shadow-lg">
          <span className="text-5xl">{INTEREST_EMOJIS[event.interestType]}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`mb-12 ${isMinor ? "opacity-90" : ""}`}>
      {/* Event Title */}
      <h3 className="mb-4" style={{ color: colorScheme.foreground }}>
        {INTEREST_EMOJIS[event.interestType]} {event.title}
      </h3>

      {/* Event Image */}
      <div className="relative w-full mb-4 rounded-lg overflow-hidden">
        <ImageWithFallback
          src={event.imageUrl}
          alt={event.title}
          className="w-full h-auto rounded-lg"
          fallback={fallbackContent}
        />
      </div>

      {/* Content */}
      <div>
        {/* Date and Website Link Row */}
        <div className="flex items-center justify-between mb-4">
          <Chip>{formatDateRange(event.dateRange)}</Chip>
          {event.eventWebsite && (
            <a
              href={event.eventWebsite}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold hover:opacity-70 transition-opacity"
              style={{ color: colorScheme.foreground }}
            >
              <span>→</span>
              <span>Go to website</span>
            </a>
          )}
        </div>

        <p className="text-base font-normal leading-relaxed" style={{ color: colorScheme.foreground }}>
          {event.fullDescription}
        </p>
      </div>
    </div>
  );
}
