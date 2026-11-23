import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { Toaster } from "react-hot-toast";
import { Brain, Cpu, Info, Key, LifeBuoy, Server, Settings as SettingsIcon, Sparkles } from "lucide-react";
import "@fontsource/space-grotesk/latin-400.css";
import "@fontsource/space-grotesk/latin-500.css";
import "@fontsource/space-grotesk/latin-600.css";
import "@fontsource/space-grotesk/latin-700.css";
import "@fontsource/jetbrains-mono/latin-500.css";
import "@/setup/setup.css";
import "@/stylesheets/globals.css";
import "./settings.css";

import GeneralSection from "./components/general";
import MemorySection from "./components/memory";
import ApiKeysSection from "./components/api-keys";
import CustomApiSection from "./components/custom-api";
import McpServersSection from "./components/mcp-servers";
import SkillsSection from "./components/skills";
import ModelsSection from "./components/models";
import SupportSection from "./components/support";
import AboutSection from "./components/about";
import { panelSubtitle, primaryButton, secondaryButton, thinScroll } from "./styles";
import { useSettingsDraft } from "./use-settings-draft";
import { LOGO_URL } from "@/config";
import { initAnalytics } from "@/lib/posthog";

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
    id: "skills",
    label: "Skills",
    description: "Import and manage reusable instructions for Waffy.",
    icon: Sparkles,
  },
  {
    id: "mcp-servers",
    label: "MCP Servers",
    description: "Connect third-party MCP servers to use their tools in Waffy.",
    icon: Server,
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

const isSectionId = (value: string): value is SectionId =>
  SECTIONS.some((section) => section.id === value);

const getHashSection = (): SectionId => {
  const hash = window.location.hash.replace("#", "");
  return isSectionId(hash) ? hash : SECTIONS[0].id;
};

interface SettingsSidebarProps {
  activeSection: SectionId;
  onSelect: (section: SectionId) => void;
}

const SettingsSidebar: React.FC<SettingsSidebarProps> = ({ activeSection, onSelect }) => (
  <aside className="relative flex shrink-0 flex-col overflow-hidden border-b border-white/10 bg-[#070807] md:w-70 md:border-r md:border-b-0">
    <div className="setup-noise pointer-events-none absolute inset-0 opacity-15" />
    <div className="relative flex items-center gap-2.5 px-4 py-3 md:gap-3 md:px-5 md:pt-6 md:pb-5">
      <img src={LOGO_URL} alt="Waffy Logo" className="h-8 w-8 shrink-0 md:h-9 md:w-9" />
      <h1 className="truncate text-lg font-bold tracking-[-0.03em] md:text-xl">
        Extension Settings
      </h1>
    </div>

    <nav
      className={`relative flex w-full gap-1 overflow-x-auto px-2 pb-2 md:flex-1 md:flex-col md:gap-1 md:overflow-x-hidden md:overflow-y-auto md:px-3 md:pb-4 ${thinScroll}`}
    >
      {SECTIONS.map((section) => {
        const Icon = section.icon;
        const isActive = activeSection === section.id;

        return (
          <button
            key={section.id}
            type="button"
            className={`flex flex-1 flex-col items-center justify-center gap-1.5 rounded-xl border px-1 py-2 text-center transition-colors duration-150 md:w-full md:flex-none md:flex-row md:justify-start md:gap-2.5 md:px-3 md:py-2.5 md:text-left ${isActive
              ? "border-[#00ff00] bg-[#00ff00]/15 text-white"
              : "border-transparent text-white/55 hover:bg-white/6 hover:text-white"
              }`}
            onClick={() => onSelect(section.id)}
            aria-current={isActive ? "page" : undefined}
          >
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${isActive ? "text-[#00ff00]" : "bg-white/6 text-white/55"
                }`}
            >
              <Icon size={17} />
            </span>
            <span className="text-[11px] font-medium leading-none tracking-[-0.01em] md:text-sm">
              {section.label}
            </span>
          </button>
        );
      })}
    </nav>
  </aside>
);

const Settings = () => {
  const [activeSection, setActiveSection] = useState<SectionId>(getHashSection);
  const activeSectionMeta = SECTIONS.find((section) => section.id === activeSection) ?? SECTIONS[0];
  const form = useSettingsDraft();
  const { draft, hasChanges, saving, setSettings, setApiKeys } = form;
  const showApplyBar = hasChanges || saving;

  useEffect(() => {
    void initAnalytics();
  }, []);

  useEffect(() => {
    if (!hasChanges) return;

    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };

    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [hasChanges]);

  const selectSection = (section: SectionId) => {
    setActiveSection(section);
    window.location.hash = section;
  };

  const renderSection = () => {
    if (activeSection === "support") return <SupportSection />;
    if (activeSection === "about") return <AboutSection />;
    if (!draft) {
      return (
        <p role="status" className={panelSubtitle}>
          {form.loadError || "Loading settings…"}
        </p>
      );
    }
    const { settings, apiKeys } = draft;
    switch (activeSection) {
      case "general":
        return (
          <GeneralSection
            settings={settings}
            setSettings={setSettings}
            onResetDefaults={form.resetDefaults}
          />
        );
      case "memory":
        return (
          <MemorySection
            settings={settings}
            setSettings={setSettings}
            memoryEnabled={form.savedMemoryEnabled}
          />
        );
      case "skills":
        return (
          <SkillsSection
            skills={form.skills}
            loadError={form.skillLoadError}
            saving={saving}
            onStage={form.stageSkill}
          />
        );
      case "mcp-servers":
        return (
          <McpServersSection servers={form.servers} saving={saving} onStage={form.stageServer} />
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
    }
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-black font-sans text-white md:flex-row">
      <Toaster position="top-center" reverseOrder={false} />
      <SettingsSidebar activeSection={activeSection} onSelect={selectSection} />

      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-black">
        <header className="flex justify-center border-b border-white/10 px-5 pt-6 pb-5 md:px-10 md:pt-8">
          <div className="flex w-full max-w-4xl flex-col">
            <h2 className="text-2xl font-bold tracking-[-0.04em] md:text-3xl">
              {activeSectionMeta.label}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-white/50 md:text-base">
              {activeSectionMeta.description}
            </p>
          </div>
        </header>

        <main
          className={`flex min-h-0 flex-1 flex-col items-center overflow-x-hidden overflow-y-auto px-5 pt-6 md:px-10 md:pt-7 ${showApplyBar ? "pb-32 sm:pb-24" : "pb-6 md:pb-8"} ${thinScroll}`}
        >
          <div className="mx-auto w-full min-w-0 max-w-4xl animate-fade-in">{renderSection()}</div>
        </main>

        {showApplyBar && (
          <aside
            aria-label="Apply changes"
            className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-5 pb-4 md:px-10 md:pb-5"
          >
            <div className="pointer-events-auto flex w-full max-w-xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/15 bg-[#151715]/95 px-4 py-3 shadow-xl shadow-black/60 backdrop-blur-xl motion-safe:animate-fade-in sm:px-5">
              <p role="status" className="text-sm font-bold">
                {saving ? "Saving changes…" : "You have unsaved changes"}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={`${secondaryButton} disabled:cursor-not-allowed disabled:opacity-50`}
                  onClick={form.cancel}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={`${primaryButton} disabled:cursor-not-allowed disabled:opacity-50`}
                  onClick={() => void form.save()}
                  disabled={saving}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Settings />
  </React.StrictMode>
);
