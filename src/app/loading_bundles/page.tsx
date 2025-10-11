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

// Storage keys
const STORAGE_KEY_RESPONSE_ID = 'special-trips-response-id';
const STORAGE_KEY_CURSOR = 'special-trips-cursor';

// Retrieve OpenAI response ID from localStorage (if exists)
function getStoredResponseId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEY_RESPONSE_ID);
}

// Retrieve cursor from localStorage (if exists)
function getStoredCursor(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEY_CURSOR);
}

export default function LoadingBundlesPage() {
  const router = useRouter();
  const { preferences, bundles, setBundles, isHydrated } = usePreferences();
  const [reasoningSummaries, setReasoningSummaries] = useState<ReasoningSummary[]>([]);
  const hasInitiatedRef = useRef(false);
  const [responseId, setResponseId] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // Wait for PreferencesContext to hydrate from localStorage
    if (!isHydrated) {
      console.log("quiting due to hydration");
      return; 
    }

    // Prevent double-running in strict mode or if hydration triggers twice
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

        // SECOND: Check if we have a stored OpenAI response ID
        const storedResponseId = getStoredResponseId();
        const storedCursor = getStoredCursor();

        // If we have cursor but no responseId, something went wrong - clear cursor
        if (storedCursor && !storedResponseId) {
          console.warn("⚠️ Found cursor but no responseId - clearing cursor");
          localStorage.removeItem(STORAGE_KEY_CURSOR);
          // Start fresh
          console.log("🆕 Starting fresh generation");
          startStreaming(null, null);
          return;
        }

        if (storedResponseId) {
          console.log(`🔍 Found stored response ${storedResponseId}`);
          setResponseId(storedResponseId);
          if (storedCursor) {
            console.log(`📍 Found cursor: ${storedCursor.substring(0, 20)}...`);
            setCursor(storedCursor);
          }

          // Resume streaming from where we left off
          startStreaming(storedResponseId, storedCursor);
          return;
        }

        // If no stored response, start new generation
        console.log("🆕 Starting fresh generation");
        startStreaming(null, null);
      } catch (error) {
        console.error("Error initializing:", error);
        router.push("/error?message=" + encodeURIComponent("Failed to start generation"));
      }
    }

    function startStreaming(existingResponseId: string | null, existingCursor: string | null) {
      // Close any existing EventSource
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      console.log("🚀 Starting/resuming stream...", { existingResponseId, cursor: existingCursor?.substring(0, 20) });

      // Build URL with query params
      const params = new URLSearchParams();

      if (existingResponseId) {
        params.set('responseId', existingResponseId);
        if (existingCursor) {
          params.set('startingAfter', existingCursor);
        }
      } else {
        // New stream - include preferences
        console.log('[Client] Starting with preferences:', preferences);
        params.set('preferences', JSON.stringify(preferences));
      }

      const url = `/api/generate-bundles?${params.toString()}`;
      console.log('[Client] EventSource URL:', url.substring(0, 100) + '...');
      console.log('[Client] About to create EventSource...');

      const eventSource = new EventSource(url);
      console.log('[Client] EventSource created, readyState:', eventSource.readyState);
      eventSourceRef.current = eventSource;

      let currentResponseId = existingResponseId || '';
      let currentCursor = existingCursor || '';

      eventSource.onopen = () => {
        console.log('[Client] ✅ EventSource connection opened, readyState:', eventSource.readyState);
      };

      eventSource.onerror = (error) => {
        console.error('[Client] ❌ EventSource error, readyState:', eventSource.readyState, error);
        eventSource.close();
        eventSourceRef.current = null;

        // If we have a response ID and cursor, we can try to resume
        if (currentResponseId) {
          console.log("🔄 Connection dropped, will resume on next page load");
          // Don't automatically retry here - let user refresh to resume
          // This prevents rapid retry loops
        } else {
          console.error("❌ Failed to start generation, no response ID");
          router.push("/error?message=" + encodeURIComponent("Failed to start generation"));
        }
      };

      eventSource.addEventListener('response_id', (e) => {
        console.log('[Client] 📥 response_id event received');
        const data = JSON.parse(e.data);
        currentResponseId = data.responseId;
        currentCursor = data.cursor || '';

        console.log(`✅ Received response ID: ${currentResponseId}`);

        // Store the response ID and cursor
        localStorage.setItem(STORAGE_KEY_RESPONSE_ID, currentResponseId);
        if (currentCursor) {
          localStorage.setItem(STORAGE_KEY_CURSOR, currentCursor);
        }
        setResponseId(currentResponseId);
        setCursor(currentCursor);
      });

      eventSource.addEventListener('cursor', (e) => {
        const data = JSON.parse(e.data);
        currentCursor = data.cursor;

        // Update cursor in localStorage continuously
        if (currentCursor) {
          localStorage.setItem(STORAGE_KEY_CURSOR, currentCursor);
          setCursor(currentCursor);
        }
      });

      eventSource.addEventListener('summary', (e) => {
        const data = JSON.parse(e.data);
        console.log(`📝 Summary: ${data.text}`);

        // Update cursor
        if (data.cursor) {
          currentCursor = data.cursor;
          localStorage.setItem(STORAGE_KEY_CURSOR, currentCursor);
          setCursor(currentCursor);
        }

        // Add summary
        setReasoningSummaries(prev => [...prev, {
          id: `summary-${Date.now()}-${Math.random()}`,
          text: data.text,
          timestamp: Date.now(),
        }]);
      });

      eventSource.addEventListener('completed', async (e) => {
        const data = JSON.parse(e.data);
        console.log(`✅ Generation completed: ${data.responseId}`);

        // Update final cursor
        if (data.cursor) {
          localStorage.setItem(STORAGE_KEY_CURSOR, data.cursor);
        }

        eventSource.close();
        eventSourceRef.current = null;

        // Fetch final bundles
        await fetchCompletedBundles(data.responseId);
      });

      // Note: We already have eventSource.onerror defined above
    }

    async function fetchCompletedBundles(id: string) {
      try {
        console.log('[Client] Fetching completed bundles for:', id);
        const response = await fetch(`/api/openai/responses/${id}`);
        console.log('[Client] Fetch response status:', response.status);

        if (response.ok) {
          const data = await response.json();
          console.log('[Client] Response data:', data);

          if (data.bundles) {
            console.log('[Client] Found bundles, count:', data.bundles.length);
            // Clear cursor after successful completion
            localStorage.removeItem(STORAGE_KEY_CURSOR);
            localStorage.removeItem(STORAGE_KEY_RESPONSE_ID);

            setBundles(data.bundles);
            console.log('[Client] Navigating to /bundles');
            router.push("/bundles");
          } else {
            console.warn('[Client] No bundles in response data');
          }
        } else {
          console.error('[Client] Fetch failed with status:', response.status);
        }
      } catch (error) {
        console.error("Error fetching bundles:", error);
      }
    }

    initializeGeneration();

    // Cleanup on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      // Reset the ref so it can run again if we navigate back to this page
      hasInitiatedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated]); // Only re-run when hydration completes

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
          {reasoningSummaries.length > 0
            ? "We'll let you know once we're done."
            : "Generating your personalized trip bundles..."}
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
