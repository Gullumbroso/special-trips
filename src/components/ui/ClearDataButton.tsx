"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePreferences } from "@/lib/context/PreferencesContext";
import { useColorTheme } from "@/lib/context/ColorThemeContext";
import { hexToRgba } from "@/lib/colorScheme";
import Dialog from "./Dialog";

export default function ClearDataButton() {
  const router = useRouter();
  const { resetPreferences } = usePreferences();
  const { colorScheme } = useColorTheme();
  const [showDialog, setShowDialog] = useState(false);

  const handleClearData = () => {
    resetPreferences();
    localStorage.clear();
    setShowDialog(false);
    router.push("/welcome");
  };

  return (
    <>
      <button
        onClick={() => setShowDialog(true)}
        className="text-sm transition-opacity font-normal px-3 py-1.5 rounded-md hover:opacity-70 active:opacity-60"
        style={{
          color: colorScheme.foreground,
          backgroundColor: hexToRgba(colorScheme.foreground, 0.1),
        }}
        aria-label="Clear data"
      >
        Clear data
      </button>

      <Dialog
        isOpen={showDialog}
        onClose={() => setShowDialog(false)}
        title="Clear all data?"
        description="This will delete all your preferences and start over. This action cannot be undone."
        confirmLabel="Clear data"
        cancelLabel="Cancel"
        onConfirm={handleClearData}
        backgroundColor={colorScheme.background}
        foregroundColor={colorScheme.foreground}
      />
    </>
  );
}
