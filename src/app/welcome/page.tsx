"use client";

import Link from "next/link";
import Button from "@/components/ui/Button";
import Logo from "@/components/ui/Logo";

export default function WelcomePage() {
  return (
    <div className="min-h-screen flex flex-col px-6 py-8">
      {/* Logo */}
      <div className="mb-16">
        <Logo size="md" />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col justify-center max-w-md">
        <h1 className="font-serif text-5xl font-bold mb-8 leading-tight">
          Hi!
          <br />
          Let's find you something special
        </h1>

        <p className="text-lg text-text-gray mb-4">
          We'll help you plan trips with interesting experiences.
        </p>

        <p className="text-lg text-text-gray mb-12">
          But first, let's learn what you are passionate about.
        </p>

        <Link href="/interests">
          <Button>Let's go →</Button>
        </Link>
      </div>
    </div>
  );
}
