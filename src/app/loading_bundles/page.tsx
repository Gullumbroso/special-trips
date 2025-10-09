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

// Generate or retrieve session ID from localStorage
function getOrCreateSessionId(): string {
  const STORAGE_KEY = 'special-trips-session-id';

  if (typeof window === 'undefined') return '';

  let sessionId = localStorage.getItem(STORAGE_KEY);

  if (!sessionId) {
    sessionId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
    localStorage.setItem(STORAGE_KEY, sessionId);
  }

  return sessionId;
}

export default function LoadingBundlesPage() {
  const router = useRouter();
  const { preferences, bundles, setBundles } = usePreferences();
  const [reasoningSummaries, setReasoningSummaries] = useState<ReasoningSummary[]>([]);
  const hasInitiatedRef = useRef(false);
  const [sessionId] = useState(getOrCreateSessionId);

  useEffect(() => {
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

        if (!sessionId) {
          console.error("⚠️ No session ID available");
          return;
        }

        console.log(`🔍 Checking session ${sessionId}`);

        // Check if session already exists in Redis
        const checkResponse = await fetch(`/api/session/${sessionId}`);

        if (checkResponse.ok) {
          const sessionData = await checkResponse.json();
          console.log(`📊 Session status: ${sessionData.status}`);

          // Case 1: Session already complete
          if (sessionData.status === 'complete' && sessionData.bundles) {
            console.log("✅ Session complete, loading bundles");
            // Save to localStorage via context
            setBundles(sessionData.bundles);
            router.push("/bundles");
            return;
          }

          // Case 2: Session has error
          if (sessionData.status === 'error') {
            console.error("❌ Session error:", sessionData.error);
            router.push("/error?message=" + encodeURIComponent(sessionData.error || "Unknown error"));
            return;
          }

          // Case 3: Session is generating - restore summaries and poll
          if (sessionData.status === 'generating') {
            console.log(`🔄 Resuming session with ${sessionData.summaries?.length || 0} summaries`);

            if (sessionData.summaries && sessionData.summaries.length > 0) {
              const restored = sessionData.summaries.map((text: string, index: number) => ({
                id: `restored-${index}`,
                text,
                timestamp: Date.now() - (sessionData.summaries.length - index) * 1000,
              }));
              setReasoningSummaries(restored);
            }

            // Start polling
            startPolling();
            return;
          }

          // Case 4: Session not found - create new one
          if (sessionData.status === 'not_found') {
            console.log("🆕 Creating new session");
            await startNewGeneration();
            return;
          }
        } else {
          // Failed to check session - start new
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
            sessionId,
            preferences,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to start generation");
        }

        console.log("✅ Generation started");

        // Start polling
        startPolling();
      } catch (error) {
        console.error("Error starting generation:", error);
        router.push("/error?message=" + encodeURIComponent("Failed to start generation"));
      }
    }

    function startPolling() {
      console.log("⏳ Starting polling...");

      const pollInterval = setInterval(async () => {
        try {
          const pollResponse = await fetch(`/api/session/${sessionId}`);

          if (pollResponse.ok) {
            const pollData = await pollResponse.json();

            // Update summaries if new ones arrived
            if (pollData.summaries && pollData.summaries.length > 0) {
              const newSummaries = pollData.summaries.map((text: string, index: number) => ({
                id: `poll-${index}`,
                text,
                timestamp: Date.now() - (pollData.summaries.length - index) * 1000,
              }));
              setReasoningSummaries(newSummaries);
            }

            // Check completion
            if (pollData.status === 'complete' && pollData.bundles) {
              console.log("✅ Generation complete!");
              clearInterval(pollInterval);
              // Save bundles to localStorage via context
              setBundles(pollData.bundles);
              router.push("/bundles");
            } else if (pollData.status === 'error') {
              console.error("❌ Generation error:", pollData.error);
              clearInterval(pollInterval);
              router.push("/error?message=" + encodeURIComponent(pollData.error || "Unknown error"));
            }
          }
        } catch (error) {
          console.error("Polling error:", error);
        }
      }, 2000); // Poll every 2 seconds

      // Cleanup after 15 minutes max
      setTimeout(() => {
        clearInterval(pollInterval);
        console.log("⏰ Polling timeout");
      }, 15 * 60 * 1000);
    }

    initializeGeneration();
  }, [preferences, router, setBundles, sessionId, bundles]);

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
