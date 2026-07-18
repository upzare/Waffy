import React, { useCallback, useEffect, useState } from "react";
import {
  ensureBrowserAIModelReady,
  getBrowserAIModelLabel,
  getBrowserAIStatus,
  type BrowserAIStatus,
} from "@/lib/llm/browser-ai";
import { BROWSER_AI_PROVIDER } from "../providers";

interface BrowserAISectionProps {
  onStatusChange?: (status: BrowserAIStatus) => void;
}

const STATUS_LABELS: Record<BrowserAIStatus, string> = {
  unsupported: "Unsupported",
  unavailable: "Unavailable",
  downloadable: "Ready to download",
  downloading: "Downloading",
  available: "Ready",
};

function getStatusBadgeClass(status: BrowserAIStatus): string {
  const base = "shrink-0 rounded border px-1.5 py-0.5 text-xs font-medium";
  if (status === "available") {
    return `${base} border-green-border bg-green-dim text-green`;
  }
  if (status === "unsupported" || status === "unavailable") {
    return `${base} border-[rgba(248,113,113,0.35)] bg-[rgba(248,113,113,0.08)] text-[#f87171]`;
  }
  return `${base} border-[rgba(245,166,35,0.35)] bg-[rgba(245,166,35,0.08)] text-[#f5a623]`;
}

const BrowserAISection: React.FC<BrowserAISectionProps> = ({ onStatusChange }) => {
  const [status, setStatus] = useState<BrowserAIStatus>("unavailable");
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    const nextStatus = await getBrowserAIStatus();
    setStatus(nextStatus);
    onStatusChange?.(nextStatus);
    return nextStatus;
  }, [onStatusChange]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const handleDownload = async () => {
    setIsDownloading(true);
    setError(null);
    setDownloadProgress(0);

    try {
      await ensureBrowserAIModelReady((progress) => {
        setDownloadProgress(progress);
        setStatus("downloading");
      });
      await refreshStatus();
    } catch (downloadError) {
      const message =
        downloadError instanceof Error ? downloadError.message : "Failed to download Browser AI.";
      setError(message);
      await refreshStatus();
    } finally {
      setIsDownloading(false);
    }
  };

  const showProgress = isDownloading || status === "downloading";
  const progressPercent = Math.round(downloadProgress * 100);

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-md border border-border bg-surface-2 px-4 py-4.5 sm:px-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold leading-tight text-text-primary">
            {BROWSER_AI_PROVIDER.label}
          </h3>
          <p className="mt-0.5 text-xs leading-snug text-text-muted">
            {BROWSER_AI_PROVIDER.description}
          </p>
        </div>
        <span className={getStatusBadgeClass(status)}>{STATUS_LABELS[status]}</span>
      </div>

      <div className="flex flex-col gap-3">
        {status !== "unsupported" && status !== "unavailable" && (
          <p className="text-sm leading-snug text-text-secondary [&_strong]:font-semibold [&_strong]:text-text-primary">
            Detected model: <strong>{getBrowserAIModelLabel()}</strong>
          </p>
        )}

        {status === "unsupported" && (
          <p className="text-xs leading-snug text-text-muted">
            Your browser does not support the built-in Prompt API. Use a Chromium browser with
            on-device AI (Chrome with Gemini Nano, Edge with the Prompt API flag, or Brave when
            supported).
          </p>
        )}

        {status === "unavailable" && (
          <p className="text-xs leading-snug text-text-muted">
            Browser AI is supported but the on-device model is unavailable on this device. Check
            available storage and system requirements, then try again.
          </p>
        )}

        {status === "available" && (
          <p className="text-xs leading-snug text-text-muted">
            The local model is ready. Use it as much as you want, it's free.
          </p>
        )}

        {error && <p className="text-xs leading-snug text-[#f87171]">{error}</p>}

        {(status === "downloadable" || status === "downloading") && (
          <button
            type="button"
            className="self-start rounded-sm border border-border-strong bg-white/6 px-3.5 py-2 text-sm font-medium text-text-primary transition-colors duration-150 hover:enabled:border-green-border hover:enabled:bg-white/10 disabled:cursor-not-allowed disabled:opacity-55"
            onClick={handleDownload}
            disabled={isDownloading}
          >
            {isDownloading ? "Downloading…" : "Download model"}
          </button>
        )}

        {showProgress && (
          <div className="flex flex-col gap-1.5">
            <div
              role="progressbar"
              aria-valuenow={progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Model download progress"
              className="h-1.5 w-full overflow-hidden rounded-full bg-white/6"
            >
              <div
                className="h-full rounded-full bg-green transition-[width] duration-200"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-xs leading-tight text-text-muted">{progressPercent}% complete</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BrowserAISection;
