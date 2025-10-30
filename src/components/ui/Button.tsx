"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";
import { useColorTheme } from "@/lib/context/ColorThemeContext";
import { hexToRgba } from "@/lib/colorScheme";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "secondary";
  fullWidth?: boolean;
}

export default function Button({
  children,
  variant = "primary",
  fullWidth = true,
  className = "",
  ...props
}: ButtonProps) {
  const { colorScheme } = useColorTheme();
  const baseStyles = "rounded-lg px-6 py-3 text-base font-bold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
  const widthStyles = fullWidth ? "w-full" : "";

  const getButtonStyles = () => {
    if (variant === "primary") {
      return {
        backgroundColor: colorScheme.foreground,
        color: "#FFFFFF",
      };
    } else {
      return {
        backgroundColor: hexToRgba(colorScheme.foreground, 0.08),
        color: colorScheme.foreground,
      };
    }
  };

  return (
    <button
      className={`${baseStyles} ${widthStyles} ${className}`}
      style={getButtonStyles()}
      {...props}
    >
      {children}
    </button>
  );
}
