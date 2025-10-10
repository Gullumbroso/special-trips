"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { usePreferences } from "@/lib/context/PreferencesContext";
import Logo from "@/components/ui/Logo";

interface ReasoningSummary {
  id: string;
  text: string;
  timestamp: number;
}

// Generate or retrieve OpenAI response ID from localStorage
function getOrCreateResponseId(): string {
  const STORAGE_KEY = 'special-trips-response-id';

  if (typeof window === 'undefined') return '';

  let responseId = localStorage.getItem(STORAGE_KEY);

  if (!responseId) {
    responseId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
    localStorage.setItem(STORAGE_KEY, responseId);
  }

  return responseId;
}

export default function LoadingBundlesPage() {
  const router = useRouter();
  const { preferences, bundles, setBundles, isHydrated } = usePreferences();
  const [reasoningSummaries, setReasoningSummaries] = useState<ReasoningSummary[]>([]);
  const hasInitiatedRef = useRef(false);
  const [responseId] = useState(getOrCreateResponseId);

  useEffect(() => {
    // Wait for PreferencesContext to hydrate from localStorage
    if (!isHydrated) return;

    if (hasInitiatedRef.current) return;
    hasInitiatedRef.current = true;

    async function initializeGeneration() {
      try {
        // FIRST: Check if we already have bundles in localStorage (via PreferencesContext)
        if (bundles && bundles.length > 0) {
          console.log("✅ Bundles already cached, navigating to /bundles");
          router.push("/bundles");
          return;
        }

        if (!responseId) {
          console.error("⚠️ No response ID available");
          return;
        }

        console.log(`🔍 Checking OpenAI response ${responseId}`);

        // Check if OpenAI response already exists
        const checkResponse = await fetch(`/api/openai/responses/${responseId}`);

        if (checkResponse.ok) {
          const responseData = await checkResponse.json();
          console.log(`📊 Response status: ${responseData.status}`);

          // Case 1: Response already completed
          if (responseData.status === 'completed' && responseData.bundles) {
            console.log("✅ Response complete, loading bundles");
            // Save to localStorage via context
            setBundles(responseData.bundles);
            router.push("/bundles");
            return;
          }

          // Case 2: Response failed
          if (responseData.status === 'failed') {
            console.error("❌ Response failed:", responseData.error);
            router.push("/error?message=" + encodeURIComponent(responseData.error || "Unknown error"));
            return;
          }

          // Case 3: Response is in progress or queued - restore summaries and poll
          if (responseData.status === 'in_progress' || responseData.status === 'queued') {
            console.log(`🔄 Resuming response (${responseData.status}) with ${responseData.summaries?.length || 0} summaries`);

            if (responseData.summaries && responseData.summaries.length > 0) {
              const restored = responseData.summaries.map((text: string, index: number) => ({
                id: `restored-${index}`,
                text,
                timestamp: Date.now() - (responseData.summaries.length - index) * 1000,
              }));
              setReasoningSummaries(restored);
            }

            // Start polling
            startPolling();
            return;
          }
        } else {
          // Failed to check response - start new
          console.log("🆕 Starting fresh generation");
          await startNewGeneration();
        }
      } catch (error) {
        console.error("Error initializing:", error);
        router.push("/error?message=" + encodeURIComponent("Failed to start generation"));
      }
    }

    async function startNewGeneration() {
      try {
        const response = await fetch("/api/generate-bundles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            preferences,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to start generation");
        }

        const data = await response.json();
        const newResponseId = data.responseId;

        console.log(`✅ Generation started with response ID: ${newResponseId}`);

        // Store the new response ID from OpenAI
        localStorage.setItem('special-trips-response-id', newResponseId);

        // Start polling
        startPolling();
      } catch (error) {
        console.error("Error starting generation:", error);
        router.push("/error?message=" + encodeURIComponent("Failed to start generation"));
      }
    }

    function startPolling() {
      console.log("⏳ Starting polling...");

      // Get the current responseId from state or localStorage
      const currentResponseId = responseId || localStorage.getItem('special-trips-response-id');

      if (!currentResponseId) {
        console.error("⚠️ No response ID available for polling");
        return;
      }

      const pollInterval = setInterval(async () => {
        try {
          const pollResponse = await fetch(`/api/openai/responses/${currentResponseId}`);

          if (pollResponse.ok) {
            const pollData = await pollResponse.json();

            // Update summaries if new ones arrived
            if (pollData.summaries && pollData.summaries.length > 0) {
              setReasoningSummaries(prev => {
                // Only update if we have NEW summaries
                if (pollData.summaries.length > prev.length) {
                  // Keep existing summaries with their IDs, add only new ones
                  const newItems = pollData.summaries.slice(prev.length).map((text: string, index: number) => ({
                    id: `summary-${prev.length + index}-${Date.now()}`,
                    text,
                    timestamp: Date.now(),
                  }));
                  return [...prev, ...newItems];
                }
                return prev; // No new summaries, don't trigger re-render
              });
            }

            // Check completion
            if (pollData.status === 'completed' && pollData.bundles) {
              console.log("✅ Generation complete!");
              clearInterval(pollInterval);
              // Save bundles to localStorage via context
              setBundles(pollData.bundles);
              router.push("/bundles");
            } else if (pollData.status === 'failed') {
              console.error("❌ Generation failed:", pollData.error);
              clearInterval(pollInterval);
              router.push("/error?message=" + encodeURIComponent(pollData.error || "Unknown error"));
            }
          }
        } catch (error) {
          console.error("Polling error:", error);
        }
      }, 5000); // Poll every 5 seconds

      // Cleanup after 15 minutes max
      setTimeout(() => {
        clearInterval(pollInterval);
        console.log("⏰ Polling timeout");
      }, 15 * 60 * 1000);
    }

    initializeGeneration();
  }, [preferences, router, setBundles, responseId, bundles, isHydrated]);

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
          <div className="relative">
            <div className="flex flex-col-reverse gap-2">
              {reasoningSummaries.map((summary, arrayIndex) => {
                // Title is already extracted in the Inngest worker before sending to Redis
                const displayText = summary.text.trim();
                const isLatest = arrayIndex === reasoningSummaries.length - 1;

                return (
                  <div
                    key={summary.id}
                    style={{
                      opacity: isLatest ? 0.85 : 0.25,
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

      {/* Bottom gradient */}
      <div className="fixed bottom-0 left-0 right-0" style={{ height: '512px' }}>
        <div className="w-full h-full bg-gradient-to-t from-background to-transparent pointer-events-none" />
      </div>
    </div>
  );
}
