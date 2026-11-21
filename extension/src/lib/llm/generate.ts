import { generateText } from "ai";
import { PROMPTS } from "./prompts";
import { getStageConfig, resolveModel } from "./model";
import { getFeatureFlags } from "@/lib/features";
import type { AppSettings } from "@/types";

export async function generateStageText(
  stage: "title" | "step" | "memory",
  prompt: string,
  appSettings: AppSettings,
  signal?: AbortSignal
): Promise<string> {
  const config = getStageConfig(appSettings.settings.models, stage);
  const model = await resolveModel(config, appSettings.apiKeys, appSettings.settings.customApi);
  const lifetime = new AbortController();
  try {
    const { text } = await generateText({
      model,
      instructions: PROMPTS[stage](getFeatureFlags(appSettings.settings)),
      prompt,
      abortSignal: signal ? AbortSignal.any([signal, lifetime.signal]) : lifetime.signal,
    });
    return text.trim();
  } finally {
    // The Prompt API session lives as long as the signal passed to its creation.
    lifetime.abort();
  }
}

export async function generateTitle(prompt: string, appSettings: AppSettings): Promise<string> {
  try {
    return (await generateStageText("title", prompt, appSettings)) || "Untitled";
  } catch {
    return "Untitled";
  }
}

export async function generateStepLabel(
  previousReasoning: string,
  currentReasoning: string,
  toolCalls: readonly { toolName: string; input: unknown }[],
  appSettings: AppSettings,
  abortSignal?: AbortSignal
): Promise<string> {
  const actions = toolCalls.map(({ toolName, input }) => ({
    name: toolName,
    arguments: input ?? {},
  }));
  const promptContent = `**PREVIOUS REASONING:**\n ${previousReasoning}\n\n**CURRENT REASONING:**\n ${currentReasoning}\n\n**CURRENT TOOL CALL:**\n ${JSON.stringify(actions)}`;
  return generateStageText("step", promptContent, appSettings, abortSignal);
}
