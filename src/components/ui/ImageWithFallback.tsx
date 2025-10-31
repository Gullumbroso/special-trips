"use client";

import { useState, ReactNode } from "react";

interface ImageWithFallbackProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  alt: string;
  fallback?: ReactNode;
}

export default function ImageWithFallback({ src, alt, fallback, ...props }: ImageWithFallbackProps) {
  const [error, setError] = useState(false);

  if (error || !src) {
    return <>{fallback || (
      <div className="w-full h-full bg-gradient-to-br from-secondary/20 to-primary/20 flex items-center justify-center min-h-[300px]">
        <span className="text-4xl">🌍</span>
      </div>
    )}</>;
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setError(true)}
      {...props}
    />
  );
}
