import { generateText, Output } from "ai";
import { z } from "zod";
import { getAppSettings } from "@/lib/client";
import { getFeatureFlags } from "@/lib/features";
import { PROMPTS } from "@/lib/llm/prompts";
import { getStageConfig, resolveModel } from "@/lib/llm/model";

export function userMessageFromPrompt(promptText: string): string {
  const match = promptText.match(/<user_message>\s*([\s\S]*?)\s*<\/user_message>/);
  return (match?.[1] ?? promptText).trim();
}

export async function extractFacts(userText: string, assistantText: string): Promise<string[]> {
  try {
    const appSettings = await getAppSettings();
    if (!appSettings.settings.featureMemory) return [];

    const config = getStageConfig(appSettings.settings.models, "memory");
    const model = await resolveModel(config, appSettings.apiKeys, appSettings.settings.customApi);
    const flags = getFeatureFlags(appSettings.settings);
    const { output } = await generateText({
      model,
      instructions: PROMPTS.memory(flags),
      prompt: `Conversation:\nuser: ${userText}\nassistant: ${assistantText}`,
      output: Output.array({
        element: z.string(),
        name: "facts",
        description: "Discrete reusable facts about the user",
      }),
    });
    return output.map((fact) => fact.trim()).filter((fact) => fact !== "");
  } catch (error) {
    console.warn("Fact extraction failed", error);
    return [];
  }
}

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
