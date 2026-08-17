import Browser from "webextension-polyfill";
import { DEFAULT_MODELS } from "./llm/model";
import { DEFAULT_FEATURES } from "./features";
import type { ApiKeys, AppSettings, CustomApiConfig, Settings } from "@/types";

export const initClient = async () => {
  const localStorage = await Browser.storage.local.get();
  if (!localStorage.client) {
    const manifest = Browser.runtime.getManifest() as { version: string; version_name?: string };
    Browser.storage.local.set({
      client: JSON.stringify({
        client_id: crypto.randomUUID(),
        package: manifest.version_name ?? manifest.version,
        version: manifest.version,
        os: navigator.platform,
        browser: navigator.userAgent,
      }),
    });
  }
};

export const DEFAULT_PINNED_PROMPTS = [
  "What is in my screen",
  "Fill out this form for me",
  "Look for latest news on AI",
  "Summarize this page contents",
];

export const DEFAULT_CUSTOM_API: CustomApiConfig = {
  baseUrl: "",
  model: "",
};

export const DEFAULT_SETTINGS: Settings = {
  ...DEFAULT_FEATURES,
  pinnedPrompts: [...DEFAULT_PINNED_PROMPTS],
  models: { ...DEFAULT_MODELS },
  customApi: { ...DEFAULT_CUSTOM_API },
};

const defaultApiKeys: ApiKeys = {};

export const initSettings = async () => {
  const localStorage = await Browser.storage.local.get();
  const updates: Record<string, string> = {};
  if (!localStorage.settings || localStorage.settings === "undefined") {
    updates.settings = JSON.stringify(DEFAULT_SETTINGS);
  }
  if (!localStorage.apiKeys || localStorage.apiKeys === "undefined") {
    updates.apiKeys = JSON.stringify(defaultApiKeys);
  }
  if (Object.keys(updates).length > 0) {
    await Browser.storage.local.set(updates);
  }
};

const parseStoredJson = <T>(value: unknown, fallback: T): T => {
  if (typeof value !== "string" || value === "" || value === "undefined") {
    return fallback;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

export const getLocalStorage = async () => {
  const localStorage = await Browser.storage.local.get();
  localStorage.client = parseStoredJson(localStorage.client, null);
  localStorage.settings = parseStoredJson(localStorage.settings, {});
  localStorage.apiKeys = parseStoredJson(localStorage.apiKeys, {});
  return localStorage;
};

export const getAppSettings = async (): Promise<AppSettings> => {
  const localStorage = await getLocalStorage();
  const storedSettings = (localStorage.settings ?? {}) as Partial<Settings>;
  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    ...storedSettings,
    pinnedPrompts: storedSettings.pinnedPrompts?.length
      ? storedSettings.pinnedPrompts
      : DEFAULT_SETTINGS.pinnedPrompts,
    models: {
      ...DEFAULT_MODELS,
      ...(storedSettings.models ?? {}),
    },
    customApi: {
      ...DEFAULT_CUSTOM_API,
      ...(storedSettings.customApi ?? {}),
    },
  };
  return {
    settings,
    apiKeys: (localStorage.apiKeys ?? {}) as ApiKeys,
  };
};

export const saveAppSettings = async (settings: Settings, apiKeys: ApiKeys) => {
  await Browser.storage.local.set({
    settings: JSON.stringify(settings),
    apiKeys: JSON.stringify(apiKeys),
  });
};
