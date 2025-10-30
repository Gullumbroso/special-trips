"use client";

import { useColorTheme } from "@/lib/context/ColorThemeContext";
import { hexToRgba } from "@/lib/colorScheme";

interface ChipProps {
  children: React.ReactNode;
  className?: string;
  foregroundColor?: string;
}

export default function Chip({ children, className = "", foregroundColor }: ChipProps) {
  const { colorScheme } = useColorTheme();

  // Use explicit color if provided, otherwise fall back to context
  const color = foregroundColor || colorScheme.foreground;

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${className}`}
      style={{
        backgroundColor: hexToRgba(color, 0.08),
        color: color,
      }}
    >
      {children}
    </span>
  );
}
