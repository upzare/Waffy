import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import toast, { Toaster } from "react-hot-toast";
import Browser from "webextension-polyfill";
import { Brain, Cpu, Info, Key, LifeBuoy, Server, Settings as SettingsIcon } from "lucide-react";
import {
  DEFAULT_PINNED_PROMPTS,
  DEFAULT_SETTINGS,
  getAppSettings,
  saveAppSettings,
} from "@/lib/client";
import type { ApiKeys, AppSettings, Settings as SettingsType } from "@/types";
import "@/stylesheets/globals.css";

import GeneralSection from "./components/general";
import MemorySection from "./components/memory";
import ApiKeysSection from "./components/api-keys";
import CustomApiSection from "./components/custom-api";
import ModelsSection from "./components/models";
import SupportSection from "./components/support";
import AboutSection from "./components/about";
import { thinScroll } from "./styles";

const SAVE_DELAY_MS = 400;
const LOGO_URL = Browser.runtime.getURL("assets/logo.svg");

const SECTIONS = [
  {
    id: "general",
    label: "General",
    description: "Manage your core extension preferences.",
    icon: SettingsIcon,
  },
  {
    id: "memory",
    label: "Memory",
    description: "Turn personalized memory on or off, and review what has been saved.",
    icon: Brain,
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
    description: "Configure cloud and local browser models for each stage.",
    icon: Cpu,
  },
  {
    id: "custom-api",
    label: "Custom API",
    description: "Connect an OpenAI-compatible endpoint with a URL, API key, and model.",
    icon: Server,
  },
  {
    id: "support",
    label: "Support",
    description: "Report a bug or get help from the community.",
    icon: LifeBuoy,
  },
  {
    id: "about",
    label: "About",
    description: "Version and product information.",
    icon: Info,
  },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

interface SettingsForm {
  settings: SettingsType;
  apiKeys: ApiKeys;
  pinnedPrompts: string[];
}

const createDefaultSettings = (): SettingsType => ({
  ...DEFAULT_SETTINGS,
  pinnedPrompts: [...DEFAULT_PINNED_PROMPTS],
  models: Object.fromEntries(
    Object.entries(DEFAULT_SETTINGS.models).map(([stage, config]) => [
      stage,
      config && { ...config },
    ])
  ) as SettingsType["models"],
  customApi: { ...DEFAULT_SETTINGS.customApi },
});

const createDefaultForm = (): SettingsForm => ({
  settings: createDefaultSettings(),
  apiKeys: {},
  pinnedPrompts: [...DEFAULT_PINNED_PROMPTS],
});

const getEditablePrompts = (settings: SettingsType) =>
  settings.pinnedPrompts.length > 0 ? [...settings.pinnedPrompts] : [""];

const buildPayload = ({ settings, apiKeys, pinnedPrompts }: SettingsForm): AppSettings => ({
  settings: {
    ...settings,
    pinnedPrompts: pinnedPrompts.map((prompt) => prompt.trim()).filter(Boolean),
  },
  apiKeys,
});

const serializePayload = (form: SettingsForm) => JSON.stringify(buildPayload(form));

const isSectionId = (value: string): value is SectionId =>
  SECTIONS.some((section) => section.id === value);

const getHashSection = (): SectionId => {
  const hash = window.location.hash.replace("#", "");
  return isSectionId(hash) ? hash : SECTIONS[0].id;
};

const useSettingsForm = () => {
  const [defaults] = useState(createDefaultForm);
  const [settings, setSettings] = useState(defaults.settings);
  const [apiKeys, setApiKeys] = useState(defaults.apiKeys);
  const [pinnedPrompts, setPinnedPrompts] = useState(defaults.pinnedPrompts);
  const [loaded, setLoaded] = useState(false);

  const formRef = useRef<SettingsForm>(defaults);
  const lastSavedRef = useRef<string | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const saveQueueRef = useRef<Promise<boolean>>(Promise.resolve(true));

  formRef.current = { settings, apiKeys, pinnedPrompts };

  const clearPendingSave = useCallback(() => {
    if (saveTimerRef.current === null) return;
    window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
  }, []);

  const persist = useCallback((form: SettingsForm) => {
    const payload = buildPayload(form);
    const serialized = JSON.stringify(payload);

    const save = async () => {
      if (serialized === lastSavedRef.current) return true;

      try {
        await saveAppSettings(payload.settings, payload.apiKeys);
        lastSavedRef.current = serialized;
        void Browser.runtime.sendMessage({ action: "RELOAD_PANEL" }).catch(() => { });
        return true;
      } catch (error) {
        console.error("Error saving settings:", error);
        toast.error("Failed to save settings");
        return false;
      }
    };

    const next = saveQueueRef.current.then(save, save);
    saveQueueRef.current = next;
    return next;
  }, []);

  useEffect(() => {
    let active = true;
    const loadSettings = async () => {
      try {
        const data = await getAppSettings();
        if (!active) return;

        const pins = getEditablePrompts(data.settings);
        const form = { settings: data.settings, apiKeys: data.apiKeys, pinnedPrompts: pins };
        formRef.current = form;
        lastSavedRef.current = serializePayload(form);
        setSettings(data.settings);
        setApiKeys(data.apiKeys);
        setPinnedPrompts(pins);
        setLoaded(true);
      } catch (error) {
        console.error("Error loading settings:", error);
      }
    };
    void loadSettings();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (serializePayload(formRef.current) === lastSavedRef.current) return;

    clearPendingSave();
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void persist(formRef.current);
    }, SAVE_DELAY_MS);

    return clearPendingSave;
  }, [settings, apiKeys, pinnedPrompts, loaded, clearPendingSave, persist]);

  useEffect(() => {
    const flush = () => {
      clearPendingSave();
      if (loaded) void persist(formRef.current);
    };

    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [loaded, clearPendingSave, persist]);

  const resetDefaults = useCallback(() => {
    const form = createDefaultForm();
    formRef.current = form;
    setSettings(form.settings);
    setApiKeys(form.apiKeys);
    setPinnedPrompts(form.pinnedPrompts);
    clearPendingSave();

    void persist(form).then((saved) => {
      if (saved) toast.success("Settings reset to defaults");
    });
  }, [clearPendingSave, persist]);

  return {
    settings,
    setSettings,
    apiKeys,
    setApiKeys,
    pinnedPrompts,
    setPinnedPrompts,
    loaded,
    resetDefaults,
  };
};

interface SettingsSidebarProps {
  activeSection: SectionId;
  onSelect: (section: SectionId) => void;
}

const SettingsSidebar: React.FC<SettingsSidebarProps> = ({ activeSection, onSelect }) => (
  <aside className="flex shrink-0 flex-col border-b border-border bg-surface-1 md:w-70 md:border-r md:border-b-0">
    <div className="flex items-center gap-2.5 px-4 py-3 md:gap-3 md:px-5 md:pb-5 md:pt-6">
      <img src={LOGO_URL} alt="Waffy Logo" className="h-8 w-8 shrink-0 md:h-9 md:w-9" />
      <h1 className="truncate text-lg font-bold tracking-tight md:text-xl">Extension Settings</h1>
    </div>

    <nav
      className={`flex w-full gap-1 px-2 pb-2 md:flex-1 md:flex-col md:gap-1 md:overflow-y-auto md:px-3 md:pb-4 ${thinScroll}`}
    >
      {SECTIONS.map((section) => {
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
            onClick={() => onSelect(section.id)}
            aria-current={isActive ? "page" : undefined}
          >
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-sm ${isActive ? "bg-green-dim text-green" : "bg-white/4"
                }`}
            >
              <Icon size={17} />
            </span>
            <span className="text-[11px] font-medium leading-none md:text-sm">{section.label}</span>
          </button>
        );
      })}
    </nav>
  </aside>
);

const Settings = () => {
  const [activeSection, setActiveSection] = useState<SectionId>(getHashSection);
  const activeSectionMeta = SECTIONS.find((section) => section.id === activeSection) ?? SECTIONS[0];
  const {
    settings,
    setSettings,
    apiKeys,
    setApiKeys,
    pinnedPrompts,
    setPinnedPrompts,
    loaded,
    resetDefaults,
  } = useSettingsForm();

  const selectSection = (section: SectionId) => {
    setActiveSection(section);
    window.location.hash = section;
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
            onResetDefaults={resetDefaults}
            canReset={loaded}
          />
        );
      case "memory":
        return <MemorySection settings={settings} setSettings={setSettings} />;
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
      case "support":
        return <SupportSection />;
      case "about":
        return <AboutSection logoUrl={LOGO_URL} />;
    }
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-surface-0 font-sans text-text-primary md:flex-row">
      <Toaster position="top-center" reverseOrder={false} />
      <SettingsSidebar activeSection={activeSection} onSelect={selectSection} />

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
      </div>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Settings />
  </React.StrictMode>
);
