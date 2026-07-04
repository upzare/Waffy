import Browser from "webextension-polyfill";
import { DEFAULT_MODELS } from "./llm/model";
import type { ApiKeys, AppSettings, Settings } from "@/types";

export const initClient = async () => {
    const localStorage = await Browser.storage.local.get();
    if (!localStorage.client) {
        Browser.storage.local.set({
            client: JSON.stringify({
                client_id: crypto.randomUUID(),
                package: chrome.runtime.getManifest().version_name,
                version: chrome.runtime.getManifest().version,
                os: navigator.platform,
                browser: navigator.userAgent,
            })
        });
    }
}

export const DEFAULT_PINNED_PROMPTS = [
    "What is in my screen",
    "Fill out this form for me",
    "Look for latest news on AI",
    "Summarize this page contents",
];

const defaultSettings: Settings = {
    theme: "system",
    enableHistory: true,
    enableNotifications: true,
    pinnedPrompts: [...DEFAULT_PINNED_PROMPTS],
    models: { ...DEFAULT_MODELS },
};

const defaultApiKeys: ApiKeys = {};

export const initSettings = async () => {
    const localStorage = await Browser.storage.local.get();
    if (!localStorage.settings) {
        await Browser.storage.local.set({
            settings: JSON.stringify(defaultSettings),
            apiKeys: JSON.stringify(defaultApiKeys),
        });
    }
}

export const getLocalStorage = async () => {
    const localStorage = await Browser.storage.local.get();
    localStorage.client = JSON.parse(localStorage.client as string);
    localStorage.settings = JSON.parse(localStorage.settings as string);
    localStorage.apiKeys = JSON.parse((localStorage.apiKeys as string) || "{}");
    return localStorage;
}

export const getAppSettings = async (): Promise<AppSettings> => {
    const localStorage = await getLocalStorage();
    const storedSettings = (localStorage.settings ?? {}) as Partial<Settings>;
    const settings: Settings = {
        ...defaultSettings,
        ...storedSettings,
        pinnedPrompts: storedSettings.pinnedPrompts?.length
            ? storedSettings.pinnedPrompts
            : defaultSettings.pinnedPrompts,
        models: {
            ...DEFAULT_MODELS,
            ...(storedSettings.models ?? {}),
        },
    };
    return {
        settings,
        apiKeys: (localStorage.apiKeys ?? {}) as ApiKeys,
    };
}

export const saveAppSettings = async (settings: Settings, apiKeys: ApiKeys) => {
    await Browser.storage.local.set({
        settings: JSON.stringify(settings),
        apiKeys: JSON.stringify(apiKeys),
    });
}
