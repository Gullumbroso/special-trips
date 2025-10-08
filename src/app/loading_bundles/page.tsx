"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { usePreferences } from "@/lib/context/PreferencesContext";
import Logo from "@/components/ui/Logo";

interface ReasoningSummary {
  id: string;
  text: string;
  complete: boolean;
  timestamp: number;
}

export default function LoadingBundlesPage() {
  const router = useRouter();
  const { preferences, setBundles } = usePreferences();
  const [reasoningSummaries, setReasoningSummaries] = useState<ReasoningSummary[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasRequestedRef = useRef(false);

  useEffect(() => {
    // Prevent multiple requests (especially in React Strict Mode)
    if (hasRequestedRef.current) {
      console.log("⚠️ Preventing duplicate request to OpenAI");
      return;
    }
    hasRequestedRef.current = true;
    console.log("✅ Initiating single request to OpenAI");

    async function generateBundles() {
      try {
        const response = await fetch("/api/generate-bundles", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(preferences),
        });

        if (!response.ok) {
          router.push("/error?message=" + encodeURIComponent("Failed to generate bundles"));
          return;
        }

        if (!response.body) {
          router.push("/error?message=" + encodeURIComponent("No response body"));
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;

            const [eventLine, dataLine] = line.split("\n");
            if (!eventLine.startsWith("event:") || !dataLine?.startsWith("data:")) continue;

            const eventType = eventLine.slice(6).trim();
            const data = JSON.parse(dataLine.slice(5).trim());

            if (eventType === "debug") {
              // Log OpenAI prompt variables to browser console
              console.log("📤 OpenAI Prompt Variables:");
              console.log(data.promptVariables);
            } else if (eventType === "reasoning_summary") {
              const now = Date.now();
              const newId = `summary-${now}-${Math.random()}`;
              setReasoningSummaries((prev) => [...prev, {
                id: newId,
                text: data.text,
                complete: true,
                timestamp: now
              }]);
            } else if (eventType === "completed") {
              console.log("✅ COMPLETED EVENT RECEIVED:", data.bundles);
              // data.bundles is always an array from the API
              setBundles(data.bundles);
              router.push("/bundles");
            } else if (eventType === "error") {
              router.push("/error?message=" + encodeURIComponent(data.message || "Unknown error"));
            }
          }
        }
      } catch (error) {
        console.error("Error generating bundles:", error);
        router.push("/error?message=" + encodeURIComponent("Network error. Please check your connection."));
      }
    }

    generateBundles();
  }, [preferences, router, setBundles]);

  return (
    <div className="relative min-h-screen max-h-screen overflow-hidden flex flex-col px-6 py-8 bg-background">
      {/* Logo */}
      <div className="mb-12">
        <Logo size="md" />
      </div>

      {/* Main content */}
      <div className="max-w-2xl">
        <h1 className="font-serif text-[32px] font-semibold mb-3 leading-tight">
          Working on it...
        </h1>

        <p className="text-base font-medium text-text-gray mb-6">
          This might take a few minutes.
          <br />
          We&apos;ll let you know once we&apos;re done.
        </p>

        {/* Spinner */}
        <div className="mb-8">
          <svg width="36" height="36" viewBox="0 0 36 36" className="animate-spin">
            <circle cx="18" cy="18" r="16" fill="none" stroke="#B8F501" strokeWidth="2" opacity="0.3"/>
            <path d="M18 2 A16 16 0 0 1 34 18" fill="none" stroke="#B8F501" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>

        {/* Reasoning summaries */}
        {reasoningSummaries.length > 0 && (
          <div ref={containerRef} className="relative">
            <div className="flex flex-col-reverse gap-2">
              {reasoningSummaries.map((summary, arrayIndex) => {
                const trimmedText = summary.text.trim();
                let displayText: string;

                if (trimmedText.startsWith('**')) {
                  const match = trimmedText.match(/^\*\*([^*]+)\*\*/);
                  displayText = match ? match[1].trim() : trimmedText.replace(/\*\*/g, '').trim();
                } else {
                  displayText = trimmedText.replace(/\*\*/g, '');
                }

                const isLatest = arrayIndex === reasoningSummaries.length - 1;

                return (
                  <div
                    key={summary.id}
                    style={{
                      opacity: isLatest ? .85 : 0.25,
                      animation: isLatest ? 'fade-in-slide 0.5s cubic-bezier(0.4, 0, 0.2, 1)' : 'none'
                    }}
                  >
                    <p className="font-bold text-base text-foreground whitespace-pre-line">
                      {displayText}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Bottom gradient overlay */}
      <div className="fixed bottom-0 left-0 right-0" style={{ height: '512px' }}>
        <div className="w-full h-full bg-gradient-to-t from-background to-transparent pointer-events-none" />
      </div>
    </div>
  );
}
