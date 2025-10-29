"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Button from "@/components/ui/Button";

function ErrorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorMessage = searchParams.get("message") || "Something went wrong while generating your trip bundles.";

  const handleTryAgain = () => {
    router.push("/loading_bundles");
  };

  const handleGoBack = () => {
    router.push("/other_details");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-8">
      <div className="text-center max-w-md">
        {/* Error Icon */}
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100">
            <span className="text-3xl">⚠️</span>
          </div>
        </div>

        <h1 className="mb-4">
          Oops! Something went wrong
        </h1>

        <p className="text-lg text-text-gray mb-8">
          {errorMessage}
        </p>

        <div className="space-y-3">
          <Button onClick={handleTryAgain}>
            Try Again
          </Button>
          <Button variant="secondary" onClick={handleGoBack}>
            ← Go Back
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function ErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    }>
      <ErrorContent />
    </Suspense>
  );
}
