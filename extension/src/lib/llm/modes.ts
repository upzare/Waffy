import type { ToolSet } from "ai";
import { PROMPTS, type PromptBuilder } from "./prompts";
import { BASE_TOOLS } from "@/lib/llm/tools/base";
import { SEARCH_TOOLS } from "@/lib/llm/tools/search";
import { RESEARCH_TOOLS } from "@/lib/llm/tools/research";
import { reportStatus, T2_TOOLS } from "@/lib/llm/tools/automate";
import { automationToolHandlers } from "./tools/handlers/automate";
import { browserToolHandlers, type ToolHandlers } from "./tools/handlers/common";
import type { FeatureFlags, StageId } from "@/types";

export type StreamMode = "base" | "search" | "research" | "t1" | "t2" | "t3";

export const STAGE_TOOL_ACCESS = {
  base: { mcp: true, memory: true },
  search: { mcp: true, memory: true },
  research: { mcp: true, memory: true },
  t1: { mcp: true, memory: true },
  t2: { mcp: true, memory: false },
  t3: { mcp: false, memory: false },
  title: { mcp: false, memory: false },
  step: { mcp: false, memory: false },
  memory: { mcp: false, memory: false },
} satisfies Record<StageId, { mcp: boolean; memory: boolean }>;

interface ModeConfig {
  tools: ToolSet;
  handlers?: ToolHandlers;
  prompt: PromptBuilder;
  toolFeatures?: Partial<Record<string, keyof FeatureFlags>>;
}

export const MODES: Record<StreamMode, ModeConfig> = {
  base: {
    tools: BASE_TOOLS,
    handlers: browserToolHandlers,
    prompt: PROMPTS.base,
    toolFeatures: {
      webSearch: "featureSearch",
      webFetch: "featureSearch",
    },
  },
  search: {
    tools: SEARCH_TOOLS,
    handlers: browserToolHandlers,
    prompt: PROMPTS.search,
  },
  research: {
    tools: RESEARCH_TOOLS,
    handlers: browserToolHandlers,
    prompt: PROMPTS.research,
  },
  t1: {
    tools: {},
    prompt: PROMPTS.t1,
  },
  t2: {
    tools: T2_TOOLS,
    handlers: automationToolHandlers,
    prompt: PROMPTS.t2,
  },
  t3: {
    tools: { reportStatus },
    prompt: PROMPTS.t3,
  },
};

export function resolveBuiltInTools(
  { tools, toolFeatures }: ModeConfig,
  flags: FeatureFlags
): ToolSet {
  if (!toolFeatures) return tools;

  return Object.fromEntries(
    Object.entries(tools).filter(([name]) => {
      const flag = toolFeatures[name];
      return !flag || flags[flag];
    })
  );
}
