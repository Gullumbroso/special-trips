"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { usePreferences } from "@/lib/context/PreferencesContext";
import Logo from "@/components/ui/Logo";
import EmptyBundlesState from "@/components/EmptyBundlesState";

// Storage key for generation ID
const STORAGE_KEY_GENERATION_ID = 'special-trips-generation-id';

// Polling interval in milliseconds
const POLL_INTERVAL_MS = 25000; // 25 seconds

// Generic loading messages to display
const LOADING_MESSAGES = [
  "Analyzing your preferences...",
  "Searching for the best events...",
  "Crafting your perfect bundles...",
  "Finding hidden gems...",
  "Personalizing your experience...",
  "Almost there...",
];

// Retrieve generation ID from localStorage (if exists)
function getStoredGenerationId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEY_GENERATION_ID);
}

export default function LoadingBundlesPage() {
  const router = useRouter();
  const { preferences, bundles, setBundles, isHydrated } = usePreferences();
  const hasInitiatedRef = useRef(false);
  const [showEmptyState, setShowEmptyState] = useState(false);
  const startTimeRef = useRef<number | null>(null);
  const [isResuming, setIsResuming] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [loadingMessage, setLoadingMessage] = useState(LOADING_MESSAGES[0]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const consecutiveFailuresRef = useRef(0);
  const MAX_CONSECUTIVE_FAILURES = 3;

  useEffect(() => {
    // Wait for PreferencesContext to hydrate from localStorage
    if (!isHydrated) {
      console.log("[Client] Waiting for hydration");
      return;
    }

    // Prevent double-running in strict mode
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

        // SECOND: Check if we have a stored generation ID
        const storedGenerationId = getStoredGenerationId();

        if (storedGenerationId) {
          console.log(`🔍 Found stored generation ${storedGenerationId}`);
          setIsResuming(true);

          // Start timer for resumed session
          if (!startTimeRef.current) {
            startTimeRef.current = Date.now();
            console.log('⏱️ Client timer started (resuming)');
          }

          // Start polling immediately for resumed sessions
          startPolling(storedGenerationId, true);
          return;
        }

        // THIRD: No stored generation, start new one
        console.log("🆕 Starting fresh generation");
        startNewGeneration();
      } catch (error) {
        console.error("Error initializing:", error);
        router.push("/error?message=" + encodeURIComponent("Failed to start generation"));
      }
    }

    async function startNewGeneration() {
      try {
        // Start timer
        if (!startTimeRef.current) {
          startTimeRef.current = Date.now();
          console.log('⏱️ Client timer started');
        }

        console.log("[Client] Calling POST /api/generations");

        // Start generation (this will block on server until complete)
        const response = await fetch('/api/generations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ preferences }),
        });

        if (!response.ok) {
          throw new Error('Failed to start generation');
        }

        const data = await response.json();
        console.log(`[Client] Generation started: ${data.generationId}, status: ${data.status}`);

        // Store generation ID
        localStorage.setItem(STORAGE_KEY_GENERATION_ID, data.generationId);

        // If already completed (fast response), handle immediately
        if (data.status === 'completed') {
          handleCompletion(data.bundles);
          return;
        }

        if (data.status === 'failed') {
          console.error('[Client] Generation failed:', data.error);
          router.push("/error?message=" + encodeURIComponent(data.error || 'Generation failed'));
          return;
        }

        // Start polling for status with initial delay to avoid race condition
        startPolling(data.generationId, false);
      } catch (error) {
        console.error('[Client] Failed to start generation:', error);
        router.push("/error?message=" + encodeURIComponent("Failed to start generation"));
      }
    }

    function startPolling(genId: string, pollImmediately: boolean = true) {
      console.log(`[Client] Starting polling for generation ${genId} (every ${POLL_INTERVAL_MS}ms)`);

      if (pollImmediately) {
        // Poll immediately for resumed sessions
        pollStatus(genId);
      } else {
        // For new generations, wait 10 seconds before first poll to avoid race condition
        // This gives Inngest time to create the DB record
        setTimeout(() => {
          pollStatus(genId);
        }, 10000);
      }

      // Then poll every 25 seconds
      pollIntervalRef.current = setInterval(() => {
        pollStatus(genId);
      }, POLL_INTERVAL_MS);
    }

    async function pollStatus(genId: string) {
      try {
        const response = await fetch(`/api/generations/${genId}`);

        if (!response.ok) {
          consecutiveFailuresRef.current += 1;
          console.error(`[Client] Failed to fetch generation status (${response.status}), attempt ${consecutiveFailuresRef.current}/${MAX_CONSECUTIVE_FAILURES}`);

          // Show error message to user
          if (consecutiveFailuresRef.current === 1) {
            setErrorMessage(`Polling failed with id: ${genId}, trying again...`);
          } else if (consecutiveFailuresRef.current === 2) {
            setErrorMessage(`Polling failed with id: ${genId}, trying one last time...`);
          } else if (consecutiveFailuresRef.current >= MAX_CONSECUTIVE_FAILURES) {
            stopPolling();
            localStorage.removeItem(STORAGE_KEY_GENERATION_ID);
            router.push("/error?message=" + encodeURIComponent(`Failed to fetch generation status after ${MAX_CONSECUTIVE_FAILURES} attempts. Status: ${response.status}`));
          }
          return;
        }

        const data = await response.json();
        console.log(`[Client] Poll result - Status: ${data.status}`);

        // Reset failure counter on successful fetch
        consecutiveFailuresRef.current = 0;
        setErrorMessage(null);

        // Rotate loading message on each poll
        setLoadingMessage(LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)]);

        // Handle completion
        if (data.status === 'completed') {
          stopPolling();

          // Log total client-side time
          if (startTimeRef.current) {
            const totalTime = Date.now() - startTimeRef.current;
            const minutes = Math.floor(totalTime / 60000);
            const seconds = ((totalTime % 60000) / 1000).toFixed(2);
            console.log(`⏱️ Client-side total duration: ${minutes}m ${seconds}s`);
          }

          handleCompletion(data.bundles);
        }

        // Handle failure
        if (data.status === 'failed') {
          stopPolling();
          console.error('[Client] Generation failed:', data.error);
          router.push("/error?message=" + encodeURIComponent(data.error || 'Generation failed'));
        }
      } catch (error) {
        consecutiveFailuresRef.current += 1;
        console.error(`[Client] Error polling status:`, error, `attempt ${consecutiveFailuresRef.current}/${MAX_CONSECUTIVE_FAILURES}`);

        // Show error message to user
        if (consecutiveFailuresRef.current === 1) {
          setErrorMessage(`Polling failed with id: ${genId}, trying again...`);
        } else if (consecutiveFailuresRef.current === 2) {
          setErrorMessage(`Polling failed with id: ${genId}, trying one last time...`);
        } else if (consecutiveFailuresRef.current >= MAX_CONSECUTIVE_FAILURES) {
          stopPolling();
          localStorage.removeItem(STORAGE_KEY_GENERATION_ID);
          const errorMsg = error instanceof Error ? error.message : 'Network error';
          router.push("/error?message=" + encodeURIComponent(`Failed to poll generation status after ${MAX_CONSECUTIVE_FAILURES} attempts: ${errorMsg}`));
        }
      }
    }

    function stopPolling() {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }

    function handleCompletion(bundlesData: unknown) {
      // Clear generation ID from localStorage
      localStorage.removeItem(STORAGE_KEY_GENERATION_ID);

      if (!bundlesData || !Array.isArray(bundlesData) || bundlesData.length === 0) {
        console.log('[Client] No bundles found, showing empty state');
        setShowEmptyState(true);
      } else {
        console.log(`[Client] ✅ Received ${bundlesData.length} bundles, saving and navigating`);
        setBundles(bundlesData);
        router.push("/bundles");
      }
    }

    initializeGeneration();

    // Cleanup on unmount
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      // DON'T reset hasInitiatedRef - this prevents duplicate generations in React Strict Mode
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated]); // Only re-run when hydration completes

  // Show empty state if no bundles were found
  if (showEmptyState) {
    return <EmptyBundlesState />;
  }

  return (
    <div className="relative min-h-screen max-h-screen overflow-hidden flex flex-col px-6 bg-background">
      {/* Logo */}
      <div className="h-16 flex items-center mb-12 -ml-2">
        <Logo size="md" variant="type" />
      </div>

      {/* Main content */}
      <div className="max-w-2xl">
        <h1 className="mb-3 leading-tight">
          {isResuming ? "Still on it..." : "Working on it..."}
        </h1>

        <p className="text-base font-normal text-black mb-6">
          This might take a few minutes.
          <br />
          We&apos;ll let you know once we&apos;re done.
        </p>

        {/* Spinner */}
        <div className="mb-8">
          <svg width="36" height="36" viewBox="0 0 36 36" className="animate-spin">
            <circle cx="18" cy="18" r="16" fill="none" stroke="#000000" strokeWidth="4" opacity="0.25"/>
            <path d="M18 2 A16 16 0 0 1 34 18" fill="none" stroke="#000000" strokeWidth="4" strokeLinecap="round"/>
          </svg>
        </div>

        {/* Loading message */}
        <div className="relative">
          <p className="font-bold text-base text-foreground opacity-85">
            {loadingMessage}
          </p>
          {/* Error message for debugging */}
          {errorMessage && (
            <p className="mt-4 text-sm text-red-600 font-mono">
              {errorMessage}
            </p>
          )}
        </div>
      </div>

      {/* Bottom gradient */}
      <div className="fixed bottom-0 left-0 right-0" style={{ height: '512px' }}>
        <div className="w-full h-full bg-gradient-to-t from-background to-transparent pointer-events-none" />
      </div>
    </div>
  );
}
