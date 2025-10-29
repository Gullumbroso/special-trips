"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import { usePreferences } from "@/lib/context/PreferencesContext";
import { INTEREST_OPTIONS } from "@/lib/constants";
import { InterestType } from "@/lib/types";
import Link from "next/link";
import Logo from "@/components/ui/Logo";
import ClearDataButton from "@/components/ui/ClearDataButton";

export default function InterestsPage() {
  const router = useRouter();
  const { preferences, updateInterests } = usePreferences();
  const [selectedInterests, setSelectedInterests] = useState<InterestType[]>(preferences.interests);

  // Initialize with all interests selected by default if none are selected
  useEffect(() => {
    if (selectedInterests.length === 0) {
      setSelectedInterests(INTEREST_OPTIONS.map((opt) => opt.value));
    }
  }, [selectedInterests.length]);

  const handleToggle = (interest: InterestType) => {
    setSelectedInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest]
    );
  };

  const handleNext = () => {
    updateInterests(selectedInterests);
    router.push("/music_taste");
  };

  const isValid = selectedInterests.length >= 2;

  return (
    <div className="min-h-screen flex flex-col px-6 pt-3 pb-8">
      {/* Header with Logo and Clear Data Button */}
      <div className="flex justify-between items-center mb-12">
        <div className="-ml-2">
          <Logo size="md" />
        </div>
        <ClearDataButton />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col max-w-md">
        <h1 className="mb-4 leading-tight">
          What type of events you like?
        </h1>

        <p className="text-base font-normal text-black mb-8">Select at least two</p>

        <div className="space-y-3 mb-12">
          {INTEREST_OPTIONS.map((option) => (
            <Checkbox
              key={option.value}
              label={option.label}
              emoji={option.emoji}
              checked={selectedInterests.includes(option.value)}
              onChange={() => handleToggle(option.value)}
            />
          ))}
        </div>

        <div className="flex gap-3">
          <Link href="/welcome" className="flex-shrink-0">
            <Button variant="secondary" fullWidth={false} className="px-8">
              Back
            </Button>
          </Link>
          <Button onClick={handleNext} disabled={!isValid}>
            Next →
          </Button>
        </div>
      </div>
    </div>
  );
}
