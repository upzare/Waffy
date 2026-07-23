import React from "react";
import { ArrowUpRight, Code2, Globe, Scale, Shield } from "lucide-react";
import Browser from "webextension-polyfill";

interface AboutSectionProps {
  logoUrl: string;
}

const LINKS = [
  {
    href: "https://waffy.io",
    label: "Website",
    description: "Product overview and updates",
    icon: Globe,
  },
  {
    href: "https://github.com/upzare/Waffy",
    label: "GitHub",
    description: "Source code and contributions",
    icon: Code2,
  },
  {
    href: "https://waffy.io/terms",
    label: "Terms of Service",
    description: "Usage terms and conditions",
    icon: Scale,
  },
  {
    href: "https://waffy.io/privacy",
    label: "Privacy Policy",
    description: "How your data is handled",
    icon: Shield,
  },
];

const AboutSection: React.FC<AboutSectionProps> = ({ logoUrl }) => {
  const manifest = Browser.runtime.getManifest();
  const version = manifest.version;
  const year = new Date().getFullYear();

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-md border border-border bg-surface-2">
        <div className="flex flex-col items-center px-5 py-8 text-center sm:px-8 sm:py-10">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-black/25">
            <img src={logoUrl} alt="Waffy" className="h-9 w-9" />
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">Waffy</h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-text-secondary">
            {manifest.description}
          </p>

          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-border bg-black/35 px-3 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-green" />
            <span className="font-mono text-xs font-medium tracking-wide text-text-muted">
              v{version}
            </span>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border border-border bg-surface-2">
        <div className="divide-y divide-border">
          {LINKS.map(({ href, label, description, icon: Icon }) => (
            <a
              key={href}
              href={href}
              target="_blank"
              rel="noreferrer"
              className="group flex items-center gap-3.5 px-4 py-3.5 no-underline transition-colors duration-150 hover:bg-white/3 sm:px-5"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-border bg-black/25 text-text-secondary transition-colors duration-150 group-hover:border-green-border group-hover:bg-green-dim group-hover:text-green">
                <Icon size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-text-primary">{label}</span>
                <span className="mt-0.5 block truncate text-xs text-text-muted">{description}</span>
              </span>
              <ArrowUpRight
                size={16}
                className="shrink-0 text-text-muted opacity-50 transition-all duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-green group-hover:opacity-100"
              />
            </a>
          ))}
        </div>
      </div>

      <p className="px-1 text-center text-xs text-text-muted uppercase">
        © {year} UPZARE / Waffy. All rights reserved.
      </p>
    </div>
  );
};

export default AboutSection;
