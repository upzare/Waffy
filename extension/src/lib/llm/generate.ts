import { generateText } from "ai";
import { PROMPTS } from "./prompts";
import { getStageConfig, resolveModel } from "./model";
import { getFeatureFlags } from "@/lib/features";
import type { AppSettings, ToolCall } from "@/types";

export async function generateTitle(prompt: string, appSettings: AppSettings): Promise<string> {
  try {
    const config = getStageConfig(appSettings.settings.models, "title");
    const model = await resolveModel(config, appSettings.apiKeys, appSettings.settings.customApi);
    const flags = getFeatureFlags(appSettings.settings);
    const { text } = await generateText({
      model,
      system: PROMPTS.title(flags),
      prompt,
    });
    return text.trim() || "Untitled";
  } catch {
    return "Untitled";
  }
}

export async function generateStepLabel(
  previousReasoning: string,
  currentReasoning: string,
  toolCalls: Record<string, ToolCall>,
  appSettings: AppSettings
): Promise<string> {
  const config = getStageConfig(appSettings.settings.models, "step");
  const model = await resolveModel(config, appSettings.apiKeys, appSettings.settings.customApi);
  const flags = getFeatureFlags(appSettings.settings);
  const promptContent = `**PREVIOUS REASONING:**\n ${previousReasoning}\n\n**CURRENT REASONING:**\n ${currentReasoning}\n\n**CURRENT TOOL CALL:**\n ${JSON.stringify(toolCalls)}`;
  const { text } = await generateText({
    model,
    system: PROMPTS.step(flags),
    prompt: promptContent,
  });
  return text.trim();
}
