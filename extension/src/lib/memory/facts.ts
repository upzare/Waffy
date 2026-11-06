import { generateText } from "ai";
import { getAppSettings } from "@/lib/client";
import { getFeatureFlags } from "@/lib/features";
import { PROMPTS } from "@/lib/llm/prompts";
import { getStageConfig, resolveModel } from "@/lib/llm/model";

export async function summarizeMemory(facts: string[]): Promise<string> {
  const appSettings = await getAppSettings();
  if (!appSettings.settings.featureMemory) return "";

  const config = getStageConfig(appSettings.settings.models, "memory");
  const model = await resolveModel(config, appSettings.apiKeys, appSettings.settings.customApi);
  const flags = getFeatureFlags(appSettings.settings);
  const prompt = `Saved facts:\n${facts.map((fact, index) => `${index + 1}. ${fact}`).join("\n")}`;

  const { text } = await generateText({
    model,
    instructions: PROMPTS.memorySummary(flags),
    prompt,
  });
  return text.trim();
}
