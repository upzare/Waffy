import React, { useState } from "react";
import { ExternalLink, Eye, EyeOff } from "lucide-react";
import { hasApiKey, PROVIDERS } from "../providers";
import type { ApiKeys } from "@/types";
import { monoInput } from "../styles";

interface ApiKeysSectionProps {
  apiKeys: ApiKeys;
  setApiKeys: React.Dispatch<React.SetStateAction<ApiKeys>>;
}

const ApiKeysSection: React.FC<ApiKeysSectionProps> = ({ apiKeys, setApiKeys }) => {
  const [visibleKeys, setVisibleKeys] = useState<Partial<Record<keyof ApiKeys, boolean>>>({});

  const toggleVisibility = (key: keyof ApiKeys) => {
    setVisibleKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
      {PROVIDERS.map((provider) => {
        const isConfigured = hasApiKey(apiKeys, provider.id);
        const isVisible = visibleKeys[provider.id];
        const value = apiKeys[provider.id] ?? "";

        return (
          <div
            key={provider.id}
            className="flex flex-col gap-3.5 rounded-md border border-border bg-surface-2 px-4 py-4.5 transition-colors duration-150 hover:border-border-strong sm:px-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold leading-tight text-text-primary">
                  {provider.label}
                </div>
                <div className="mt-0.5 text-xs leading-snug text-text-muted">
                  {provider.description}
                </div>
              </div>
              <span
                className={`shrink-0 rounded border px-1.5 py-0.5 text-xs font-medium ${
                  isConfigured
                    ? "border-green-border bg-green-dim text-green"
                    : "border-border bg-white/4 text-text-muted"
                }`}
              >
                {isConfigured ? "Configured" : "Not Configured"}
              </span>
            </div>

            <div className="relative flex items-center">
              <input
                className={`${monoInput} pr-10`}
                type={isVisible ? "text" : "password"}
                placeholder={provider.placeholder}
                value={value}
                onChange={(e) => setApiKeys((prev) => ({ ...prev, [provider.id]: e.target.value }))}
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                className="absolute right-2 flex h-8 w-8 items-center justify-center rounded-sm text-text-muted transition-colors duration-150 hover:bg-white/6 hover:text-text-primary"
                onClick={() => toggleVisibility(provider.id)}
                aria-label={isVisible ? "Hide API key" : "Show API key"}
              >
                {isVisible ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            <a
              href={provider.docsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-fit items-center gap-1 text-xs font-medium text-text-secondary no-underline transition-colors duration-150 hover:text-text-primary hover:underline"
            >
              Get API key <ExternalLink size={13} />
            </a>
          </div>
        );
      })}
    </div>
  );
};

export default ApiKeysSection;
