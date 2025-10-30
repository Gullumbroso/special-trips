// Color scheme configuration for the app
export interface ColorScheme {
  name: string;
  background: string;
  foreground: string;
}

export const COLOR_SCHEMES = {
  PINK_BLUE: {
    name: "Pink Blue",
    background: "#FFF5F7",
    foreground: "#00437E",
  },
  GREEN_RED: {
    name: "Green Red",
    background: "#F1FBF5",
    foreground: "#650405",
  },
  BLUE_GREEN: {
    name: "Blue Green",
    background: "#F6F9FF",
    foreground: "#124E04",
  },
  YELLOW_PURPLE: {
    name: "Yellow Purple",
    background: "#FFF9F0",
    foreground: "#63014A",
  },
  WHITE_BLACK: {
    name: "White Black",
    background: "#FFFFFF",
    foreground: "#000000",
  },
} as const;

export type ColorSchemeName = keyof typeof COLOR_SCHEMES;

// Get all color schemes except White Black (for random selection)
export function getRandomColorScheme(excludeWhiteBlack = true): ColorScheme {
  const schemes = excludeWhiteBlack
    ? Object.values(COLOR_SCHEMES).filter((s) => s.name !== "White Black")
    : Object.values(COLOR_SCHEMES);
  return schemes[Math.floor(Math.random() * schemes.length)];
}

// Get a set of unique random color schemes
export function getUniqueRandomColorSchemes(count: number): ColorScheme[] {
  const schemes = Object.values(COLOR_SCHEMES).filter((s) => s.name !== "White Black");
  const shuffled = [...schemes].sort(() => Math.random() - 0.5);
  const result: ColorScheme[] = [];

  for (let i = 0; i < count; i++) {
    result.push(shuffled[i % shuffled.length]);
  }

  return result;
}

// Helper to convert hex to rgba with alpha
export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
