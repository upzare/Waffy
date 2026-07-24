import React, { useEffect } from "react";
import { X } from "lucide-react";

interface WorkingDialogProps {
  open: boolean;
  onClose: () => void;
}

const WorkingDialog: React.FC<WorkingDialogProps> = ({ open, onClose }) => {
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-2000 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-[90%] max-w-lg rounded-lg border border-border bg-black/90 px-4 py-6 shadow-lg backdrop-blur-md"
        onClick={(event) => event.stopPropagation()}
        aria-modal="true"
      >
        <button
          type="button"
          className="absolute top-3 right-3 rounded-sm text-text-muted transition-colors hover:text-text-primary cursor-pointer"
          onClick={onClose}
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold leading-none tracking-tight text-text-primary">
            Agent is Working
          </h2>
          <p className="text-sm text-text-muted">
            Please wait for it to finish or stop it manually.
          </p>
        </div>
      </div>
    </div>
  );
};

export default WorkingDialog;
