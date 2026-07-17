import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import toast, { Toaster } from "react-hot-toast";
import Browser from "webextension-polyfill";
import { Settings as SettingsIcon, Key, Cpu, Info } from "lucide-react";
import { getAppSettings, saveAppSettings, DEFAULT_PINNED_PROMPTS } from "@/lib/client";
import { DEFAULT_MODELS } from "@/lib/llm/model";
import type { ApiKeys, Settings as SettingsType } from "../types";
import "@/stylesheets/globals.css";

import GeneralSection from "./components/general";
import ApiKeysSection from "./components/api-keys";
import ModelsSection from "./components/models";
import AboutSection from "./components/about";
import {
  dangerButton,
  primaryButton,
  secondaryButton,
  thinScroll,
} from "./styles";

const sections = [
  {
    id: "general",
    label: "General",
    description: "Manage your core extension preferences.",
    icon: SettingsIcon,
  },
  {
    id: "api-keys",
    label: "API Keys",
    description: "Connect your OpenAI, Anthropic, Google, OpenRouter, xAI, or Groq API keys.",
    icon: Key,
  },
  {
    id: "models",
    label: "Models",
    description: "Configure cloud and local browser models for each stages.",
    icon: Cpu,
  },
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
  const hash = window.location.hash.replace("#", "");
  if (hash === "" || !sections.some((section) => section.id === hash)) {
    return sections[0].id;
  }
  return hash;
};

const Settings = () => {
  const [activeSection, setActiveSection] = useState(getHashSection);
  const activeSectionMeta = sections.find((section) => section.id === activeSection) ?? sections[0];
  const logoUrl = Browser.runtime.getURL("assets/logo.svg");

  const [settings, setSettings] = useState<SettingsType>(defaultSettings);
  const [apiKeys, setApiKeys] = useState<ApiKeys>({});

  const [theme, setTheme] = useState("system");
  const [enableHistory, setEnableHistory] = useState(true);
  const [enableNotifications, setEnableNotifications] = useState(true);
  const [pinnedPrompts, setPinnedPrompts] = useState<string[]>([...DEFAULT_PINNED_PROMPTS]);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await getAppSettings();
        setSettings(data.settings);
        setApiKeys(data.apiKeys);
        setTheme(data.settings.theme ?? "system");
        setEnableHistory(data.settings.enableHistory ?? true);
        setEnableNotifications(data.settings.enableNotifications ?? true);
        setPinnedPrompts(
          data.settings.pinnedPrompts !== undefined
            ? data.settings.pinnedPrompts.length > 0
              ? data.settings.pinnedPrompts
              : [""]
            : [...DEFAULT_PINNED_PROMPTS]
        );
      } catch (error) {
        console.error("Error loading settings:", error);
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
      chrome.runtime.sendMessage({ action: "RELOAD_PANEL" });
      toast.success("Settings saved successfully");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings");
    }
  };

  const handleReset = () => {
    setSettings(defaultSettings);
    setApiKeys({});
    setTheme("system");
    setEnableHistory(true);
    setEnableNotifications(true);
    setPinnedPrompts([...DEFAULT_PINNED_PROMPTS]);
    toast.success("Changes reset to default values");
  };

  const renderSection = () => {
    switch (activeSection) {
      case "general":
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
      case "api-keys":
        return <ApiKeysSection apiKeys={apiKeys} setApiKeys={setApiKeys} />;
      case "models":
        return <ModelsSection settings={settings} setSettings={setSettings} apiKeys={apiKeys} />;
      case "about":
        return <AboutSection logoUrl={logoUrl} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-surface-0 font-sans text-text-primary md:flex-row">
      <Toaster position="top-center" reverseOrder={false} />

      <aside className="flex shrink-0 flex-col gap-2 border-b border-border bg-surface-1 p-3 md:w-70 md:border-r md:border-b-0 md:px-3 md:py-4">
        <div className="flex items-center justify-center gap-3 px-2 pb-3 pt-1 md:px-3 md:pb-5 md:pt-2">
          <img src={logoUrl} alt="Waffy Logo" className="h-9 w-9" />
          <h1 className="text-xl font-bold tracking-tight">Extension Settings</h1>
        </div>

        <nav
          className={`flex flex-1 gap-1 overflow-x-auto pb-1 md:flex-col md:overflow-y-auto md:pb-0 ${thinScroll}`}
        >
          {sections.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            return (
              <button
                key={section.id}
                type="button"
                className={`flex min-w-18 flex-col items-center gap-2 rounded-md border px-2 py-2.5 text-left transition-colors duration-150 md:w-full md:min-w-0 md:flex-row md:gap-2.5 md:px-3 ${isActive
                    ? "border-green-border bg-green-dim text-green"
                    : "border-transparent text-text-secondary hover:bg-white/4 hover:text-text-primary"
                  }`}
                onClick={() => {
                  setActiveSection(section.id);
                  window.location.hash = section.id;
                }}
                aria-current={isActive ? "page" : undefined}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-sm ${isActive ? "bg-green-dim text-green" : "bg-white/4"
                    }`}
                >
                  <Icon size={17} />
                </span>
                <span className="text-xs font-medium leading-none md:text-sm">{section.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex justify-center border-b border-border bg-black/20 px-5 pb-5 pt-6 md:px-10 md:pt-8">
          <div className="flex w-full max-w-4xl flex-col gap-1.5">
            <h2 className="text-xl font-semibold tracking-tight md:text-2xl">
              {activeSectionMeta.label}
            </h2>
            <p className="text-sm leading-normal text-text-secondary">
              {activeSectionMeta.description}
            </p>
          </div>
        </header>

        <main
          className={`flex min-h-0 flex-1 flex-col items-center overflow-x-hidden overflow-y-auto px-5 py-6 md:px-10 md:pt-7 md:pb-8 ${thinScroll}`}
        >
          <div className="mx-auto w-full min-w-0 max-w-4xl animate-fade-in">
            {renderSection()}
          </div>
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface-1 px-5 py-4 md:gap-4 md:px-10">
          <button type="button" className={dangerButton} onClick={handleReset}>
            Reset Defaults
          </button>
          <div className="flex gap-3">
            <button type="button" className={secondaryButton} onClick={() => window.close()}>
              Cancel
            </button>
            <button type="button" className={primaryButton} onClick={handleSave}>
              Save Changes
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Settings />
  </React.StrictMode>
);
