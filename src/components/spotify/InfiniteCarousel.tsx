"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

interface InfiniteCarouselProps {
  items: Array<{ name: string; imageUrl: string }> | string[];
  direction: "left" | "right";
  type: "artist" | "genre";
  speed?: number; // Optional speed multiplier (default 1)
}

export default function InfiniteCarousel({ items, direction, type, speed = 1 }: InfiniteCarouselProps) {
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());

  // Use all items (no limit for smoother animation)
  const limitedItems = items;

  // Duplicate items exactly once for seamless loop
  const duplicatedItems = [...limitedItems, ...limitedItems];

  const handleImageLoad = (index: number) => {
    setLoadedImages((prev) => new Set(prev).add(index));
  };

  // Calculate animation duration based on number of items and speed multiplier
  // This ensures the animation completes showing all unique items before reset
  const animationDuration = (limitedItems.length * 0.8) / speed; // seconds

  return (
    <div className="relative overflow-hidden w-full">
      <div
        className="flex gap-[10px]"
        style={{
          animation: `scroll-${direction} ${animationDuration}s linear infinite`,
        }}
      >
        {duplicatedItems.map((item, index) => {
          if (type === "artist" && typeof item === "object") {
            const isLoaded = loadedImages.has(index % limitedItems.length);
            return (
              <div
                key={index}
                className={`flex-shrink-0 transition-opacity duration-[400ms] ${
                  isLoaded ? "opacity-100" : "opacity-0"
                }`}
              >
                <Image
                  src={item.imageUrl}
                  alt={item.name}
                  width={64}
                  height={64}
                  className="rounded-[6px] object-cover object-top w-16 h-16"
                  onLoad={() => handleImageLoad(index % limitedItems.length)}
                  loading="lazy"
                />
              </div>
            );
          } else if (type === "genre" && typeof item === "string") {
            return (
              <span
                key={index}
                className="bg-[#E0F0FF] text-[#1E90FF] px-3 py-1 rounded-full text-[14px] whitespace-nowrap flex-shrink-0"
              >
                {item}
              </span>
            );
          }
          return null;
        })}
      </div>

      <style jsx>{`
        @keyframes scroll-left {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }

        @keyframes scroll-right {
          0% {
            transform: translateX(-50%);
          }
          100% {
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}
