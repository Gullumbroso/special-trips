"use client";

import { ReactNode, useEffect } from "react";
import Button from "./Button";

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export default function Dialog({
  isOpen,
  onClose,
  title,
  description,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: DialogProps) {
  // Lock body scroll when dialog is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCancel = () => {
    onCancel?.();
    onClose();
  };

  const handleConfirm = () => {
    onConfirm?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={handleCancel}
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-lg p-6 max-w-sm w-full shadow-lg">
        <h2 className="mb-2">
          {title}
        </h2>

        {description && (
          <p className="text-text-gray mb-6">
            {description}
          </p>
        )}

        {children && (
          <div className="mb-6">
            {children}
          </div>
        )}

        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={handleCancel}
            className="flex-1"
          >
            {cancelLabel}
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            className="flex-1"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
