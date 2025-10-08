"use client";

import { useEffect } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Logo from "@/components/ui/Logo";

export default function WelcomePage() {
  // Clear session ID when starting fresh
  useEffect(() => {
    localStorage.removeItem('special-trips-session-id');
  }, []);

  return (
    <div className="min-h-screen flex flex-col px-6 pt-4">
      {/* Logo */}
      <div className="mb-20 -ml-2">
        <Logo size="md" />
      </div>

      {/* Main Content */}
      <div className="flex flex-col max-w-md">
        <h1 className="font-serif text-[32px] font-semibold mb-6 leading-tight">
          Hi!
          <br />
          Let&apos;s find you something special
        </h1>

        <p className="text-base font-medium text-text-gray mb-4">
          We&apos;ll help you plan trips with interesting experiences.
        </p>

        <p className="text-base font-medium text-text-gray mb-6">
          But first, let&apos;s learn what you are passionate about.
        </p>

        <Link href="/interests">
          <Button>Let&apos;s go →</Button>
        </Link>
      </div>
    </div>
  );
}
