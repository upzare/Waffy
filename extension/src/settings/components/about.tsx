import React from "react";
import { ArrowUpRight, Code2, Globe, Scale, Shield } from "lucide-react";
import Browser from "webextension-polyfill";
import { GITHUB_URL, LOGO_URL, PRIVACY_URL, TERMS_URL, WEBSITE_URL } from "@/config";

const LINKS = [
  {
    href: WEBSITE_URL,
    label: "Website",
    description: "Product overview and updates",
    icon: Globe,
  },
  {
    href: GITHUB_URL,
    label: "GitHub",
    description: "Source code and contributions",
    icon: Code2,
  },
  {
    href: TERMS_URL,
    label: "Terms of Service",
    description: "Usage terms and conditions",
    icon: Scale,
  },
  {
    href: PRIVACY_URL,
    label: "Privacy Policy",
    description: "How your data is handled",
    icon: Shield,
  },
];

const AboutSection: React.FC = () => {
  const manifest = Browser.runtime.getManifest();
  const version = manifest.version;
  const year = new Date().getFullYear();

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-2xl border border-white/12 bg-white/6 backdrop-blur-[18px]">
        <div className="flex flex-col items-center px-5 py-8 text-center sm:px-8 sm:py-10">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/12 bg-black/40">
            <img src={LOGO_URL} alt="Waffy" className="h-9 w-9" />
          </div>

          <h2 className="text-2xl font-bold tracking-[-0.04em] sm:text-3xl">Waffy Extension</h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-white/50">
            {manifest.description}
          </p>

          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#00ff00]/40 px-3 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#00ff00]" />
            <span className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-[#00ff00]">
              v{version}
            </span>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/12 bg-white/6 backdrop-blur-[18px]">
        <div className="divide-y divide-white/10">
          {LINKS.map(({ href, label, description, icon: Icon }) => (
            <a
              key={href}
              href={href}
              target="_blank"
              rel="noreferrer"
              className="group flex items-center gap-3.5 px-4 py-3.5 no-underline transition-colors duration-150 hover:bg-white/6 sm:px-5"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/40 text-white/55 transition-colors duration-150 group-hover:border-[#00ff00]/40 group-hover:text-[#00ff00]">
                <Icon size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold tracking-[-0.02em]">{label}</span>
                <span className="mt-0.5 block truncate text-sm text-white/45">{description}</span>
              </span>
              <ArrowUpRight
                size={16}
                className="shrink-0 text-white/35 transition-all duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[#00ff00]"
              />
            </a>
          ))}
        </div>
      </div>

      <p className="px-1 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
        © {year} UPZARE / Waffy. All rights reserved.
      </p>
    </div>
  );
};

export default AboutSection;
