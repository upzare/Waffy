import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createXai } from "@ai-sdk/xai";
import { createGroq } from "@ai-sdk/groq";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";
import type { ApiKeys, FeatureFlags, ModelConfig, ProviderId, StageId } from "@/types";
import { isStageEnabled } from "@/lib/features";
import { ensureBrowserAIModelReady, getBrowserAIStatus } from "./browser-ai";

export const PROVIDER_MODELS: Record<ProviderId, string[]> = {
  openai: [
    "gpt-5.6-sol",
    "gpt-5.6-terra",
    "gpt-5.6-luna",
    "gpt-5.5",
    "gpt-5.4",
    "gpt-5.4-mini",
    "gpt-5-mini",
    "gpt-5-nano",
  ],
  anthropic: [
    "claude-fable-5",
    "claude-opus-5",
    "claude-sonnet-5",
    "claude-haiku-4-5",
    "claude-opus-4-8",
    "claude-sonnet-4-6",
  ],
  google: [
    "gemini-3.1-pro-preview",
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-flash-latest",
    "gemini-flash-lite-latest",
  ],
  xai: ["grok-4.5", "grok-4.3", "grok-4.20", "grok-4.20-multi-agent", "grok-build-0.1"],
  groq: [
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "qwen/qwen3.6-27b",
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
  ],
  openrouter: [
    "openai/gpt-5.6-sol",
    "openai/gpt-5.6-terra",
    "openai/gpt-5.6-luna",
    "anthropic/claude-fable-5",
    "anthropic/claude-opus-5",
    "anthropic/claude-opus-5-fast",
    "anthropic/claude-sonnet-5",
    "google/gemini-3.6-flash",
    "google/gemini-3.5-flash",
    "google/gemini-3.5-flash-lite",
    "google/gemini-3.1-pro-preview",
    "x-ai/grok-4.5",
    "x-ai/grok-4.3",
  ],
  "browser-ai": ["default"],
};

export const CUSTOM_MODEL_OPTION = "__custom__";

export function isPresetModel(provider: ProviderId, model: string): boolean {
  return (PROVIDER_MODELS[provider] ?? []).includes(model);
}

export const DEFAULT_MODELS: Record<StageId, ModelConfig> = {
  base: { provider: "browser-ai", model: "default" },
  search: { provider: "browser-ai", model: "default" },
  research: { provider: "browser-ai", model: "default" },
  title: { provider: "browser-ai", model: "default" },
  t1: { provider: "google", model: "gemini-flash-latest" },
  t2: { provider: "google", model: "gemini-3.6-flash" },
  t3: { provider: "openai", model: "gpt-5.6-luna" },
  t4: { provider: "openai", model: "gpt-5.6-luna" },
  step: { provider: "browser-ai", model: "default" },
};

export function getStageConfig(
  models: Partial<Record<StageId, ModelConfig>> | undefined,
  stage: StageId
): ModelConfig {
  return models?.[stage] ?? DEFAULT_MODELS[stage];
}

export async function findMissingProvider(
  models: Partial<Record<StageId, ModelConfig>> | undefined,
  apiKeys: ApiKeys,
  flags: FeatureFlags
): Promise<StageId | null> {
  let browserAIReady: boolean | null = null;

  for (const stage of Object.keys(DEFAULT_MODELS) as StageId[]) {
    if (!isStageEnabled(stage, flags)) continue;

    const { provider } = getStageConfig(models, stage);
    if (provider === "browser-ai") {
      browserAIReady ??= (await getBrowserAIStatus()) === "available";
      if (!browserAIReady) return stage;
    } else if (!apiKeys[provider]?.trim()) {
      return stage;
    }
  }

  return null;
}

export async function resolveModel(
  config: ModelConfig,
  apiKeys: ApiKeys,
  onProgress?: (progress: number) => void
): Promise<LanguageModel> {
  if (config.provider === "browser-ai") {
    return ensureBrowserAIModelReady(onProgress);
  }

  const key = apiKeys[config.provider];
  if (!key) {
    throw new Error(`No API key configured for ${config.provider}. Add it in extension settings.`);
  }

  switch (config.provider) {
    case "openai":
      return createOpenAI({ apiKey: key })(config.model);
    case "anthropic":
      return createAnthropic({
        apiKey: key,
        headers: { "anthropic-dangerous-direct-browser-access": "true" },
      })(config.model);
    case "google":
      return createGoogleGenerativeAI({ apiKey: key })(config.model);
    case "xai":
      return createXai({ apiKey: key })(config.model);
    case "groq":
      return createGroq({ apiKey: key })(config.model);
    case "openrouter":
      return createOpenRouter({ apiKey: key, appName: "Waffy" })(config.model);
    default:
      throw new Error(`Unsupported provider: ${config.provider}`);
  }
}
