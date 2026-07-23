import React, { useState } from "react";
import { AlertCircle, ChevronDown, Info } from "lucide-react";
import { CUSTOM_MODEL_OPTION, isPresetModel, PROVIDER_MODELS } from "@/lib/llm/model";
import { getBrowserAIModelLabel, type BrowserAIStatus } from "@/lib/llm/browser-ai";
import { BROWSER_AI_PROVIDER, getProviderMeta, hasApiKey, PROVIDERS } from "../providers";
import type { CloudProviderId } from "../providers";
import BrowserAISection from "./browser-ai";
import type { ApiKeys, ModelConfig, ProviderId, Settings, StageId } from "@/types";
import { alertError, alertInfo, fieldLabel, monoInput, selectInput } from "../styles";

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

const STAGE_GROUPS: StageGroup[] = [
  {
    title: "General",
    subtitle:
      "Local models (Browser AI) work well here — fast, private, and free. Cloud models are recommended for research.",
    stages: [
      {
        id: "base",
        label: "Base Model",
        description:
          "Answers questions and switches to automation when needed.",
        recommendation: (
          <>
            Use the built-in browser model (like Gemini Nano) for free. For
            more advanced reasoning and querying, switch to a cloud model.
          </>
        ),
      },
      {
        id: "search",
        label: "Search Model",
        description: "Searches the web and answers the user's query.",
        recommendation: (
          <>
            Browser models is fine here, or use a fast cloud model for better quality.
          </>
        ),
      },
      {
        id: "research",
        label: "Research Model",
        description: "Deep research and synthesis using the current page as source.",
        recommendation: (
          <>
            Prefer a capable cloud model for thorough analysis and synthesis. Browser models works for
            lighter page summaries.
          </>
        ),
      },
      {
        id: "title",
        label: "Title Generation Model",
        description: "Creates a title for the conversation",
      },
    ],
  },
  {
    title: "Automation",
    subtitle:
      "Cloud models are recommended for automation — stronger vision, reasoning, and reliability for multi-step browser tasks.",
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
            <strong>gemini-3.5-flash</strong> or similar.
          </>
        ),
      },
      {
        id: "t3",
        label: "Validation Model",
        description: "Validates that the task completed or not",
      },
      {
        id: "t4",
        label: "Output Model",
        description: "Generates a summary of the task completion",
      },
      {
        id: "step",
        label: "Step Generation Model",
        description: "Short execution step descriptions shown in the UI",
      },
    ],
  },
];

const ModelsSection: React.FC<ModelsSectionProps> = ({ settings, setSettings, apiKeys }) => {
  const [expandedStages, setExpandedStages] = useState<Partial<Record<StageId, boolean>>>({});
  const [browserAIStatus, setBrowserAIStatus] = useState<BrowserAIStatus>("unavailable");

  const isProviderReady = (provider: ProviderId) => {
    if (provider === "browser-ai") {
      return browserAIStatus === "available";
    }
    return hasApiKey(apiKeys, provider as CloudProviderId);
  };

  const updateStage = (stage: StageId, patch: Partial<ModelConfig>) => {
    setSettings((prev) => ({
      ...prev,
      models: {
        ...prev.models,
        [stage]: {
          provider: patch.provider ?? prev.models[stage]?.provider ?? "openai",
          model: patch.model ?? prev.models[stage]?.model ?? PROVIDER_MODELS.openai[0],
        },
      },
    }));
  };

  const toggleStage = (stage: StageId) => {
    setExpandedStages((prev) => ({ ...prev, [stage]: !prev[stage] }));
  };

  const renderBrowserAIWarning = () => {
    if (browserAIStatus === "available") return null;

    let message = "Download Browser AI in the section above before using it for this stage.";
    if (browserAIStatus === "unsupported") {
      message = "Browser AI is not supported in this browser.";
    } else if (browserAIStatus === "unavailable") {
      message = "Browser AI is unavailable on this device. Check storage and system requirements.";
    }

    return (
      <div className={alertError}>
        <AlertCircle size={15} />
        <span>{message}</span>
      </div>
    );
  };

  const renderStageCard = ({ id, label, description, recommendation }: StageConfig) => {
    const config = settings.models[id] ?? {
      provider: "openai" as ProviderId,
      model: PROVIDER_MODELS.openai[0],
    };
    const isBrowserAI = config.provider === "browser-ai";
    const models = PROVIDER_MODELS[config.provider] ?? [];
    const isCustom = !isBrowserAI && !isPresetModel(config.provider, config.model);
    const selectValue = isCustom ? CUSTOM_MODEL_OPTION : config.model;
    const providerMeta = isBrowserAI ? BROWSER_AI_PROVIDER : getProviderMeta(config.provider);
    const keyMissing = !isProviderReady(config.provider);
    const isExpanded = expandedStages[id] ?? false;
    const modelPreview = isBrowserAI ? getBrowserAIModelLabel() : config.model || "—";

    return (
      <div
        className="overflow-hidden rounded-md border border-border bg-surface-2 transition-colors duration-150 hover:border-border-strong"
        key={id}
      >
        <button
          type="button"
          className="flex w-full flex-col items-start gap-2 px-4 py-4 text-left transition-colors duration-150 hover:bg-white/2 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5"
          onClick={() => toggleStage(id)}
          aria-expanded={isExpanded}
        >
          <div className="min-w-0 flex-1">
            <span className="text-sm font-semibold">{label}</span>
            <p className="mt-0.5 text-xs leading-snug text-text-muted">{description}</p>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto sm:shrink-0">
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-text-muted sm:max-w-55 sm:flex-none">
              {providerMeta.shortLabel} / {modelPreview}
            </span>
            <ChevronDown
              size={16}
              className={`shrink-0 text-text-muted transition-transform duration-200 ${isExpanded ? "rotate-180" : ""
                }`}
            />
          </div>
        </button>

        {isExpanded && (
          <div className="flex animate-fade-in flex-col gap-4 border-t border-border px-4 py-4 sm:px-5 sm:pb-5">
            {isBrowserAI
              ? renderBrowserAIWarning()
              : keyMissing && (
                <div className={alertError}>
                  <AlertCircle size={15} />
                  <span>
                    No API key for {providerMeta.label}. Add one in the API Keys section.
                  </span>
                </div>
              )}

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
                    className={selectInput}
                    value={config.provider}
                    onChange={(e) =>
                      updateStage(id, {
                        provider: e.target.value as ProviderId,
                        model: PROVIDER_MODELS[e.target.value as ProviderId][0],
                      })
                    }
                  >
                    <option value={BROWSER_AI_PROVIDER.id}>
                      {BROWSER_AI_PROVIDER.label}
                      {browserAIStatus === "available" ? "" : " (not ready)"}
                    </option>
                    {PROVIDERS.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.label}
                        {isProviderReady(provider.id) ? "" : " (not configured)"}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={16}
                    className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-text-muted"
                  />
                </div>
              </div>

              {!isBrowserAI && (
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
                      {models.map((m) => (
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
                <p className="text-sm text-text-secondary">
                  {getBrowserAIModelLabel()} (on-device)
                </p>
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

  return (
    <>
      <BrowserAISection onStatusChange={setBrowserAIStatus} />
      {STAGE_GROUPS.map((group) => (
        <div className="mb-7" key={group.title}>
          <div className="mb-3">
            <h3 className="mb-0.5 text-sm font-semibold">{group.title}</h3>
            <p className="text-sm leading-snug text-text-muted">{group.subtitle}</p>
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
