import React, { useState } from "react";
import { ChevronDown, Info } from "lucide-react";
import {
  CUSTOM_MODEL_OPTION,
  getStageConfig,
  isPresetModel,
  PROVIDER_MODELS,
} from "@/lib/llm/model";
import { getFeatureFlags, isStageEnabled } from "@/lib/features";
import { getBrowserAIModelLabel, type BrowserAIStatus } from "@/lib/llm/browser-ai";
import {
  BROWSER_AI_PROVIDER,
  CUSTOM_PROVIDER,
  hasApiKey,
  isCustomApiReady,
  PROVIDERS,
} from "../providers";
import BrowserAISection from "./browser-ai";
import type { ApiKeys, ModelConfig, Settings, StageId } from "@/types";
import { alertInfo, fieldLabel, monoInput, selectInput } from "../styles";

interface ModelsSectionProps {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  apiKeys: ApiKeys;
}

interface StageConfig {
  id: StageId;
  label: string;
  description: string;
  recommendation?: React.ReactNode;
}

interface StageGroup {
  title: string;
  subtitle: string;
  stages: StageConfig[];
}

const MODEL_PROVIDERS = [BROWSER_AI_PROVIDER, ...PROVIDERS, CUSTOM_PROVIDER];

const STAGE_GROUPS: StageGroup[] = [
  {
    title: "General",
    subtitle: "Use browser models for free and cloud models for more advanced reasoning.",
    stages: [
      {
        id: "base",
        label: "Base Model",
        description: "Answers questions and switches to automation when needed.",
        recommendation: (
          <>
            Use the built-in browser model (like Gemini Nano) for free. For more advanced reasoning
            and querying, switch to a cloud model.
          </>
        ),
      },
      {
        id: "search",
        label: "Search Model",
        description: "Searches the web and answers the user's query.",
        recommendation: (
          <>Browser models is fine here, or use a fast cloud model for better quality.</>
        ),
      },
      {
        id: "research",
        label: "Research Model",
        description: "Deep research and synthesis using the current page as source.",
        recommendation: (
          <>
            Prefer a capable cloud model for thorough analysis and synthesis. Browser models works
            for lighter page summaries.
          </>
        ),
      },
    ],
  },
  {
    title: "Automation",
    subtitle: "Cloud models recommended for multi-step browser tasks.",
    stages: [
      {
        id: "t1",
        label: "Planning Model",
        description: "Analyzes prompts and generates a plan for the automation task",
      },
      {
        id: "t2",
        label: "Execution Model",
        description: "Performs the automation task based on the generated plan",
        recommendation: (
          <>
            Execution works best with vision models that support spatial reasoning and image
            grounding — they can identify UI element coordinates on screenshots. Recommended model:{" "}
            <strong>gemini-3.6-flash</strong> or similar.
          </>
        ),
      },
      {
        id: "t3",
        label: "Output Model",
        description: "Determines whether the task completed and summarizes the result.",
      },
    ],
  },
  {
    title: "Miscellaneous",
    subtitle: "Supporting models used across conversations.",
    stages: [
      {
        id: "title",
        label: "Title Model",
        description: "Creates a title for the conversation",
      },
      {
        id: "step",
        label: "Step Model",
        description: "Creates short labels for each execution step",
      },
      {
        id: "memory",
        label: "Memory Summarize Model",
        description: "Turns your saved memories into the summary shown in Settings",
        recommendation: (
          <>
            This runs only when you summarize saved memory. A small model is enough, and the
            built-in browser model keeps that summary on this device.
          </>
        ),
      },
    ],
  },
];

const ModelsSection: React.FC<ModelsSectionProps> = ({ settings, setSettings, apiKeys }) => {
  const [expandedStages, setExpandedStages] = useState<Partial<Record<StageId, boolean>>>({});
  const [browserAIStatus, setBrowserAIStatus] = useState<BrowserAIStatus>("unavailable");

  const configuredProviders = MODEL_PROVIDERS.filter(({ id }) => {
    if (id === "browser-ai") {
      return browserAIStatus === "available";
    }
    if (id === "custom") {
      return isCustomApiReady(settings.customApi);
    }
    return hasApiKey(apiKeys, id);
  });
  const hasProviders = configuredProviders.length > 0;
  const providerPlaceholder = hasProviders ? "Select a provider" : "No providers configured";
  const customApiModel = settings.customApi.model.trim();
  const browserAIModel = getBrowserAIModelLabel();

  const updateStage = (stage: StageId, patch: Partial<ModelConfig>) => {
    setSettings((prev) => ({
      ...prev,
      models: {
        ...prev.models,
        [stage]: { ...getStageConfig(prev.models, stage), ...patch },
      },
    }));
  };

  const toggleStage = (stage: StageId) => {
    setExpandedStages((prev) => ({ ...prev, [stage]: !prev[stage] }));
  };

  const renderStageCard = ({ id, label, description, recommendation }: StageConfig) => {
    const config = getStageConfig(settings.models, id);
    const provider = configuredProviders.find(({ id }) => id === config.provider);
    const isBrowserAI = provider?.id === "browser-ai";
    const isCustomProvider = provider?.id === "custom";
    const isCloudProvider = !!provider && !isBrowserAI && !isCustomProvider;
    const isCustom = isCloudProvider && !isPresetModel(config.provider, config.model);
    const selectValue = isCustom ? CUSTOM_MODEL_OPTION : config.model;
    const isExpanded = expandedStages[id] ?? false;
    const modelPreview = isBrowserAI
      ? browserAIModel
      : isCustomProvider
        ? customApiModel
        : config.model;

    return (
      <div
        className="overflow-hidden rounded-2xl border border-white/12 bg-white/6 backdrop-blur-[18px] transition-colors duration-150 hover:border-white/25"
        key={id}
      >
        <button
          type="button"
          className="flex w-full flex-col items-start gap-2 px-4 py-4 text-left transition-colors duration-150 hover:bg-white/2 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5"
          onClick={() => toggleStage(id)}
          aria-expanded={isExpanded}
        >
          <div className="min-w-0 flex-1">
            <span className="text-sm font-bold tracking-[-0.02em]">{label}</span>
            <p className="mt-0.5 text-xs leading-snug text-text-muted">{description}</p>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto sm:shrink-0">
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-text-muted sm:max-w-55 sm:flex-none">
              {provider ? `${provider.shortLabel} / ${modelPreview || "—"}` : providerPlaceholder}
            </span>
            <ChevronDown
              size={16}
              className={`shrink-0 text-text-muted transition-transform duration-200 ${isExpanded ? "rotate-180" : ""
                }`}
            />
          </div>
        </button>

        {isExpanded && (
          <div className="flex animate-fade-in flex-col gap-4 border-t border-white/10 px-4 py-4 sm:px-5 sm:pb-5">
            {recommendation && (
              <div className={alertInfo}>
                <Info size={15} />
                <span>{recommendation}</span>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-2">
                <label htmlFor={`${id}-provider`} className={fieldLabel}>
                  Provider
                </label>
                <div className="relative">
                  <select
                    id={`${id}-provider`}
                    className={`${selectInput} disabled:cursor-not-allowed`}
                    value={provider?.id ?? ""}
                    disabled={!hasProviders}
                    onChange={(e) => {
                      const nextProvider = configuredProviders.find(
                        ({ id }) => id === e.target.value
                      );
                      if (!nextProvider) return;
                      updateStage(id, {
                        provider: nextProvider.id,
                        model:
                          nextProvider.id === "custom"
                            ? customApiModel
                            : PROVIDER_MODELS[nextProvider.id][0],
                      });
                    }}
                  >
                    {!provider && (
                      <option value="" disabled>
                        {providerPlaceholder}
                      </option>
                    )}
                    {configuredProviders.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={16}
                    className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-text-muted"
                  />
                </div>
              </div>

              {isCloudProvider && (
                <div className="flex min-w-0 flex-col gap-2">
                  <label htmlFor={`${id}-model`} className={fieldLabel}>
                    Model
                  </label>
                  <div className="relative">
                    <select
                      id={`${id}-model`}
                      className={selectInput}
                      value={selectValue}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === CUSTOM_MODEL_OPTION) {
                          updateStage(id, { model: isCustom ? config.model : "" });
                        } else {
                          updateStage(id, { model: value });
                        }
                      }}
                    >
                      {PROVIDER_MODELS[config.provider].map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                      <option value={CUSTOM_MODEL_OPTION}>Custom model ID…</option>
                    </select>
                    <ChevronDown
                      size={16}
                      className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-text-muted"
                    />
                  </div>
                </div>
              )}
            </div>

            {isBrowserAI && (
              <div className="flex min-w-0 flex-col gap-2">
                <span className={fieldLabel}>Model</span>
                <p className="text-sm text-text-secondary">{browserAIModel}</p>
              </div>
            )}

            {isCustomProvider && (
              <div className="flex min-w-0 flex-col gap-2">
                <span className={fieldLabel}>Model</span>
                <p className="text-sm text-text-secondary">{customApiModel}</p>
              </div>
            )}

            {isCustom && (
              <div className="flex min-w-0 flex-col gap-2">
                <label htmlFor={`${id}-custom`} className={fieldLabel}>
                  Custom model ID
                </label>
                <input
                  id={`${id}-custom`}
                  className={monoInput}
                  type="text"
                  placeholder="e.g. my-provider/my-model"
                  value={config.model}
                  onChange={(e) => updateStage(id, { model: e.target.value })}
                />
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const flags = getFeatureFlags(settings);
  const visibleGroups = STAGE_GROUPS.map((group) => ({
    ...group,
    stages: group.stages.filter((stage) => isStageEnabled(stage.id, flags)),
  })).filter((group) => group.stages.length > 0);

  return (
    <>
      <BrowserAISection status={browserAIStatus} setStatus={setBrowserAIStatus} />
      {!hasProviders && (
        <p className={`${alertInfo} mb-6`}>
          <Info size={15} />
          <span>Add an API key or configure a Custom API to choose a model.</span>
        </p>
      )}
      {visibleGroups.map((group) => (
        <div className="mb-7" key={group.title}>
          <div className="mb-3">
            <h3 className="mb-0.5 text-sm font-bold tracking-[-0.02em]">{group.title}</h3>
            <p className="text-sm leading-relaxed text-white/45">{group.subtitle}</p>
          </div>
          <div className="flex flex-col gap-2.5">
            {group.stages.map((stage) => renderStageCard(stage))}
          </div>
        </div>
      ))}
    </>
  );
};

export default ModelsSection;
