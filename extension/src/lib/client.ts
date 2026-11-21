import Browser from "webextension-polyfill";
import { DEFAULT_MODELS } from "./llm/model";
import { DEFAULT_FEATURES } from "./features";
import { applySettingsMigrations, type StoredSettings } from "./migrations";
import type { ApiKeys, AppSettings, CustomApiConfig, Settings, StageId } from "@/types";

const SETTINGS_LOCK = "app-settings";

export const initClient = async () => {
  const localStorage = await Browser.storage.local.get("client");
  if (!localStorage.client) {
    const manifest = Browser.runtime.getManifest() as { version: string; version_name?: string };
    await Browser.storage.local.set({
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
  analytics: true,
  pinnedPrompts: [...DEFAULT_PINNED_PROMPTS],
  models: { ...DEFAULT_MODELS },
  customApi: { ...DEFAULT_CUSTOM_API },
};

const defaultApiKeys: ApiKeys = {};

export const initSettings = async () => {
  const localStorage = await Browser.storage.local.get(["settings", "apiKeys"]);
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

const parseStoredJson = <T>(value: unknown): T | undefined => {
  if (typeof value !== "string") return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
};

export function parseAppSettings(storage: Record<string, unknown>): AppSettings {
  const storedSettings = applySettingsMigrations(
    parseStoredJson<StoredSettings>(storage.settings) ?? {}
  );
  const models = { ...DEFAULT_MODELS };
  for (const stage of Object.keys(models) as StageId[]) {
    models[stage] = storedSettings.models?.[stage] ?? models[stage];
  }
  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    ...storedSettings,
    pinnedPrompts: Array.isArray(storedSettings.pinnedPrompts)
      ? storedSettings.pinnedPrompts
      : DEFAULT_SETTINGS.pinnedPrompts,
    models,
    customApi: {
      ...DEFAULT_CUSTOM_API,
      ...(storedSettings.customApi ?? {}),
    },
  };
  return {
    settings,
    apiKeys: parseStoredJson<ApiKeys>(storage.apiKeys) ?? {},
  };
}

export const getAppSettings = async () =>
  parseAppSettings(await Browser.storage.local.get(["settings", "apiKeys"]));

export const migrateAppSettings = () =>
  navigator.locks.request(SETTINGS_LOCK, async () => {
    const { settings } = await Browser.storage.local.get("settings");
    const storedSettings = parseStoredJson<StoredSettings>(settings);
    if (!storedSettings) return;

    const migrated = applySettingsMigrations(storedSettings);
    if (migrated !== storedSettings) {
      await Browser.storage.local.set({ settings: JSON.stringify(migrated) });
    }
  });

export const updateAppSettings = async (update: (current: AppSettings) => Partial<AppSettings>) =>
  navigator.locks.request(SETTINGS_LOCK, async () => {
    const current = await getAppSettings();
    const updates = update(current);
    const entries = Object.entries(updates);
    if (entries.length > 0) {
      await Browser.storage.local.set(
        Object.fromEntries(entries.map(([key, value]) => [key, JSON.stringify(value)]))
      );
    }
    return { ...current, ...updates };
  });
