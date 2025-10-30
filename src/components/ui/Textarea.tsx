"use client";

import { TextareaHTMLAttributes } from "react";
import { useColorTheme } from "@/lib/context/ColorThemeContext";
import { hexToRgba } from "@/lib/colorScheme";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export default function Textarea({ label, className = "", ...props }: TextareaProps) {
  const { colorScheme } = useColorTheme();

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-normal mb-2" style={{ color: colorScheme.foreground }}>
          {label}
        </label>
      )}
      <textarea
        className={`w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 transition-all h-[100px] resize-none ${className}`}
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
