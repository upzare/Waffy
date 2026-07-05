import type { ApiKeys, ProviderId } from "@/types";

export interface ProviderMeta {
  id: ProviderId;
  label: string;
  shortLabel: string;
  description: string;
  placeholder: string;
  docsUrl: string;
}

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

const PROVIDER_META_BY_ID: Record<ProviderId, ProviderMeta> = Object.fromEntries(
  PROVIDERS.map((provider) => [provider.id, provider])
) as Record<ProviderId, ProviderMeta>;

export function getProviderMeta(id: ProviderId): ProviderMeta {
  return PROVIDER_META_BY_ID[id];
}

export function hasApiKey(apiKeys: ApiKeys, provider: ProviderId): boolean {
  return Boolean(apiKeys[provider]?.trim());
}
