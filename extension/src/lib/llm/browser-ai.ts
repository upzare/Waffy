import { browserAI, doesBrowserSupportBrowserAI } from "@browser-ai/core";
import type { BrowserAIChatSettings } from "@browser-ai/core";
import type { LanguageModel } from "ai";

export type BrowserAIStatus =
  "unsupported" | "unavailable" | "downloadable" | "downloading" | "available";

type RawAvailability = "unavailable" | "downloadable" | "downloading" | "available";

const SUPPORTED_LANGUAGES = ["de", "en", "es", "fr", "ja"] as const;

let downloadPromise: Promise<LanguageModel> | null = null;

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

function createBrowserAIModel() {
  return browserAI("text", getBrowserAIModelSettings());
}

export function getBrowserAIModelLabel(): string {
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return "Phi Mini";
  if (/Chrome\//.test(ua)) return "Gemini Nano";
  return "Built-in model";
}

async function getAvailability(
  model: ReturnType<typeof createBrowserAIModel> = createBrowserAIModel()
): Promise<BrowserAIStatus> {
  if (!doesBrowserSupportBrowserAI()) {
    return "unsupported";
  }

  try {
    return (await model.availability()) as RawAvailability;
  } catch {
    return "unavailable";
  }
}

export async function getBrowserAIStatus(): Promise<BrowserAIStatus> {
  return getAvailability();
}

export async function ensureBrowserAIModelReady(
  onProgress?: (progress: number) => void
): Promise<LanguageModel> {
  if (!doesBrowserSupportBrowserAI()) {
    throw new Error("Browser AI is not supported in this browser.");
  }

  if (downloadPromise) {
    return downloadPromise;
  }

  downloadPromise = (async () => {
    const instance = createBrowserAIModel();
    const status = await getAvailability(instance);

    if (status === "available") {
      return instance;
    }

    if (status === "downloadable" || status === "downloading") {
      await instance.createSessionWithProgress(onProgress);
      return instance;
    }

    if (status === "unavailable") {
      throw new Error("Browser AI model is unavailable on this device.");
    }

    throw new Error("Browser AI is not ready. Download it in extension settings.");
  })().finally(() => {
    downloadPromise = null;
  });

  return downloadPromise;
}
