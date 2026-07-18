import type { ApiKeys, ProviderId } from "@/types";

export type CloudProviderId = Exclude<ProviderId, "browser-ai">;

export interface ProviderMeta {
  id: CloudProviderId;
  label: string;
  shortLabel: string;
  description: string;
  placeholder: string;
  docsUrl: string;
}

export interface BrowserAIProviderMeta {
  id: "browser-ai";
  label: string;
  shortLabel: string;
  description: string;
  placeholder: string;
  docsUrl: string;
}

export const BROWSER_AI_PROVIDER: BrowserAIProviderMeta = {
  id: "browser-ai",
  label: "Browser AI",
  shortLabel: "Browser AI",
  description: "On-device Chromium models (Chrome/Edge/Brave when available). No API key required.",
  placeholder: "",
  docsUrl: "https://www.browser-ai.dev/docs/ai-sdk-v6/core/installation",
};

export const PROVIDERS: ProviderMeta[] = [
  {
    id: "openai",
    label: "OpenAI",
    shortLabel: "OpenAI",
    description: "Add API key to use GPT models",
    placeholder: "sk-...",
    docsUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    shortLabel: "Anthropic",
    description: "Add API key to use claude models.",
    placeholder: "sk-ant-...",
    docsUrl: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "google",
    label: "Google AI Studio",
    shortLabel: "Google",
    description: "Add API key to use gemini models.",
    placeholder: "AIza...",
    docsUrl: "https://aistudio.google.com/apikey",
  },
  {
    id: "xai",
    label: "xAI",
    shortLabel: "xAI",
    description: "Add API key to use grok models.",
    placeholder: "xai-...",
    docsUrl: "https://console.x.ai/",
  },
  {
    id: "groq",
    label: "Groq",
    shortLabel: "Groq",
    description: "Add API key to use groq models.",
    placeholder: "gsk_...",
    docsUrl: "https://console.groq.com/keys",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    shortLabel: "OpenRouter",
    description: "Add API Key to use openrouter models.",
    placeholder: "sk-or-...",
    docsUrl: "https://openrouter.ai/keys",
  },
];

const PROVIDER_META_BY_ID: Record<CloudProviderId, ProviderMeta> = Object.fromEntries(
  PROVIDERS.map((provider) => [provider.id, provider])
) as Record<CloudProviderId, ProviderMeta>;

export function getProviderMeta(id: ProviderId): ProviderMeta | BrowserAIProviderMeta {
  if (id === "browser-ai") {
    return BROWSER_AI_PROVIDER;
  }
  return PROVIDER_META_BY_ID[id];
}

export function hasApiKey(apiKeys: ApiKeys, provider: CloudProviderId): boolean {
  return Boolean(apiKeys[provider]?.trim());
}
