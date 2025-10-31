"use client";

import { ReactNode, useEffect } from "react";
import { ColorScheme } from "@/lib/colorScheme";
import { useColorTheme } from "@/lib/context/ColorThemeContext";

interface PageColorWrapperProps {
  children: ReactNode;
  colorScheme: ColorScheme;
  className?: string;
}

export default function PageColorWrapper({
  children,
  colorScheme,
  className = "",
}: PageColorWrapperProps) {
  const { setColorScheme } = useColorTheme();

  useEffect(() => {
    setColorScheme(colorScheme);
  }, [colorScheme, setColorScheme]);

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
