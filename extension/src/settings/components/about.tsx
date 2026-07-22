import React from "react";
import { ExternalLink, Globe } from "lucide-react";
import Browser from "webextension-polyfill";

interface AboutSectionProps {
  logoUrl: string;
}

const LINKS = [
  { href: "https://waffy.io", label: "Official Website", icon: Globe },
  { href: "https://github.com/upzare/Waffy", label: "View on GitHub", icon: ExternalLink },
  { href: "https://waffy.io/terms", label: "Terms of Service", icon: ExternalLink },
  { href: "https://waffy.io/privacy", label: "Privacy Policy", icon: ExternalLink },
];

const AboutSection: React.FC<AboutSectionProps> = ({ logoUrl }) => {
  const version = Browser.runtime.getManifest().version;

  return (
    <>
      <div className="mb-5 px-2 pb-6 pt-6 text-center sm:px-4 sm:pt-8">
        <div className="mb-4 inline-flex h-20 w-20 items-center justify-center rounded-md border border-border bg-surface-2">
          <img src={logoUrl} alt="Waffy Logo" className="h-12 w-12" />
        </div>
        <h2 className="mb-1 text-2xl font-bold tracking-tight">Waffy</h2>
        <p className="mb-3 text-sm text-text-secondary">Your AI Copilot for Web</p>
        <span className="inline-block rounded-full border border-border bg-white/5 px-2.5 py-1 text-xs font-semibold text-text-muted">
          Version {version}
        </span>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {LINKS.map(({ href, label, icon: Icon }) => (
          <a
            key={href}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2.5 rounded-md border border-border bg-surface-2 px-4 py-3.5 text-sm font-medium text-text-secondary no-underline transition-colors duration-150 hover:border-border-strong hover:bg-white/4 hover:text-text-primary"
          >
            <Icon size={16} className="shrink-0" />
            <span className="min-w-0 truncate">{label}</span>
            <ExternalLink size={14} className="ml-auto shrink-0 opacity-40" />
          </a>
        ))}
      </div>

      <p className="text-center text-xs text-text-muted">
        © {new Date().getFullYear()} Waffy AI. All rights reserved.
      </p>
    </>
  );
};

export default AboutSection;
