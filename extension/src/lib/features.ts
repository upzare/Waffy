import type { FeatureFlags, MessageMode, Settings, StageId } from "@/types";

export const DEFAULT_FEATURES: FeatureFlags = {
  featureSearch: true,
  featureResearch: true,
  featureAutomation: false,
};

/** Model stages owned by an optional feature. Stages left out are always active. */
const FEATURE_STAGES: Record<keyof FeatureFlags, StageId[]> = {
  featureSearch: ["search"],
  featureResearch: ["research"],
  featureAutomation: ["t1", "t2", "t3", "t4", "step"],
};

/** Message modes that require a feature flag. `base` is always available. */
const MODE_FLAGS: Partial<Record<MessageMode, keyof FeatureFlags>> = {
  search: "featureSearch",
  research: "featureResearch",
  automate: "featureAutomation",
};

export const MODE_LABELS: Partial<Record<MessageMode, string>> = {
  search: "Search",
  research: "Research",
  automate: "Automation",
};

export const getFeatureFlags = (settings: Settings): FeatureFlags => ({
  featureSearch: settings.featureSearch ?? DEFAULT_FEATURES.featureSearch,
  featureResearch: settings.featureResearch ?? DEFAULT_FEATURES.featureResearch,
  featureAutomation: settings.featureAutomation ?? DEFAULT_FEATURES.featureAutomation,
});

export function isStageEnabled(stage: StageId, flags: FeatureFlags): boolean {
  const entries = Object.entries(FEATURE_STAGES) as [keyof FeatureFlags, StageId[]][];
  return entries.every(([flag, stages]) => flags[flag] || !stages.includes(stage));
}

export function isModeEnabled(mode: MessageMode, flags: FeatureFlags): boolean {
  const flag = MODE_FLAGS[mode];
  return !flag || Boolean(flags[flag]);
}
