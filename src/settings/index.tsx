import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import toast, { Toaster } from 'react-hot-toast';
import Browser from 'webextension-polyfill';
import type { Settings } from '../types';
import { fetchPrompt, systemPrompt } from '../sidepanel/utils/SystemPrompt';

const sections = [
    { id: "general", label: "General", icon: "" },
];

const Settings = () => {
    const [settings, setSettings] = useState<Settings>({
        geminiApiKey: '',
        gptAPIKey: '',
        systemPrompt: '',
        fetchPrompt: '',
    });
    const [activeSection, setActiveSection] = useState('general');

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const stored = await Browser.storage.local.get("extension_settings");
                if (stored.extension_settings) {
                    setSettings(JSON.parse(stored.extension_settings as string));
                } else {
                    handleSave();
                }
            } catch (error) {
                console.error('Error loading settings:', error);
            }
        };
        loadSettings();
    }, []);

    const handleSave = async () => {
        try {
            await Browser.storage.local.set({ extension_settings: JSON.stringify(settings) });
            chrome.sidePanel.setOptions({
                path: "panel.html",
                enabled: false
            });
            chrome.sidePanel.setOptions({
                path: "panel.html",
                enabled: true
            });
            // @ts-ignore
            chrome.windows.getCurrent(w => chrome.sidePanel.open({ windowId: w.id }))
            toast.success('Settings saved successfully');
        } catch (error) {
            console.error('Error saving settings:', error);
            toast.error('Failed to save settings');
        }
    };

    const handleReset = async () => {
        const defaultSettings: Settings = {
            geminiApiKey: '',
            gptAPIKey: '',
            systemPrompt: systemPrompt,
            fetchPrompt: fetchPrompt,
        };
        await Browser.storage.local.set({ extension_settings: JSON.stringify(defaultSettings) });
        chrome.sidePanel.setOptions({
            path: "panel.html",
            enabled: false
        });
        chrome.sidePanel.setOptions({
            path: "panel.html",
            enabled: true
        });
        setSettings(defaultSettings);
        toast.success('Settings reset to default');
    };

    const renderSection = () => {
        switch (activeSection) {
            case 'general':
                return (
                    <div className="settings-section">
                        <div className="setting-item">
                            <h2>Gemini Models</h2>
                            <label htmlFor="apiKey">Gemini API Key</label>
                            <div className="api-key-input">
                                <input
                                    type="password"
                                    id="apiKey"
                                    value={settings.geminiApiKey}
                                    onChange={(e) => setSettings({ ...settings, geminiApiKey: e.target.value })}
                                    placeholder="Enter your API key"
                                />
                                <a
                                    href="https://aistudio.google.com/app/apikey"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="link-button"
                                >
                                    Get API Key
                                </a>
                            </div>
                            <p>Use Gemini API Key to use Gemini Models.</p>
                        </div>
                        <div className="setting-item">
                            <h2>OpenAI Models</h2>
                            <label htmlFor="apiKey">OpenAI API Key</label>
                            <div className="api-key-input">
                                <input
                                    type="password"
                                    id="apiKey"
                                    value={settings.gptAPIKey}
                                    onChange={(e) => setSettings({ ...settings, gptAPIKey: e.target.value })}
                                    placeholder="Enter your API key"
                                />
                                <a
                                    href="https://platform.openai.com/settings/organization/api-keys"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="link-button"
                                >
                                    Get API Key
                                </a>
                            </div>
                            <p>Use OpenAI API Key to use GPT Models.</p>
                        </div>
                        <div className="setting-item">
                            <h2>System Prompt</h2>
                            <label htmlFor="input-textarea">Model System Prompt</label>
                            <div className="input-textarea">
                                <textarea
                                    value={settings.systemPrompt}
                                    onChange={(e) => setSettings({ ...settings, systemPrompt: e.target.value })}
                                    placeholder="Specify system prompt for model..."
                                />
                            </div>
                            <br />
                            <label htmlFor="input-textarea">Fetch Screen Prompt</label>
                            <div className="input-textarea">
                                <textarea
                                    value={settings.fetchPrompt}
                                    onChange={(e) => setSettings({ ...settings, fetchPrompt: e.target.value })}
                                    placeholder="System Prompt for model"
                                />
                            </div>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="settings-page">
            <Toaster
                position="top-center"
                reverseOrder={false}
            />
            <div className="settings-sidebar">
                <div className="settings-sidebar-header">
                    <h1>Waffy</h1>
                </div>
                {sections.map((section) => (
                    <button
                        key={section.id}
                        className={`sidebar-item ${activeSection === section.id ? 'active' : ''}`}
                        onClick={() => setActiveSection(section.id)}
                    >
                        <i className={`fas ${section.icon}`}></i>
                        <span>{section.label}</span>
                    </button>
                ))}
            </div>
            <div className="settings-main">
                <div className="settings-header">
                    <h1>Extension Settings</h1>
                </div>

                <div className="settings-content">
                    {renderSection()}
                </div>
                <div className="settings-footer">
                    <button className="reset-button" onClick={handleReset}>
                        Reset to Default
                    </button>
                    <div className="action-buttons">
                        <button className="cancel-button">
                            Cancel
                        </button>
                        <button className="save-button" onClick={handleSave}>
                            Save Changes
                        </button>
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