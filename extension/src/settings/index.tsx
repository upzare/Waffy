import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import toast, { Toaster } from "react-hot-toast";
import Browser from "webextension-polyfill";
import { Settings as SettingsIcon, Key, Server, Cpu, Info } from "lucide-react";
import {
  getAppSettings,
  saveAppSettings,
  DEFAULT_PINNED_PROMPTS,
  DEFAULT_SETTINGS,
} from "@/lib/client";
import type { ApiKeys, Settings as SettingsType } from "../types";
import "@/stylesheets/globals.css";

import GeneralSection from "./components/general";
import ApiKeysSection from "./components/api-keys";
import CustomApiSection from "./components/custom-api";
import ModelsSection from "./components/models";
import AboutSection from "./components/about";
import { dangerButton, primaryButton, secondaryButton, thinScroll } from "./styles";

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
  {
    id: "custom-api",
    label: "Custom API",
    description: "Connect an OpenAI-compatible endpoint with a URL, API key, and model.",
    icon: Server,
  },
  {
    id: "about",
    label: "About",
    description: "Version and product information.",
    icon: Info,
  },
];

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

  const [settings, setSettings] = useState<SettingsType>({ ...DEFAULT_SETTINGS });
  const [apiKeys, setApiKeys] = useState<ApiKeys>({});
  const [pinnedPrompts, setPinnedPrompts] = useState<string[]>([...DEFAULT_PINNED_PROMPTS]);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await getAppSettings();
        setSettings(data.settings);
        setApiKeys(data.apiKeys);
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
        pinnedPrompts: pinnedPrompts.map((prompt) => prompt.trim()).filter(Boolean),
      };
      await saveAppSettings(merged, apiKeys);
      setSettings(merged);
      Browser.runtime.sendMessage({ action: "RELOAD_PANEL" });
      toast.success("Settings saved successfully");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings");
    }
  };

  const handleReset = () => {
    setSettings({ ...DEFAULT_SETTINGS });
    setApiKeys({});
    setPinnedPrompts([...DEFAULT_PINNED_PROMPTS]);
    toast.success("Changes reset to default values");
  };

  const renderSection = () => {
    switch (activeSection) {
      case "general":
        return (
          <GeneralSection
            settings={settings}
            setSettings={setSettings}
            pinnedPrompts={pinnedPrompts}
            setPinnedPrompts={setPinnedPrompts}
          />
        );
      case "api-keys":
        return <ApiKeysSection apiKeys={apiKeys} setApiKeys={setApiKeys} />;
      case "models":
        return <ModelsSection settings={settings} setSettings={setSettings} apiKeys={apiKeys} />;
      case "custom-api":
        return (
          <CustomApiSection
            settings={settings}
            setSettings={setSettings}
            apiKeys={apiKeys}
            setApiKeys={setApiKeys}
          />
        );
      case "about":
        return <AboutSection logoUrl={logoUrl} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-surface-0 font-sans text-text-primary md:flex-row">
      <Toaster position="top-center" reverseOrder={false} />

      <aside className="flex shrink-0 flex-col border-b border-border bg-surface-1 md:w-70 md:border-r md:border-b-0">
        <div className="flex items-center gap-2.5 px-4 py-3 md:gap-3 md:px-5 md:pb-5 md:pt-6">
          <img src={logoUrl} alt="Waffy Logo" className="h-8 w-8 shrink-0 md:h-9 md:w-9" />
          <h1 className="truncate text-lg font-bold tracking-tight md:text-xl">
            Extension Settings
          </h1>
        </div>

        <nav
          className={`flex w-full gap-1 px-2 pb-2 md:flex-1 md:flex-col md:gap-1 md:overflow-y-auto md:px-3 md:pb-4 ${thinScroll}`}
        >
          {sections.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            return (
              <button
                key={section.id}
                type="button"
                className={`flex flex-1 flex-col items-center justify-center gap-1.5 rounded-md border px-1 py-2 text-center transition-colors duration-150 md:w-full md:flex-none md:flex-row md:justify-start md:gap-2.5 md:px-3 md:py-2.5 md:text-left ${isActive
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
                <span className="text-[11px] font-medium leading-none md:text-sm">
                  {section.label}
                </span>
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
          <div className="mx-auto w-full min-w-0 max-w-4xl animate-fade-in">{renderSection()}</div>
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
