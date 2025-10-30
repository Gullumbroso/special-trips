"use client";

import { useEffect } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Logo from "@/components/ui/Logo";
import ClearDataButton from "@/components/ui/ClearDataButton";
import PageColorWrapper from "@/components/ui/PageColorWrapper";
import { COLOR_SCHEMES } from "@/lib/colorScheme";

export default function WelcomePage() {
  // Clear session ID when starting fresh
  useEffect(() => {
    localStorage.removeItem('special-trips-session-id');
  }, []);

  return (
    <PageColorWrapper colorScheme={COLOR_SCHEMES.WHITE_BLACK} className="flex flex-col px-6">
      {/* Header with Logo and Clear Data Button */}
      <div className="flex justify-between items-center h-16 mb-20">
        <div>
          <Logo size="md" variant="type" />
        </div>
        <ClearDataButton />
      </div>

      {/* Main Content */}
      <div className="flex flex-col max-w-md">
        <h1 className="mb-6">
          Hi!
          <br />
          Let&apos;s find you something special
        </h1>

        <p className="text-base font-normal mb-4">
          We&apos;ll help you plan trips with interesting experiences.
        </p>

        <p className="text-base font-normal mb-6">
          But first, let&apos;s learn what you are passionate about.
        </p>

        <Link href="/interests">
          <Button>Let&apos;s go →</Button>
        </Link>
      </div>
    </PageColorWrapper>
  );
}
