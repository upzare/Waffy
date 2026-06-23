import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import toast, { Toaster } from 'react-hot-toast';
import Browser from 'webextension-polyfill';
import { Settings as SettingsIcon, Key, Cpu, Info } from 'lucide-react';
import { getAppSettings, saveAppSettings, DEFAULT_PINNED_PROMPTS } from '@/lib/client';
import { DEFAULT_MODELS } from '@/lib/llm/model';
import type { ApiKeys, Settings as SettingsType } from '../types';
import styles from 'css/settings/Root.module.css';

import GeneralSection from './components/GeneralSection';
import ApiKeysSection from './components/ApiKeysSection';
import ModelsSection from './components/ModelsSection';
import AboutSection from './components/AboutSection';

const sections = [
    { id: "general", label: "General", description: "Manage your core extension preferences.", icon: SettingsIcon },
    { id: "api-keys", label: "API Keys", description: "Connect your OpenAI, Anthropic, Google, OpenRouter, xAI, or Groq API keys.", icon: Key },
    { id: "models", label: "Models", description: "Configure which provider and model to use for each pipeline stage.", icon: Cpu },
    { id: "about", label: "About", description: "Information about Waffy.", icon: Info },
];

const defaultSettings: SettingsType = {
    theme: "system",
    enableHistory: true,
    enableNotifications: true,
    pinnedPrompts: [...DEFAULT_PINNED_PROMPTS],
    models: { ...DEFAULT_MODELS },
};

const getHashSection = () => {
    const hash = window.location.hash.replace('#', '');
    if (hash === "" || !sections.some((section) => section.id === hash)) {
        return sections[0].id;
    }
    return hash;
};

const Settings = () => {
    const [activeSection, setActiveSection] = useState(getHashSection);
    const activeSectionMeta = sections.find((section) => section.id === activeSection) ?? sections[0];
    const logoUrl = Browser.runtime.getURL('assets/logo.svg');

    const [settings, setSettings] = useState<SettingsType>(defaultSettings);
    const [apiKeys, setApiKeys] = useState<ApiKeys>({});

    const [theme, setTheme] = useState('system');
    const [enableHistory, setEnableHistory] = useState(true);
    const [enableNotifications, setEnableNotifications] = useState(true);
    const [pinnedPrompts, setPinnedPrompts] = useState<string[]>([...DEFAULT_PINNED_PROMPTS]);

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const data = await getAppSettings();
                setSettings(data.settings);
                setApiKeys(data.apiKeys);
                setTheme(data.settings.theme ?? 'system');
                setEnableHistory(data.settings.enableHistory ?? true);
                setEnableNotifications(data.settings.enableNotifications ?? true);
                setPinnedPrompts(
                    data.settings.pinnedPrompts !== undefined
                        ? (data.settings.pinnedPrompts.length > 0 ? data.settings.pinnedPrompts : [""])
                        : [...DEFAULT_PINNED_PROMPTS]
                );
            } catch (error) {
                console.error('Error loading settings:', error);
            }
        };
        loadSettings();
    }, []);

    const handleSave = async () => {
        try {
            const merged: SettingsType = {
                ...settings,
                theme,
                enableHistory,
                enableNotifications,
                pinnedPrompts: pinnedPrompts.map((prompt) => prompt.trim()).filter(Boolean),
            };
            await saveAppSettings(merged, apiKeys);
            setSettings(merged);
            chrome.sidePanel.setOptions({ path: "panel.html", enabled: false });
            chrome.sidePanel.setOptions({ path: "panel.html", enabled: true });
            toast.success('Settings saved successfully');
        } catch (error) {
            console.error('Error saving settings:', error);
            toast.error('Failed to save settings');
        }
    };

    const handleReset = () => {
        setSettings(defaultSettings);
        setApiKeys({});
        setTheme('system');
        setEnableHistory(true);
        setEnableNotifications(true);
        setPinnedPrompts([...DEFAULT_PINNED_PROMPTS]);
        toast.success('Changes reset to default values');
    };

    const renderSection = () => {
        switch (activeSection) {
            case 'general':
                return (
                    <GeneralSection
                        theme={theme}
                        setTheme={setTheme}
                        enableHistory={enableHistory}
                        setEnableHistory={setEnableHistory}
                        enableNotifications={enableNotifications}
                        setEnableNotifications={setEnableNotifications}
                        pinnedPrompts={pinnedPrompts}
                        setPinnedPrompts={setPinnedPrompts}
                    />
                );
            case 'api-keys':
                return <ApiKeysSection apiKeys={apiKeys} setApiKeys={setApiKeys} />;
            case 'models':
                return <ModelsSection settings={settings} setSettings={setSettings} apiKeys={apiKeys} />;
            case 'about':
                return <AboutSection logoUrl={logoUrl} />;
            default:
                return null;
        }
    };

    return (
        <div className={styles.settingsPage}>
            <Toaster position="top-center" reverseOrder={false} />
            <div className={styles.settingsSidebar}>
                <div className={styles.settingsSidebarHeader}>
                    <img src={logoUrl} alt="Waffy Logo" className={styles.sidebarLogo} />
                    <h1>Waffy Settings</h1>
                </div>
                <nav className={styles.sidebarNav}>
                    {sections.map((section) => {
                        const Icon = section.icon;
                        const isActive = activeSection === section.id;
                        return (
                            <button
                                key={section.id}
                                className={`${styles.sidebarItem} ${isActive ? styles.sidebarItemActive : ''}`}
                                onClick={() => {
                                    setActiveSection(section.id);
                                    window.location.hash = section.id;
                                }}
                            >
                                <span className={styles.sidebarItemIcon}>
                                    <Icon size={17} />
                                </span>
                                <span className={styles.sidebarItemLabel}>{section.label}</span>
                            </button>
                        );
                    })}
                </nav>
            </div>
            <div className={styles.settingsMain}>
                <div className={styles.settingsHeader}>
                    <div className={styles.settingsHeaderTitle}>
                        <h2>{activeSectionMeta.label}</h2>
                        <p className={styles.settingsHeaderDescription}>{activeSectionMeta.description}</p>
                    </div>
                </div>
                <div className={styles.settingsContent}>
                    <div className={styles.sectionContainer}>
                        {renderSection()}
                    </div>
                </div>
                <div className={styles.settingsFooter}>
                    <button className={styles.resetButton} onClick={handleReset}>Reset Defaults</button>
                    <div className={styles.actionButtons}>
                        <button className={styles.cancelButton} onClick={() => window.close()}>Cancel</button>
                        <button className={styles.saveButton} onClick={handleSave}>Save Changes</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <Settings />
    </React.StrictMode>
);
