import { browserAI, doesBrowserSupportBrowserAI } from "@browser-ai/core";
import type { BrowserAIChatSettings } from "@browser-ai/core";
import { wrapLanguageModel } from "ai";

export type BrowserAIStatus =
  "unsupported" | "unavailable" | "downloadable" | "downloading" | "available";

const SUPPORTED_LANGUAGES = ["de", "en", "es", "fr", "ja"] as const;

let downloadPromise: Promise<void> | undefined;
const downloadProgressListeners = new Set<(progress: number) => void>();

function emitDownloadProgress(progress: number) {
  for (const listener of downloadProgressListeners) {
    listener(progress);
  }
}

function getBrowserAILanguage(): (typeof SUPPORTED_LANGUAGES)[number] {
  const primary = navigator.language.split("-")[0]?.toLowerCase() ?? "en";
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(primary)
    ? (primary as (typeof SUPPORTED_LANGUAGES)[number])
    : "en";
}

function getBrowserAIModelSettings(): BrowserAIChatSettings {
  const language = getBrowserAILanguage();
  return {
    expectedInputs: [{ type: "text", languages: [language] }, { type: "image" }],
    expectedOutputs: [{ type: "text", languages: [language] }],
  };
}

export function createBrowserAIModel(signal?: AbortSignal) {
  return browserAI("text", { ...getBrowserAIModelSettings(), signal });
}

// One AI SDK stream can discover tools between model calls.
// The Browser AI adapter keeps the tool list from the start of each session.
export function createBrowserAISessionHooks() {
  let lifetime: AbortController | undefined;
  const close = () => {
    lifetime?.abort();
    lifetime = undefined;
  };

  return {
    prepareStep() {
      close();
      const controller = new AbortController();
      lifetime = controller;
      return {
        model: wrapLanguageModel({
          model: createBrowserAIModel(),
          middleware: {
            specificationVersion: "v4",
            transformParams: async ({ params }) => ({
              ...params,
              abortSignal: params.abortSignal
                ? AbortSignal.any([params.abortSignal, controller.signal])
                : controller.signal,
            }),
          },
        }),
      };
    },
    close,
  };
}

export function getBrowserAIModelLabel(): string {
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return "Aion Instruct";
  if (/Chrome\//.test(ua)) return "Gemini Nano";
  return "Built-in model";
}

export async function getBrowserAIStatus(
  model: ReturnType<typeof createBrowserAIModel> = createBrowserAIModel()
): Promise<BrowserAIStatus> {
  if (!doesBrowserSupportBrowserAI()) {
    return "unsupported";
  }

  try {
    return await model.availability();
  } catch {
    return "unavailable";
  }
}

async function downloadBrowserAIModel(): Promise<void> {
  const controller = new AbortController();
  const instance = createBrowserAIModel(controller.signal);
  const status = await getBrowserAIStatus(instance);

  if (status === "available") return;

  if (status === "downloadable" || status === "downloading") {
    try {
      await instance.createSessionWithProgress(emitDownloadProgress);
    } finally {
      controller.abort();
    }
    return;
  }

  if (status === "unavailable") {
    throw new Error("Browser AI model is unavailable on this device.");
  }

  throw new Error("Browser AI is not ready. Download it in extension settings.");
}

export async function ensureBrowserAIModelReady(
  onProgress?: (progress: number) => void
): Promise<void> {
  if (!doesBrowserSupportBrowserAI()) {
    throw new Error("Browser AI is not supported in this browser.");
  }

  if (onProgress) downloadProgressListeners.add(onProgress);

  try {
    downloadPromise ??= downloadBrowserAIModel().finally(() => {
      downloadPromise = undefined;
    });
    await downloadPromise;
  } finally {
    if (onProgress) downloadProgressListeners.delete(onProgress);
  }
}
