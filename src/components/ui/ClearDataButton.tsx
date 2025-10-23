"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePreferences } from "@/lib/context/PreferencesContext";
import Dialog from "./Dialog";

export default function ClearDataButton() {
  const router = useRouter();
  const { resetPreferences } = usePreferences();
  const [showDialog, setShowDialog] = useState(false);

  const handleClearData = () => {
    resetPreferences();
    localStorage.removeItem('special-trips-generation-id');
    setShowDialog(false);
    router.push("/welcome");
  };

  return (
    <>
      <button
        onClick={() => setShowDialog(true)}
        className="text-sm text-gray-600 hover:text-black transition-colors font-normal px-3 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 active:bg-gray-200"
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
      />
    </>
  );
}
