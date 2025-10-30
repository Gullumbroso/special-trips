"use client";

import { InputHTMLAttributes } from "react";
import { useColorTheme } from "@/lib/context/ColorThemeContext";
import { hexToRgba } from "@/lib/colorScheme";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export default function Input({ label, className = "", ...props }: InputProps) {
  const { colorScheme } = useColorTheme();

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-normal mb-2" style={{ color: colorScheme.foreground }}>
          {label}
        </label>
      )}
      <input
        className={`w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 transition-all ${className}`}
        style={{
          borderColor: hexToRgba(colorScheme.foreground, 0.3),
          color: colorScheme.foreground,
          backgroundColor: 'transparent',
        }}
        {...props}
      />
    </div>
  );
}
