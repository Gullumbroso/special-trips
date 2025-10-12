import { DateRange, Event } from "./types";

/**
 * Gets a random fallback image path (1-10)
 */
export function getRandomFallbackImage(): string {
  const imageNumber = Math.floor(Math.random() * 10) + 1;
  return `/fallback-images/${imageNumber}.png`;
}

/**
 * Determines the best image URL for a bundle based on its key events.
 * Checks key events in order, returns first non-empty imageUrl found.
 * If no key events have images, returns a random fallback image.
 */
export function getBundleImageUrl(keyEvents: Event[]): string {
  if (!keyEvents || keyEvents.length === 0) {
    return getRandomFallbackImage();
  }

  // Check each key event in order for an imageUrl
  for (const event of keyEvents) {
    if (event.imageUrl && event.imageUrl.trim() !== '') {
      return event.imageUrl;
    }
  }

  // No key events have images, use random fallback
  return getRandomFallbackImage();
}

export function formatDateRange(dateRange: DateRange): string {
  const startDate = new Date(dateRange.startDate);
  const endDate = new Date(dateRange.endDate);

  const startMonth = startDate.toLocaleString("en-US", { month: "short" });
  const endMonth = endDate.toLocaleString("en-US", { month: "short" });
  const startDay = startDate.getDate();
  const endDay = endDate.getDate();
  const year = startDate.getFullYear();

  // Same month: "Nov 14-19, 2025"
  if (startMonth === endMonth) {
    return `${startMonth} ${startDay}-${endDay}, ${year}`;
  }

  // Different months: "Nov 28 - Dec 2, 2025"
  return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
}

export function formatSingleDate(dateString: string): string {
  const date = new Date(dateString);
  const month = date.toLocaleString("en-US", { month: "short" });
  const day = date.getDate();
  const year = date.getFullYear();
  return `${month} ${day}, ${year}`;
}
