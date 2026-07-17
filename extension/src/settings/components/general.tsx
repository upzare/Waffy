import React from "react";
import { Bell, History, Monitor, Moon, Pin, Plus, Sun, X } from "lucide-react";
import { iconBox, iconButton, panel, panelSubtitle, panelTitle } from "../styles";

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

const MIN_PINNED_PROMPTS = 2;
const MAX_PINNED_PROMPTS = 4;

const THEME_OPTIONS = [
  { value: "system", label: "System", icon: Monitor },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "light", label: "Light", icon: Sun },
];

const toggleClass =
  "relative h-6 w-11 shrink-0 appearance-none rounded-full border border-border-strong bg-white/10 transition-[background,border-color] duration-200 before:absolute before:top-[2px] before:left-[2px] before:h-4.5 before:w-4.5 before:rounded-full before:bg-white/70 before:transition-[transform,background] before:duration-200 before:content-[''] checked:border-green-border checked:bg-green-dim checked:before:translate-x-5 checked:before:bg-green";

const behaviorRow =
  "flex flex-col gap-3 rounded-sm border border-border bg-black/20 px-3.5 py-3.5 transition-colors duration-150 hover:border-border-strong hover:bg-white/[0.03] sm:flex-row sm:items-center sm:justify-between sm:gap-4";

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
    if (pinnedPrompts.length <= MIN_PINNED_PROMPTS) return;
    setPinnedPrompts(pinnedPrompts.filter((_, i) => i !== index));
  };

  const addPrompt = () => {
    if (pinnedPrompts.length >= MAX_PINNED_PROMPTS) return;
    setPinnedPrompts([...pinnedPrompts, ""]);
  };

  return (
    <>
      <div className={panel}>
        <div className="mb-4">
          <h3 className={panelTitle}>Pinned Prompts</h3>
          <p className={panelSubtitle}>Customize the quick prompts shown on the home screen.</p>
        </div>

        <div className="mb-3 flex flex-col gap-2">
          {pinnedPrompts.map((prompt, index) => (
            <div key={index} className="flex items-center gap-2 sm:gap-2.5">
              <div className={`${iconBox} hidden sm:flex`}>
                <Pin size={15} />
              </div>
              <input
                type="text"
                className="min-w-0 flex-1 rounded-sm border border-border bg-black/25 px-3 py-2.5 text-sm text-text-primary transition-colors duration-150 placeholder:text-text-muted focus:border-green-border focus:bg-black/35 focus:outline-none"
                value={prompt}
                placeholder={`Prompt ${index + 1}`}
                onChange={(e) => updatePrompt(index, e.target.value)}
                spellCheck={false}
              />
              <button
                type="button"
                className={iconButton}
                onClick={() => removePrompt(index)}
                disabled={pinnedPrompts.length <= MIN_PINNED_PROMPTS}
                title="Remove prompt"
              >
                <X size={15} />
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-sm border border-dashed border-border-strong bg-white/4 px-3.5 py-2 text-sm font-medium text-text-secondary transition-colors duration-150 hover:enabled:border-green-border hover:enabled:bg-white/6 hover:enabled:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
          onClick={addPrompt}
          disabled={pinnedPrompts.length >= MAX_PINNED_PROMPTS}
        >
          <Plus size={15} />
          Add prompt
        </button>
      </div>

      <div className={panel}>
        <div className="mb-4">
          <h3 className={panelTitle}>Appearance</h3>
          <p className={panelSubtitle}>Choose how Waffy looks on your system.</p>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              className={`flex flex-col items-center gap-2 rounded-sm border px-2 py-3.5 text-sm font-medium transition-colors duration-150 ${theme === value
                  ? "border-green-border bg-green-dim text-green"
                  : "border-border bg-black/25 text-text-secondary hover:bg-white/4 hover:text-text-primary"
                }`}
              onClick={() => setTheme(value)}
              aria-pressed={theme === value}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={panel}>
        <div className="mb-4">
          <h3 className={panelTitle}>Behavior</h3>
          <p className={panelSubtitle}>Control notifications and data retention.</p>
        </div>

        <div className="flex flex-col gap-2">
          <label className={behaviorRow}>
            <div className="flex min-w-0 items-start gap-3">
              <div className={iconBox}>
                <Bell size={16} />
              </div>
              <div>
                <span className="block text-sm font-semibold leading-tight text-text-primary">
                  Notification badge
                </span>
                <span className="mt-0.5 block text-xs leading-snug text-text-muted">
                  Show a badge on the extension icon when automations complete.
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              className={toggleClass}
              checked={enableNotifications}
              onChange={(e) => setEnableNotifications(e.target.checked)}
            />
          </label>

          <label className={behaviorRow}>
            <div className="flex min-w-0 items-start gap-3">
              <div className={iconBox}>
                <History size={16} />
              </div>
              <div>
                <span className="block text-sm font-semibold leading-tight text-text-primary">
                  Conversation history
                </span>
                <span className="mt-0.5 block text-xs leading-snug text-text-muted">
                  Keep a record of past automations and chats on this device.
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              className={toggleClass}
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
