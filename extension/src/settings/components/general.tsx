import React from "react";
import { Bell, History, Monitor, Moon, Pin, Plus, Sun, X } from "lucide-react";
import styles from "css/settings/general.module.css";

interface GeneralSectionProps {
  theme: string;
  setTheme: (value: string) => void;
  enableHistory: boolean;
  setEnableHistory: (value: boolean) => void;
  enableNotifications: boolean;
  setEnableNotifications: (value: boolean) => void;
  pinnedPrompts: string[];
  setPinnedPrompts: (value: string[]) => void;
}

const MAX_PINNED_PROMPTS = 4;

const THEME_OPTIONS = [
  { value: "system", label: "System", icon: Monitor },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "light", label: "Light", icon: Sun },
];

const GeneralSection: React.FC<GeneralSectionProps> = ({
  theme,
  setTheme,
  enableHistory,
  setEnableHistory,
  enableNotifications,
  setEnableNotifications,
  pinnedPrompts,
  setPinnedPrompts,
}) => {
  const updatePrompt = (index: number, value: string) => {
    setPinnedPrompts(pinnedPrompts.map((prompt, i) => (i === index ? value : prompt)));
  };

  const removePrompt = (index: number) => {
    if (pinnedPrompts.length <= 1) return;
    setPinnedPrompts(pinnedPrompts.filter((_, i) => i !== index));
  };

  const addPrompt = () => {
    if (pinnedPrompts.length >= MAX_PINNED_PROMPTS) return;
    setPinnedPrompts([...pinnedPrompts, ""]);
  };

  return (
    <>
      <div className={styles.settingsPanel}>
        <div className={styles.settingsPanelHeader}>
          <h3 className={styles.settingsPanelTitle}>Pinned Prompts</h3>
          <p className={styles.settingsPanelSubtitle}>
            Customize the quick prompts shown on the home screen.
          </p>
        </div>

        <div className={styles.pinnedPromptsList}>
          {pinnedPrompts.map((prompt, index) => (
            <div key={index} className={styles.pinnedPromptRow}>
              <div className={styles.pinnedPromptIconWrap}>
                <Pin size={15} />
              </div>
              <input
                type="text"
                className={styles.pinnedPromptInput}
                value={prompt}
                placeholder={`Prompt ${index + 1}`}
                onChange={(e) => updatePrompt(index, e.target.value)}
                spellCheck={false}
              />
              <button
                type="button"
                className={styles.pinnedPromptRemove}
                onClick={() => removePrompt(index)}
                disabled={pinnedPrompts.length <= 1}
                title="Remove prompt"
              >
                <X size={15} />
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          className={styles.addPromptButton}
          onClick={addPrompt}
          disabled={pinnedPrompts.length >= MAX_PINNED_PROMPTS}
        >
          <Plus size={15} />
          Add prompt
        </button>
      </div>

      <div className={styles.settingsPanel}>
        <div className={styles.settingsPanelHeader}>
          <h3 className={styles.settingsPanelTitle}>Appearance</h3>
          <p className={styles.settingsPanelSubtitle}>Choose how Waffy looks on your system.</p>
        </div>

        <div className={styles.themeSelector}>
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              className={`${styles.themeOption} ${theme === value ? styles.themeOptionActive : ""}`}
              onClick={() => setTheme(value)}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.settingsPanel}>
        <div className={styles.settingsPanelHeader}>
          <h3 className={styles.settingsPanelTitle}>Behavior</h3>
          <p className={styles.settingsPanelSubtitle}>Control notifications and data retention.</p>
        </div>

        <div className={styles.toggleList}>
          <label className={styles.toggleRow}>
            <div className={styles.toggleInfo}>
              <div className={styles.toggleIconWrap}>
                <Bell size={16} />
              </div>
              <div>
                <span className={styles.toggleTitle}>Notification badge</span>
                <span className={styles.toggleDescription}>
                  Show a badge on the extension icon when automations complete.
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              className={styles.toggleInput}
              checked={enableNotifications}
              onChange={(e) => setEnableNotifications(e.target.checked)}
            />
          </label>

          <label className={styles.toggleRow}>
            <div className={styles.toggleInfo}>
              <div className={styles.toggleIconWrap}>
                <History size={16} />
              </div>
              <div>
                <span className={styles.toggleTitle}>Conversation history</span>
                <span className={styles.toggleDescription}>
                  Keep a record of past automations and chats on this device.
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              className={styles.toggleInput}
              checked={enableHistory}
              onChange={(e) => setEnableHistory(e.target.checked)}
            />
          </label>
        </div>
      </div>
    </>
  );
};

export default GeneralSection;
