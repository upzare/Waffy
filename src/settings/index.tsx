import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import toast, { Toaster } from 'react-hot-toast';
import Browser from 'webextension-polyfill';
import type { Settings } from '../types';

const sections = [
    { id: "general", label: "General", icon: "" },
];

const Settings = () => {
    const [settings, setSettings] = useState<Settings>({
        client_id: "",
        trace_user_id: "",
    });
    const [activeSection, setActiveSection] = useState('general');

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const localStorage = await Browser.storage.local.get("data");
                if (localStorage.data) {
                    setSettings(JSON.parse(localStorage.data as string));
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
            await Browser.storage.local.set({ data: JSON.stringify(settings) });
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
            client_id: "",
            trace_user_id: "",
        };
        await Browser.storage.local.set({ data: JSON.stringify(defaultSettings) });
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
                    <>
                    
                    </>
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