"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { ColorScheme, COLOR_SCHEMES } from "@/lib/colorScheme";

interface ColorThemeContextType {
  colorScheme: ColorScheme;
  setColorScheme: (scheme: ColorScheme) => void;
}

const ColorThemeContext = createContext<ColorThemeContextType | undefined>(undefined);

export function ColorThemeProvider({ children }: { children: ReactNode }) {
  const [colorScheme, setColorScheme] = useState<ColorScheme>(COLOR_SCHEMES.WHITE_BLACK);

  return (
    <ColorThemeContext.Provider value={{ colorScheme, setColorScheme }}>
      {children}
    </ColorThemeContext.Provider>
  );
}

export function useColorTheme() {
  const context = useContext(ColorThemeContext);
  if (context === undefined) {
    throw new Error("useColorTheme must be used within a ColorThemeProvider");
  }
  return context;
}
