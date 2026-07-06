import { generateText } from "ai";
import { TITLE_PROMPT, T5_PROMPT } from "./prompts";
import { getStageConfig, resolveModel } from "./model";
import type { AppSettings, ToolCall } from "@/types";

export async function generateTitle(prompt: string, appSettings: AppSettings): Promise<string> {
  try {
    const config = getStageConfig(appSettings.settings.models, "title");
    const model = await resolveModel(config, appSettings.apiKeys);
    const { text } = await generateText({
      model,
      system: TITLE_PROMPT,
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
  const model = await resolveModel(config, appSettings.apiKeys);
  const promptContent = `**PREVIOUS REASONING:**\n ${previousReasoning}\n\n**CURRENT REASONING:**\n ${currentReasoning}\n\n**CURRENT TOOL CALL:**\n ${JSON.stringify(toolCalls)}`;
  const { text } = await generateText({
    model,
    system: T5_PROMPT,
    prompt: promptContent,
  });
  return text.trim();
}
