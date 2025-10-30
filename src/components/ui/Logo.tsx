"use client";

import Link from "next/link";
import { useColorTheme } from "@/lib/context/ColorThemeContext";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  linkTo?: string;
  variant?: "default" | "type";
}

export default function Logo({ size = "md", linkTo, variant = "default" }: LogoProps) {
  const { colorScheme } = useColorTheme();

  // Both logo_type.svg and logo.svg: 123x19 (ratio ~6.47:1)
  const sizes = {
    sm: { height: 20, width: 129 },
    md: { height: 24, width: 155 },
    lg: { height: 28, width: 181 },
  };

  // Use logo_type.svg for navbar/header, regular logo.svg for other uses
  const logoSrc = variant === "type" ? "/logo_type.svg" : "/logo.svg";

  const logo = (
    <div
      style={{
        width: sizes[size].width,
        height: sizes[size].height,
        backgroundColor: colorScheme.foreground,
        maskImage: `url(${logoSrc})`,
        WebkitMaskImage: `url(${logoSrc})`,
        maskSize: 'contain',
        WebkitMaskSize: 'contain',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskPosition: 'center',
        WebkitMaskPosition: 'center',
        transition: 'background-color 0.2s ease',
      }}
    />
  );

  if (linkTo) {
    return (
      <Link href={linkTo} className="block">
        {logo}
      </Link>
    );
  }

  return logo;
}
