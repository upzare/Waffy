import React, { useState } from 'react';
import { ExternalLink, Eye, EyeOff } from 'lucide-react';
import { hasApiKey, PROVIDERS } from '../providers';
import type { ApiKeys } from '@/types';
import styles from 'css/settings/api-keys.module.css';

interface ApiKeysSectionProps {
    apiKeys: ApiKeys;
    setApiKeys: React.Dispatch<React.SetStateAction<ApiKeys>>;
}

const ApiKeysSection: React.FC<ApiKeysSectionProps> = ({ apiKeys, setApiKeys }) => {
    const [visibleKeys, setVisibleKeys] = useState<Partial<Record<keyof ApiKeys, boolean>>>({});

    const toggleVisibility = (key: keyof ApiKeys) => {
        setVisibleKeys((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    return (
        <>
            <div className={styles.providerGrid}>
                {PROVIDERS.map((provider) => {
                    const isConfigured = hasApiKey(apiKeys, provider.id);
                    const isVisible = visibleKeys[provider.id];
                    const value = apiKeys[provider.id] ?? '';

                    return (
                        <div key={provider.id} className={styles.providerCard}>
                            <div className={styles.providerCardHeader}>
                                <div>
                                    <div className={styles.providerName}>{provider.label}</div>
                                    <div className={styles.providerDescription}>{provider.description}</div>
                                </div>
                                <span className={`${styles.statusBadge} ${isConfigured ? styles.statusBadgeActive : ''}`}>
                                    {isConfigured ? 'Configured' : 'Not Configured'}
                                </span>
                            </div>

                            <div className={styles.secretInputWrapper}>
                                <input
                                    className={styles.secretInput}
                                    type={isVisible ? 'text' : 'password'}
                                    placeholder={provider.placeholder}
                                    value={value}
                                    onChange={(e) => setApiKeys((prev) => ({ ...prev, [provider.id]: e.target.value }))}
                                    autoComplete="off"
                                    spellCheck={false}
                                />
                                <button
                                    type="button"
                                    className={styles.secretToggle}
                                    onClick={() => toggleVisibility(provider.id)}
                                    aria-label={isVisible ? 'Hide API key' : 'Show API key'}
                                >
                                    {isVisible ? <EyeOff size={15} /> : <Eye size={15} />}
                                </button>
                            </div>

                            <a
                                href={provider.docsUrl}
                                target="_blank"
                                rel="noreferrer"
                                className={styles.providerDocsLink}
                            >
                                Get API key <ExternalLink size={13} />
                            </a>
                        </div>
                    );
                })}
            </div>
        </>
    );
};

export default ApiKeysSection;
