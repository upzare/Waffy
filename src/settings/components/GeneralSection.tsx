import React from 'react';
import styles from 'css/settings/Settings.module.css';

interface GeneralSectionProps {
    theme: string;
    setTheme: (value: string) => void;
    defaultModel: string;
    setDefaultModel: (value: string) => void;
    showNotificationBadge: boolean;
    setShowNotificationBadge: (value: boolean) => void;
    enableHistory: boolean;
    setEnableHistory: (value: boolean) => void;
    enableKeyboardShortcuts: boolean;
    setEnableKeyboardShortcuts: (value: boolean) => void;
    telemetry: boolean;
    setTelemetry: (value: boolean) => void;
}

const GeneralSection: React.FC<GeneralSectionProps> = ({
    theme, setTheme,
    defaultModel, setDefaultModel,
    showNotificationBadge, setShowNotificationBadge,
    enableHistory, setEnableHistory,
    enableKeyboardShortcuts, setEnableKeyboardShortcuts,
    telemetry, setTelemetry,
}) => {
    return (
        <div className={styles.sectionContainer}>
            <div className={styles.card}>
                <div className={styles.cardTitle}>Appearance & Behavior</div>

                <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Theme</label>
                    <select className={styles.formInput} value={theme} onChange={(e) => setTheme(e.target.value)}>
                        <option value="system">System Default</option>
                        <option value="dark">Dark Mode</option>
                        <option value="light">Light Mode</option>
                    </select>
                </div>

                <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Default AI Model</label>
                    <select className={styles.formInput} value={defaultModel} onChange={(e) => setDefaultModel(e.target.value)}>
                        <option value="gpt-4o">GPT-4o (Recommended)</option>
                        <option value="claude-3-5">Claude 3.5 Sonnet</option>
                        <option value="gemini-1-5">Gemini 1.5 Pro</option>
                    </select>
                </div>

                <div className={styles.formGroup}>
                    <label className={styles.checkboxWrapper}>
                        <input type="checkbox" className={styles.checkboxInput} checked={showNotificationBadge} onChange={(e) => setShowNotificationBadge(e.target.checked)} />
                        <div className={styles.checkboxLabel}>
                            <span className={styles.checkboxTitle}>Show notification badge</span>
                            <span className={styles.checkboxDescription}>Display a badge on the extension icon when automations complete.</span>
                        </div>
                    </label>
                </div>

                <div className={styles.formGroup}>
                    <label className={styles.checkboxWrapper}>
                        <input type="checkbox" className={styles.checkboxInput} checked={enableHistory} onChange={(e) => setEnableHistory(e.target.checked)} />
                        <div className={styles.checkboxLabel}>
                            <span className={styles.checkboxTitle}>Enable History</span>
                            <span className={styles.checkboxDescription}>Keep a record of your past automations and conversations.</span>
                        </div>
                    </label>
                </div>

                <div className={styles.formGroup}>
                    <label className={styles.checkboxWrapper}>
                        <input type="checkbox" className={styles.checkboxInput} checked={enableKeyboardShortcuts} onChange={(e) => setEnableKeyboardShortcuts(e.target.checked)} />
                        <div className={styles.checkboxLabel}>
                            <span className={styles.checkboxTitle}>Enable Keyboard Shortcuts</span>
                            <span className={styles.checkboxDescription}>Use keyboard shortcuts to quickly trigger automations and navigate.</span>
                        </div>
                    </label>
                </div>
            </div>

            <div className={styles.card}>
                <div className={styles.cardTitle}>Privacy & Data</div>
                <label className={styles.checkboxWrapper}>
                    <input type="checkbox" className={styles.checkboxInput} checked={telemetry} onChange={(e) => setTelemetry(e.target.checked)} />
                    <div className={styles.checkboxLabel}>
                        <span className={styles.checkboxTitle}>Share Telemetry Data</span>
                        <span className={styles.checkboxDescription}>Help us improve Waffy by sharing anonymous usage statistics and crash reports.</span>
                    </div>
                </label>
            </div>
        </div>
    );
};

export default GeneralSection;
