import React from "react";
import { ArrowUpRight, CircleAlert, Mail, MessageCircle } from "lucide-react";
import { DISCORD_URL, GITHUB_ISSUES_URL, SUPPORT_EMAIL } from "@/config";

const CHANNELS = [
  {
    href: GITHUB_ISSUES_URL,
    label: "GitHub Issues",
    description: "Open a public bug report or feature request",
    icon: CircleAlert,
  },
  {
    href: DISCORD_URL,
    label: "Discord",
    description: "Chat with the community and the Waffy team",
    icon: MessageCircle,
  },
  {
    href: `mailto:${SUPPORT_EMAIL}`,
    label: SUPPORT_EMAIL,
    description: "Reach us directly by email",
    icon: Mail,
  },
];

const SupportSection: React.FC = () => {
  return (
    <div className="flex flex-col gap-4">
      <p className="px-1 text-sm leading-relaxed text-white/50">
        If something isn&apos;t working, open a GitHub issue, hop into Discord or Email us.
      </p>

      <div className="overflow-hidden rounded-2xl border border-white/12 bg-white/6 backdrop-blur-[18px]">
        <div className="divide-y divide-white/10">
          {CHANNELS.map(({ href, label, description, icon: Icon }) => (
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
    </div>
  );
};

export default SupportSection;
