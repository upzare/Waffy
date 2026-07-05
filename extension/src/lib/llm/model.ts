import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createXai } from "@ai-sdk/xai";
import { createGroq } from "@ai-sdk/groq";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";
import type { ApiKeys, ModelConfig, ProviderId, StageId } from "@/types";

export const PROVIDER_MODELS: Record<ProviderId, string[]> = {
  openai: [
    "gpt-5.5",
    "gpt-5.4",
    "gpt-5.4-mini",
    "gpt-5.1",
    "gpt-5-pro",
    "gpt-5-mini",
    "gpt-5-nano",
    "gpt-5",
  ],
  anthropic: [
    "claude-opus-4-8",
    "claude-opus-4-7",
    "claude-opus-4-6",
    "claude-sonnet-4-6",
    "claude-sonnet-4-5",
    "claude-haiku-4-5",
  ],
  google: [
    "gemini-3.1-pro-preview",
    "gemini-3-flash-preview",
    "gemini-3.1-flash-lite",
    "gemini-flash-latest",
    "gemini-flash-lite-latest",
  ],
  xai: ["grok-4.3", "grok-4-1-fast-reasoning", "grok-4-fast-reasoning", "grok-3-mini"],
  groq: ["openai/gpt-oss-120b", "openai/gpt-oss-20b"],
  openrouter: [
    "openai/gpt-5.5",
    "openai/gpt-5.4-mini",
    "openai/gpt-5.4-nano",
    "anthropic/claude-opus-4.8-fast",
    "anthropic/claude-opus-4.7-fast",
    "anthropic/claude-sonnet-4.6",
    "google/gemini-3.1-pro-preview",
    "google/gemini-3.5-flash",
    "google/gemini-3.1-flash-lite",
    "x-ai/grok-4.3",
    "x-ai/grok-4.20-multi-agent",
    "x-ai/grok-4.20",
  ],
};

export const CUSTOM_MODEL_OPTION = "__custom__";

export function isPresetModel(provider: ProviderId, model: string): boolean {
  return (PROVIDER_MODELS[provider] ?? []).includes(model);
}

export const DEFAULT_MODELS: Record<StageId, ModelConfig> = {
  t1: { provider: "google", model: "gemini-flash-latest" },
  t2: { provider: "google", model: "gemini-3-flash-preview" },
  t3: { provider: "openai", model: "gpt-5-mini" },
  t4: { provider: "openai", model: "gpt-5-mini" },
  title: { provider: "groq", model: "openai/gpt-oss-120b" },
  step: { provider: "groq", model: "openai/gpt-oss-120b" },
};

export function resolveModel(config: ModelConfig, apiKeys: ApiKeys): LanguageModel {
  const key = apiKeys[config.provider];
  if (!key) {
    throw new Error(`No API key configured for ${config.provider}. Add it in extension settings.`);
  }

  switch (config.provider) {
    case "openai":
      return createOpenAI({ apiKey: key })(config.model);
    case "anthropic":
      return createAnthropic({ apiKey: key })(config.model);
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

export function getStageConfig(
  models: Partial<Record<StageId, ModelConfig>> | undefined,
  stage: StageId
): ModelConfig {
  return models?.[stage] ?? DEFAULT_MODELS[stage];
}
