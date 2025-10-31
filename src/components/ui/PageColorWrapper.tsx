"use client";

import { ReactNode, useEffect } from "react";
import { ColorScheme } from "@/lib/colorScheme";
import { useColorTheme } from "@/lib/context/ColorThemeContext";

interface PageColorWrapperProps {
  children: ReactNode;
  colorScheme: ColorScheme;
  className?: string;
  applyToBody?: boolean; // Apply background color to body/html for Safari
}

export default function PageColorWrapper({
  children,
  colorScheme,
  className = "",
  applyToBody = false,
}: PageColorWrapperProps) {
  const { setColorScheme } = useColorTheme();

  useEffect(() => {
    setColorScheme(colorScheme);
  }, [colorScheme, setColorScheme]);

  // Apply background to body/html if requested (fixes Safari white space)
  useEffect(() => {
    if (applyToBody && typeof document !== 'undefined') {
      document.body.style.backgroundColor = colorScheme.background;
      document.documentElement.style.backgroundColor = colorScheme.background;
      return () => {
        document.body.style.backgroundColor = '';
        document.documentElement.style.backgroundColor = '';
      };
    }
  }, [applyToBody, colorScheme.background]);

  return (
    <div
      className={className}
      style={{
        backgroundColor: colorScheme.background,
        color: colorScheme.foreground,
        minHeight: "100dvh", // Dynamic viewport height for better mobile support (fallback: 100vh)
      }}
    >
      {children}
    </div>
  );
}
