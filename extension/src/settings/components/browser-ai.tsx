import React, { useCallback, useEffect, useState } from "react";
import {
  ensureBrowserAIModelReady,
  getBrowserAIModelLabel,
  getBrowserAIStatus,
  type BrowserAIStatus,
} from "@/lib/llm/browser-ai";
import { BROWSER_AI_PROVIDER } from "../providers";
import styles from "css/settings/browser-ai.module.css";

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
  if (status === "available") return `${styles.statusBadge} ${styles.statusBadgeReady}`;
  if (status === "unsupported" || status === "unavailable") {
    return `${styles.statusBadge} ${styles.statusBadgeError}`;
  }
  return `${styles.statusBadge} ${styles.statusBadgeWarning}`;
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
    <div className={styles.browserAiCard}>
      <div className={styles.browserAiHeader}>
        <div className={styles.browserAiTitleGroup}>
          <h3 className={styles.browserAiTitle}>{BROWSER_AI_PROVIDER.label}</h3>
          <p className={styles.browserAiDescription}>{BROWSER_AI_PROVIDER.description}</p>
        </div>
        <span className={getStatusBadgeClass(status)}>{STATUS_LABELS[status]}</span>
      </div>

      <div className={styles.browserAiBody}>
        {status !== "unsupported" && status !== "unavailable" && (
          <p className={styles.modelLabel}>
            Detected model: <strong>{getBrowserAIModelLabel()}</strong>
          </p>
        )}

        {status === "unsupported" && (
          <p className={styles.note}>
            Your browser does not support the built-in Prompt API. Use Chrome with Gemini Nano or
            Edge with the Prompt API flag enabled.
          </p>
        )}

        {status === "unavailable" && (
          <p className={styles.note}>
            Browser AI is supported but the on-device model is unavailable on this device. Check
            available storage and system requirements, then try again.
          </p>
        )}

        {status === "available" && (
          <p className={styles.note}>
            The local model is ready. Use it as much as you want, it's free.
          </p>
        )}

        {error && <p className={`${styles.note} ${styles.noteError}`}>{error}</p>}

        {(status === "downloadable" || status === "downloading") && (
          <button
            type="button"
            className={styles.downloadButton}
            onClick={handleDownload}
            disabled={isDownloading}
          >
            {isDownloading ? "Downloading…" : "Download model"}
          </button>
        )}

        {showProgress && (
          <div className={styles.progressGroup}>
            <div className={styles.progressTrack}>
              <div className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
            </div>
            <p className={styles.progressLabel}>{progressPercent}% complete</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BrowserAISection;
