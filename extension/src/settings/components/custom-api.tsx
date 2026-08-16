import React, { useState } from "react";
import { Eye, EyeOff, Info } from "lucide-react";
import Browser from "webextension-polyfill";
import type { ApiKeys, Settings } from "@/types";
import { alertInfo, fieldLabel, monoInput, panel, panelSubtitle, panelTitle } from "../styles";

interface CustomApiSectionProps {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  apiKeys: ApiKeys;
  setApiKeys: React.Dispatch<React.SetStateAction<ApiKeys>>;
}

const CustomApiSection: React.FC<CustomApiSectionProps> = ({
  settings,
  setSettings,
  apiKeys,
  setApiKeys,
}) => {
  const [keyVisible, setKeyVisible] = useState(false);
  const baseUrl = settings.customApi.baseUrl;
  const model = settings.customApi.model;
  const apiKey = apiKeys.custom ?? "";
  const isConfigured = Boolean(baseUrl.trim() && model.trim());

  const updateCustomApi = (patch: Partial<Settings["customApi"]>) => {
    setSettings((prev) => ({
      ...prev,
      customApi: { ...prev.customApi, ...patch },
    }));
  };

  return (
    <div className={panel}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className={panelTitle}>OpenAI-compatible endpoint</h3>
          <p className={panelSubtitle}>
            Connect any server that implements the OpenAI Chat Completions API, including local
            runtimes like Ollama and LM Studio.
          </p>
        </div>
        <span
          className={`shrink-0 rounded border px-1.5 py-0.5 text-xs font-medium ${isConfigured
            ? "border-green-border bg-green-dim text-green"
            : "border-border bg-white/4 text-text-muted"
            }`}
        >
          {isConfigured ? "Available" : "N / A"}
        </span>
      </div>

      <div className={`${alertInfo} mb-4`}>
        <Info size={15} />
        <span>
          Local servers like Ollama block extension requests unless you allow this origin. Set{" "}
          <strong>OLLAMA_ORIGINS</strong> to{" "}
          <code className="font-mono text-text-primary">chrome-extension://*</code> or{" "}
          <code className="font-mono text-text-primary">
            chrome-extension://{Browser.runtime.id}
          </code>
          , then restart the server.
        </span>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <label htmlFor="custom-api-url" className={fieldLabel}>
            Base URL
          </label>
          <input
            id="custom-api-url"
            className={monoInput}
            type="url"
            placeholder="https://api.example.com/v1"
            value={baseUrl}
            onChange={(e) => updateCustomApi({ baseUrl: e.target.value })}
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          <label htmlFor="custom-api-model" className={fieldLabel}>
            Model
          </label>
          <input
            id="custom-api-model"
            className={monoInput}
            type="text"
            placeholder="llama3.1"
            value={model}
            onChange={(e) => updateCustomApi({ model: e.target.value })}
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          <label htmlFor="custom-api-key" className={fieldLabel}>
            API key <span className="font-normal text-text-muted">(optional)</span>
          </label>
          <div className="relative flex items-center">
            <input
              id="custom-api-key"
              className={`${monoInput} pr-10`}
              type={keyVisible ? "text" : "password"}
              placeholder="sk-..."
              value={apiKey}
              onChange={(e) => setApiKeys((prev) => ({ ...prev, custom: e.target.value }))}
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              className="absolute right-2 flex h-8 w-8 items-center justify-center rounded-sm text-text-muted transition-colors duration-150 hover:bg-white/6 hover:text-text-primary"
              onClick={() => setKeyVisible((prev) => !prev)}
              aria-label={keyVisible ? "Hide API key" : "Show API key"}
            >
              {keyVisible ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomApiSection;
