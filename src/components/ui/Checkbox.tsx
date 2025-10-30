"use client";

import { InputHTMLAttributes } from "react";
import { useColorTheme } from "@/lib/context/ColorThemeContext";
import { hexToRgba } from "@/lib/colorScheme";

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  emoji?: string;
}

export default function Checkbox({ label, emoji, className = "", ...props }: CheckboxProps) {
  const { colorScheme } = useColorTheme();

  return (
    <label
      className={`flex items-center gap-2.5 px-3 h-[40px] rounded-lg border cursor-pointer transition-all ${className}`}
      style={{
        borderColor: props.checked ? colorScheme.foreground : hexToRgba(colorScheme.foreground, 0.2),
        backgroundColor: props.checked ? hexToRgba(colorScheme.foreground, 0.1) : 'transparent',
      }}
    >
      <input
        type="checkbox"
        className="w-4 h-4 rounded cursor-pointer"
        style={{ accentColor: colorScheme.foreground }}
        {...props}
      />
      {emoji && <span className={`text-base ${props.checked ? "" : "opacity-65"}`}>{emoji}</span>}
      <span className={`font-medium ${props.checked ? "" : "opacity-65"}`} style={{ color: colorScheme.foreground }}>{label}</span>
    </label>
  );
}
