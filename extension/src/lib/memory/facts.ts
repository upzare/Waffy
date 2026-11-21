import { getAppSettings } from "@/lib/client";
import { generateStageText } from "@/lib/llm/generate";

export async function summarizeMemory(facts: string[]): Promise<string> {
  const appSettings = await getAppSettings();
  if (!appSettings.settings.featureMemory) return "";

  const prompt = `Saved facts:\n${facts.map((fact, index) => `${index + 1}. ${fact}`).join("\n")}`;
  return generateStageText("memory", prompt, appSettings);
}
