import React, { useMemo, useState } from 'react';
import { AlertCircle, ChevronDown } from 'lucide-react';
import { CUSTOM_MODEL_OPTION, isPresetModel, PROVIDER_MODELS } from '@/lib/llm/model';
import { getProviderMeta, hasApiKey, PROVIDERS } from '../providers';
import type { ApiKeys, ModelConfig, ProviderId, Settings, StageId } from '@/types';
import styles from 'css/settings/Models.module.css';

interface ModelsSectionProps {
    settings: Settings;
    setSettings: React.Dispatch<React.SetStateAction<Settings>>;
    apiKeys: ApiKeys;
}

interface StageGroup {
    title: string;
    subtitle: string;
    stages: { id: StageId; label: string; description: string }[];
}

const STAGE_GROUPS: StageGroup[] = [
    {
        title: 'Automation Pipeline',
        subtitle: 'Models for each stage of a browser automation run.',
        stages: [
            { id: 't1', label: 'Planning', description: 'Analyzes prompts and decides whether to automate' },
            { id: 't2', label: 'Execution', description: 'Browser automation with vision — use a vision-capable model' },
            { id: 't3', label: 'Validation', description: 'Validates that the task completed successfully' },
            { id: 't4', label: 'Output', description: 'Generates a user-friendly summary of results' },
        ],
    },
    {
        title: 'UI Helpers',
        subtitle: 'Models for in-panel text generation.',
        stages: [
            { id: 'title', label: 'Title Generation', description: 'Creates conversation titles from the first message' },
            { id: 'step', label: 'Step Generation', description: 'Short execution step descriptions shown in the UI' },
        ],
    },
];

const ModelsSection: React.FC<ModelsSectionProps> = ({ settings, setSettings, apiKeys }) => {
    const [expandedStages, setExpandedStages] = useState<Partial<Record<StageId, boolean>>>({});
    const providerHasKey = useMemo(
        () =>
            Object.fromEntries(
                PROVIDERS.map((provider) => [provider.id, hasApiKey(apiKeys, provider.id)])
            ) as Record<ProviderId, boolean>,
        [apiKeys]
    );

    const updateStage = (stage: StageId, patch: Partial<ModelConfig>) => {
        setSettings((prev) => ({
            ...prev,
            models: {
                ...prev.models,
                [stage]: {
                    provider: patch.provider ?? prev.models[stage]?.provider ?? 'openai',
                    model: patch.model ?? prev.models[stage]?.model ?? PROVIDER_MODELS.openai[0],
                },
            },
        }));
    };

    const toggleStage = (stage: StageId) => {
        setExpandedStages((prev) => ({ ...prev, [stage]: !prev[stage] }));
    };

    const renderStageCard = (id: StageId, label: string, description: string) => {
        const config = settings.models[id] ?? { provider: 'openai' as ProviderId, model: PROVIDER_MODELS.openai[0] };
        const models = PROVIDER_MODELS[config.provider] ?? [];
        const isCustom = !isPresetModel(config.provider, config.model);
        const selectValue = isCustom ? CUSTOM_MODEL_OPTION : config.model;
        const providerMeta = getProviderMeta(config.provider);
        const keyMissing = !providerHasKey[config.provider];
        const isExpanded = expandedStages[id] ?? false;

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
                            {providerMeta.shortLabel} / {config.model || '—'}
                        </span>
                        <ChevronDown size={16} className={`${styles.stageChevron} ${isExpanded ? styles.stageChevronOpen : ''}`} />
                    </div>
                </button>

                {isExpanded && (
                    <div className={styles.stageCardBody}>
                        {keyMissing && (
                            <div className={styles.stageWarning}>
                                <AlertCircle size={15} />
                                <span>No API key for {providerMeta.label}. Add one in the API Keys section.</span>
                            </div>
                        )}

                        <div className={styles.stageFieldRow}>
                            <div className={styles.stageField}>
                                <label className={styles.fieldLabel} htmlFor={`${id}-provider`}>Provider</label>
                                <div className={styles.selectWrapper}>
                                    <select
                                        id={`${id}-provider`}
                                        className={styles.selectInput}
                                        value={config.provider}
                                        onChange={(e) => updateStage(id, {
                                            provider: e.target.value as ProviderId,
                                            model: PROVIDER_MODELS[e.target.value as ProviderId][0],
                                        })}
                                    >
                                        {PROVIDERS.map((provider) => (
                                            <option key={provider.id} value={provider.id}>
                                                {provider.label}{providerHasKey[provider.id] ? '' : ' (no key)'}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown size={16} className={styles.selectChevron} />
                                </div>
                            </div>

                            <div className={styles.stageField}>
                                <label className={styles.fieldLabel} htmlFor={`${id}-model`}>Model</label>
                                <div className={styles.selectWrapper}>
                                    <select
                                        id={`${id}-model`}
                                        className={styles.selectInput}
                                        value={selectValue}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            if (value === CUSTOM_MODEL_OPTION) {
                                                updateStage(id, { model: isCustom ? config.model : '' });
                                            } else {
                                                updateStage(id, { model: value });
                                            }
                                        }}
                                    >
                                        {models.map((m) => (
                                            <option key={m} value={m}>{m}</option>
                                        ))}
                                        <option value={CUSTOM_MODEL_OPTION}>Custom model ID…</option>
                                    </select>
                                    <ChevronDown size={16} className={styles.selectChevron} />
                                </div>
                            </div>
                        </div>

                        {isCustom && (
                            <div className={styles.stageField}>
                                <label className={styles.fieldLabel} htmlFor={`${id}-custom`}>Custom model ID</label>
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
            {STAGE_GROUPS.map((group) => (
                <div className={styles.stageGroup} key={group.title}>
                    <div className={styles.stageGroupHeader}>
                        <h3 className={styles.stageGroupTitle}>{group.title}</h3>
                        <p className={styles.stageGroupSubtitle}>{group.subtitle}</p>
                    </div>
                    <div className={styles.stageList}>
                        {group.stages.map(({ id, label, description }) =>
                            renderStageCard(id, label, description)
                        )}
                    </div>
                </div>
            ))}
        </>
    );
};

export default ModelsSection;
