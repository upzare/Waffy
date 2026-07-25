import type { ToolSet } from "ai";
import { PROMPTS, type PromptBuilder } from "./prompts";
import { BASE_TOOLS } from "@/lib/llm/tools/base";
import { SEARCH_TOOLS } from "@/lib/llm/tools/search";
import { RESEARCH_TOOLS } from "@/lib/llm/tools/research";
import { T1_TOOLS, T2_TOOLS, T3_TOOLS } from "@/lib/llm/tools/automate";
import type { FeatureFlags } from "@/types";

export type StreamMode = "base" | "search" | "research" | "t1" | "t2" | "t3" | "t4";

/**
 * Per-mode streaming rules.
 */
export interface ModeConfig {
  /** Tools always considered for this mode (before feature gating). */
  tools: ToolSet;
  /** Dynamic system prompt builder. */
  prompt: PromptBuilder;
  /**
   * Optional tools gated by a feature flag.
   * Tool is included only when `flags[flag]` is true.
   */
  toolFeatures?: Partial<Record<string, keyof FeatureFlags>>;
  /** Mode-specific stream behavior. */
  extra?: {
    /** Emit text deltas as reasoning instead of response text. */
    streamAsReasoning?: boolean;
    /** Convert screenshot-relative tool coordinates to viewport pixels. */
    convertCoordinates?: boolean;
    /** Generate a short UI step label for each tool call. */
    generateSteps?: boolean;
  };
}

export const MODES: Record<StreamMode, ModeConfig> = {
  base: {
    tools: BASE_TOOLS,
    prompt: PROMPTS.base,
    toolFeatures: {
      webSearch: "featureSearch",
      automate: "featureAutomation",
    },
  },
  search: {
    tools: SEARCH_TOOLS,
    prompt: PROMPTS.search,
  },
  research: {
    tools: RESEARCH_TOOLS,
    prompt: PROMPTS.research,
  },
  t1: {
    tools: T1_TOOLS,
    prompt: PROMPTS.t1,
  },
  t2: {
    tools: T2_TOOLS,
    prompt: PROMPTS.t2,
    extra: {
      streamAsReasoning: true,
      convertCoordinates: true,
      generateSteps: true,
    },
  },
  t3: {
    tools: T3_TOOLS,
    prompt: PROMPTS.t3,
  },
  t4: {
    tools: {},
    prompt: PROMPTS.t4,
  },
};

export function resolvePrompt(mode: StreamMode, flags: FeatureFlags): string {
  return MODES[mode].prompt(flags);
}

export function resolveTools(mode: StreamMode, flags: FeatureFlags): ToolSet {
  const { tools, toolFeatures } = MODES[mode];
  if (!toolFeatures) return tools;

  return Object.fromEntries(
    Object.entries(tools).filter(([name]) => {
      const flag = toolFeatures[name];
      return !flag || flags[flag];
    })
  );
}
