import React, { useEffect } from "react";
import { Trash2, X } from "lucide-react";

interface ConfirmDeleteDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const ConfirmDeleteDialog: React.FC<ConfirmDeleteDialogProps> = ({
  open,
  onClose,
  onConfirm,
}) => {
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
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-delete-title"
        aria-describedby="confirm-delete-description"
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
          <h2
            id="confirm-delete-title"
            className="text-lg font-semibold leading-none tracking-tight text-text-primary"
          >
            Delete conversation
          </h2>
          <p id="confirm-delete-description" className="text-sm text-text-muted">
            Are you sure you want to delete this conversation? This cannot be undone.
          </p>
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              className="inline-flex h-9 cursor-pointer items-center justify-center rounded-md bg-white/12 px-4 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-white/18"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md bg-[#c43c3c] px-4 py-2 text-sm font-medium text-white shadow-xs transition-colors hover:bg-[#b33535]"
              onClick={onConfirm}
            >
              <Trash2 className="size-4" />
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDeleteDialog;
