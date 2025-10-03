import { InterestType } from "./types";

export const INTEREST_OPTIONS: { value: InterestType; label: string; emoji: string }[] = [
  { value: "concerts", label: "Concerts", emoji: "🎵" },
  { value: "sports", label: "Sports", emoji: "⚽" },
  { value: "artDesign", label: "Art & Design", emoji: "🎨" },
  { value: "localCulture", label: "Local Culture", emoji: "🏛️" },
  { value: "culinary", label: "Culinary", emoji: "🍽️" },
];

export const INTEREST_LABELS: Record<InterestType, string> = {
  concerts: "Concerts",
  sports: "Sports",
  artDesign: "Art & Design",
  localCulture: "Local Culture",
  culinary: "Culinary",
};

export const INTEREST_EMOJIS: Record<InterestType, string> = {
  concerts: "🎵",
  sports: "⚽",
  artDesign: "🎨",
  localCulture: "🏛️",
  culinary: "🍽️",
};
