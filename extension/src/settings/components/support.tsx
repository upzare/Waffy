import React from "react";
import { ArrowUpRight, CircleAlert, Mail, MessageCircle } from "lucide-react";

const CHANNELS = [
  {
    href: "https://github.com/upzare/Waffy/issues/new",
    label: "GitHub Issues",
    description: "Open a public bug report or feature request",
    icon: CircleAlert,
  },
  {
    href: "https://dsc.gg/waffy",
    label: "Discord",
    description: "Chat with the community and the Waffy team",
    icon: MessageCircle,
  },
  {
    href: "mailto:support@waffy.io",
    label: "support@waffy.io",
    description: "Reach us directly by email",
    icon: Mail,
  },
];

const SupportSection: React.FC = () => {
  return (
    <div className="flex flex-col gap-4">
      <p className="px-1 text-sm leading-relaxed text-text-secondary">
        If something isn&apos;t working, open a GitHub issue, hop into Discord or Email us.
      </p>

      <div className="overflow-hidden rounded-md border border-border bg-surface-2">
        <div className="divide-y divide-border">
          {CHANNELS.map(({ href, label, description, icon: Icon }) => (
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
    </div>
  );
};

export default SupportSection;
