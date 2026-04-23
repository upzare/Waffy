import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import toast, { Toaster } from 'react-hot-toast';
import Browser from 'webextension-polyfill';
import { Settings as SettingsIcon, CreditCard, Activity, User, Info } from 'lucide-react';
import type { Settings as SettingsType } from '../types';
import styles from 'css/settings/Settings.module.css';

import GeneralSection from './components/GeneralSection';
import AccountSection from './components/AccountSection';
import BillingSection from './components/BillingSection';
import UsageSection from './components/UsageSection';
import AboutSection from './components/AboutSection';

const sections = [
    { id: "general", label: "General", description: "Manage your core extension preferences and configurations.", icon: SettingsIcon },
    { id: "account", label: "Account", description: "View your account information fetched from the server.", icon: User },
    { id: "billing", label: "Billing & Payments", description: "Manage your credits, payment methods, and billing history.", icon: CreditCard },
    { id: "usage", label: "Usage", description: "Monitor your API usage and limits over time.", icon: Activity },
    { id: "about", label: "About", description: "Information about Waffy and its creators.", icon: Info },
];

const mockServerData = {
    client_id: "client_9a8b7c6d5e4f3g2h",
    trace_user_id: "usr_trace_12345",
    account_id: "acc_987654321",
    name: "John Doe",
    email: "john.doe@example.com",
    available_balance: 37.52,
    total_spend: 12.48,
    automations_run: 1248,
    tokens_used: "452k",
    time_saved: "14hrs",
};

const mockInvoices = [
    { id: "INV-2026-001", date: "Apr 01, 2026", amount: "$12.48", status: "Paid" },
    { id: "INV-2026-002", date: "Mar 01, 2026", amount: "$8.99", status: "Paid" },
    { id: "INV-2026-003", date: "Feb 01, 2026", amount: "$15.00", status: "Paid" },
];

const Settings = () => {
    const [settings, setSettings] = useState<SettingsType>({
        client_id: "",
        trace_user_id: "",
    });

    const getHashSection = () => {
        const hash = window.location.hash.replace('#', '');
        if (hash === "" || !sections.some(s => s.id === hash)) {
            window.location.hash = sections[0].id;
            window.location.reload();
        }
        return hash;
    };

    const [activeSection, setActiveSection] = useState(getHashSection);

    // General settings states
    const [theme, setTheme] = useState('dark');
    const [defaultModel, setDefaultModel] = useState('gpt-4o');
    const [showNotificationBadge, setShowNotificationBadge] = useState(true);
    const [enableHistory, setEnableHistory] = useState(true);
    const [enableKeyboardShortcuts, setEnableKeyboardShortcuts] = useState(true);

    // Privacy states
    const [telemetry, setTelemetry] = useState(false);

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
        const defaultSettings: SettingsType = {
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
        setTheme('dark');
        setDefaultModel('gpt-4o');
        setShowNotificationBadge(true);
        setEnableHistory(true);
        setEnableKeyboardShortcuts(true);
        setTelemetry(false);
        toast.success('Settings reset to default');
    };

    const renderSection = () => {
        switch (activeSection) {
            case 'general':
                return (
                    <GeneralSection
                        theme={theme}
                        setTheme={setTheme}
                        defaultModel={defaultModel}
                        setDefaultModel={setDefaultModel}
                        showNotificationBadge={showNotificationBadge}
                        setShowNotificationBadge={setShowNotificationBadge}
                        enableHistory={enableHistory}
                        setEnableHistory={setEnableHistory}
                        enableKeyboardShortcuts={enableKeyboardShortcuts}
                        setEnableKeyboardShortcuts={setEnableKeyboardShortcuts}
                        telemetry={telemetry}
                        setTelemetry={setTelemetry}
                    />
                );
            case 'account':
                return <AccountSection serverData={mockServerData} />;
            case 'billing':
                return <BillingSection serverData={mockServerData} invoices={mockInvoices} />;
            case 'usage':
                return <UsageSection serverData={mockServerData} />;
            case 'about':
                return <AboutSection logoUrl={Browser.runtime.getURL('assets/logo.svg')} />;
            default:
                return null;
        }
    };

    return (
        <div className={styles.settingsPage}>
            <Toaster position="top-center" reverseOrder={false} />
            <div className={styles.settingsSidebar}>
                <div className={styles.settingsSidebarHeader}>
                    <img src={Browser.runtime.getURL('assets/logo.svg')} alt="Waffy Logo" className={styles.sidebarLogo} />
                    <h1>Waffy</h1>
                </div>
                {sections.map((section) => {
                    const Icon = section.icon;
                    return (
                        <button
                            key={section.id}
                            className={`${styles.sidebarItem} ${activeSection === section.id ? styles.active : ''}`}
                            onClick={() => {
                                setActiveSection(section.id);
                                window.location.hash = section.id;
                            }}
                        >
                            <Icon size={18} />
                            <span>{section.label}</span>
                        </button>
                    );
                })}
            </div>
            <div className={styles.settingsMain}>
                <div className={styles.settingsHeader}>
                    <div className={styles.settingsHeaderTitle}>
                        <h2>{sections.find(s => s.id === activeSection)?.label}</h2>
                        <p className={styles.settingsHeaderDescription}>{sections.find(s => s.id === activeSection)?.description}</p>
                    </div>
                </div>

                <div className={styles.settingsContent}>
                    {renderSection()}
                </div>
                <div className={styles.settingsFooter}>
                    <button className={styles.resetButton} onClick={handleReset}>
                        Reset
                    </button>
                    <div className={styles.actionButtons}>
                        <button className={styles.cancelButton} onClick={() => window.close()}>
                            Cancel
                        </button>
                        <button className={styles.saveButton} onClick={handleSave}>
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