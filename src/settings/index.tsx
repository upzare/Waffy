import React from "react"
import ReactDOM from "react-dom/client"
import { useState, useEffect } from "react"
import toast, { Toaster } from "react-hot-toast"
import Browser from "webextension-polyfill"
import type { Settings as SettingsType } from "./../types"
import GeneralSettings from "./components/GeneralSettings"
import ThemeSettings from "./components/ThemeSettings"
import PrivacySettings from "./components/PrivacySettings"
import AboutSettings from "./components/AboutSettings"
import { SettingsIcon, Info, Palette, Shield } from "lucide-react"

const sections = [
  { id: "general", label: "General", icon: <SettingsIcon size={18} /> },
  { id: "theme", label: "Theme", icon: <Palette size={18} /> },
  { id: "privacy", label: "Privacy", icon: <Shield size={18} /> },
  { id: "about", label: "About", icon: <Info size={18} /> },
]

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<SettingsType>();
  const [activeSection, setActiveSection] = useState("general");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        setIsLoading(true);
        const localStorage = await Browser.storage.local.get("data");
        if (localStorage.data) {
          setSettings(JSON.parse(localStorage.data as string));
        } else {
          handleSave();
        }
      } catch (error) {
        toast.error("Failed to load settings");
      } finally {
        setIsLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleChange = (key: keyof SettingsType, value: any) => {
    setSettings((prev: any) => ({
      ...prev,
      [key]: value,
    }));
  }

  const handleSave = async () => {
    try {
      await Browser.storage.local.set({ data: JSON.stringify(settings) });
      try {
        // @ts-ignore
        chrome.sidePanel.setOptions({
          path: "panel.html",
          enabled: false,
        });
        // @ts-ignore
        chrome.sidePanel.setOptions({
          path: "panel.html",
          enabled: true,
        });
        // @ts-ignore
        chrome.windows.getCurrent((w) => chrome.sidePanel.open({ windowId: w.id }));
      } catch (e) {
        console.log("Chrome-specific API not available");
      }

      toast.success("Settings saved successfully");
    } catch (error) {
      toast.error("Failed to save settings");
    }
  }

  const handleReset = async () => {
    const defaultSettings: SettingsType = {
      waffyAPI: "",
      theme: "system",
      enableHistory: true,
      enableKeyboardShortcuts: true,
      enableNotifications: true,
      account: {},
    };

    try {
      await Browser.storage.local.set({ data: JSON.stringify(defaultSettings) });

      try {
        // @ts-ignore
        chrome.sidePanel.setOptions({
          path: "panel.html",
          enabled: false,
        });
        // @ts-ignore
        chrome.sidePanel.setOptions({
          path: "panel.html",
          enabled: true,
        });
      } catch (e) {
        console.log("Chrome-specific API not available");
      }

      setSettings(defaultSettings);
      toast.success("Settings reset to default");
    } catch (error) {
      toast.error("Failed to reset settings");
    }
  }

  const handleCancel = () => {
    toast.success("Changes discarded");
  }

  const renderSection = () => {
    if (isLoading) {
      return (
        <div className="settings-loading">
          <div className="loading-spinner"></div>
          <p>Loading settings...</p>
        </div>
      )
    }

    switch (activeSection) {
      case "general":
        return <GeneralSettings settings={settings!} onChange={handleChange} />
      case "theme":
        return <ThemeSettings settings={settings!} onChange={handleChange} />
      case "privacy":
        return <PrivacySettings settings={settings!} onChange={handleChange} />
      case "about":
        return <AboutSettings />
      default:
        return null
    };
  }

  return (
    <div className="settings-page">
      <Toaster
        position="top-center"
        reverseOrder={false}
        toastOptions={{
          style: {
            background: "#111",
            color: "#fff",
            border: "1px solid rgba(255, 255, 255, 0.1)",
          },
        }}
      />
      <div className="settings-sidebar">
        <div className="settings-sidebar-header">
          <img src="/logo.svg" alt="Waffy Logo" className="logo" />
          <h1>Waffy</h1>
        </div>
        {sections.map((section) => (
          <button
            key={section.id}
            className={`sidebar-item ${activeSection === section.id ? "active" : ""}`}
            onClick={() => setActiveSection(section.id)}
          >
            {section.icon}
            <span>{section.label}</span>
          </button>
        ))}
      </div>
      <div className="settings-main">
        <div className="settings-header">
          <h1>Settings</h1>
        </div>

        <div className="settings-content">{renderSection()}</div>
        <div className="settings-footer">
          <button className="reset-button" onClick={handleReset}>
            Reset to Default
          </button>
          <div className="action-buttons">
            <button className="cancel-button" onClick={handleCancel}>
              Cancel
            </button>
            <button className="save-button" onClick={handleSave}>
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <Settings />
    </React.StrictMode>
);