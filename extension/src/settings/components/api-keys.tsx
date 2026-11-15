import React, { useState } from "react";
import { ExternalLink, Eye, EyeOff } from "lucide-react";
import { hasApiKey, PROVIDERS } from "../providers";
import type { ApiKeys } from "@/types";
import { badgeOff, badgeOn, monoInput, revealButton } from "../styles";

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
            className="flex flex-col gap-3.5 rounded-2xl border border-white/12 bg-white/6 px-4 py-4 backdrop-blur-[18px] transition-colors duration-150 hover:border-white/25 sm:px-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-bold leading-tight tracking-[-0.02em]">
                  {provider.label}
                </div>
                <div className="mt-1 text-sm leading-snug text-white/45">
                  {provider.description}
                </div>
              </div>
              <span className={isConfigured ? badgeOn : badgeOff}>
                {isConfigured ? "Available" : "N / A"}
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
                className={revealButton}
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
              className="inline-flex w-fit items-center gap-1 font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-[#00ff00] no-underline transition-colors duration-150 hover:text-white"
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
