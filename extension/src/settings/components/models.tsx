import React, { useState } from "react";
import { AlertCircle, ChevronDown, Info } from "lucide-react";
import { CUSTOM_MODEL_OPTION, isPresetModel, PROVIDER_MODELS } from "@/lib/llm/model";
import { getBrowserAIModelLabel, type BrowserAIStatus } from "@/lib/llm/browser-ai";
import { BROWSER_AI_PROVIDER, getProviderMeta, hasApiKey, PROVIDERS } from "../providers";
import type { CloudProviderId } from "../providers";
import BrowserAISection from "./browser-ai";
import type { ApiKeys, ModelConfig, ProviderId, Settings, StageId } from "@/types";
import styles from "css/settings/models.module.css";

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
      "Local models (Browser AI) work well here — fast, private, and free. Best for chat and title generation.",
    stages: [
      {
        id: "chat",
        label: "Chat Model",
        description:
          "Conversational assistant for chatting and question-answering.",
        recommendation: (
          <>
            Use the built-in browser model, with vision capability (like Gemini Nano) for free.
            For more advanced reasoning and querying, switch to a cloud model.
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
        description:
          "Performs the automation task based on the generated plan",
        recommendation: (
          <>
            Execution works best with vision models that support spatial reasoning and image grounding
            — they can identify UI element coordinates on screenshots. Recommended model:{" "}
            <strong>gemini-3.5-flash</strong> or similar.
          </>
        ),
      },
      {
        id: "t3",
        label: "Validation Model",
        description: "Validates that the task completed or not",
      },
      { id: "t4", label: "Output Model", description: "Generates a summary of the task completion" },
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
    if (browserAIStatus === "unsupported") {
      return (
        <div className={styles.stageWarning}>
          <AlertCircle size={15} />
          <span>Browser AI is not supported in this browser.</span>
        </div>
      );
    }

    if (browserAIStatus === "unavailable") {
      return (
        <div className={styles.stageWarning}>
          <AlertCircle size={15} />
          <span>Browser AI is unavailable on this device. Check storage and system requirements.</span>
        </div>
      );
    }

    if (browserAIStatus !== "available") {
      return (
        <div className={styles.stageWarning}>
          <AlertCircle size={15} />
          <span>Download Browser AI in the section above before using it for this stage.</span>
        </div>
      );
    }

    return null;
  };

  const renderStageRecommendation = (recommendation?: React.ReactNode) => {
    if (!recommendation) return null;

    return (
      <div className={styles.stageNote}>
        <Info size={15} />
        <span>{recommendation}</span>
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
      <div className={styles.stageCard} key={id}>
        <button
          type="button"
          className={styles.stageCardHeader}
          onClick={() => toggleStage(id)}
          aria-expanded={isExpanded}
        >
          <div className={styles.stageCardTitleGroup}>
            <span className={styles.stageCardTitle}>{label}</span>
            <p className={styles.stageCardDescription}>{description}</p>
          </div>
          <div className={styles.stageCardPreview}>
            <span className={styles.stageModelPreview}>
              {providerMeta.shortLabel} / {modelPreview}
            </span>
            <ChevronDown
              size={16}
              className={`${styles.stageChevron} ${isExpanded ? styles.stageChevronOpen : ""}`}
            />
          </div>
        </button>

        {isExpanded && (
          <div className={styles.stageCardBody}>
            {isBrowserAI
              ? renderBrowserAIWarning()
              : keyMissing && (
                <div className={styles.stageWarning}>
                  <AlertCircle size={15} />
                  <span>No API key for {providerMeta.label}. Add one in the API Keys section.</span>
                </div>
              )}

            {renderStageRecommendation(recommendation)}

            <div className={styles.stageFieldRow}>
              <div className={styles.stageField}>
                <label className={styles.fieldLabel} htmlFor={`${id}-provider`}>
                  Provider
                </label>
                <div className={styles.selectWrapper}>
                  <select
                    id={`${id}-provider`}
                    className={styles.selectInput}
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
                  <ChevronDown size={16} className={styles.selectChevron} />
                </div>
              </div>

              {!isBrowserAI && (
                <div className={styles.stageField}>
                  <label className={styles.fieldLabel} htmlFor={`${id}-model`}>
                    Model
                  </label>
                  <div className={styles.selectWrapper}>
                    <select
                      id={`${id}-model`}
                      className={styles.selectInput}
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
                    <ChevronDown size={16} className={styles.selectChevron} />
                  </div>
                </div>
              )}
            </div>

            {isBrowserAI && (
              <div className={styles.stageField}>
                <label className={styles.fieldLabel}>Model</label>
                <p className={styles.browserAiModelNote}>{getBrowserAIModelLabel()} (on-device)</p>
              </div>
            )}

            {isCustom && (
              <div className={styles.stageField}>
                <label className={styles.fieldLabel} htmlFor={`${id}-custom`}>
                  Custom model ID
                </label>
                <input
                  id={`${id}-custom`}
                  className={styles.textInput}
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
        <div className={styles.stageGroup} key={group.title}>
          <div className={styles.stageGroupHeader}>
            <h3 className={styles.stageGroupTitle}>{group.title}</h3>
            <p className={styles.stageGroupSubtitle}>{group.subtitle}</p>
          </div>
          <div className={styles.stageList}>
            {group.stages.map((stage) => renderStageCard(stage))}
          </div>
        </div>
      ))}
    </>
  );
};

export default ModelsSection;
