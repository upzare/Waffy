/** Shared Tailwind class strings for the settings UI. */

export const panel = "mb-4 rounded-md border border-border bg-surface-2 px-4 py-5 sm:px-5";

export const panelTitle = "mb-1 text-base font-semibold tracking-tight";

export const panelSubtitle = "text-sm text-text-muted";

export const fieldLabel = "text-sm font-medium text-text-secondary";

export const monoInput =
  "w-full rounded-sm border border-border-strong bg-black/40 px-3 py-2.5 font-mono text-sm text-text-primary transition-[border-color] duration-150 placeholder:font-sans placeholder:text-text-muted focus:border-green-border focus:shadow-[0_0_0_2px_var(--color-green-dim)] focus:outline-none";

export const selectInput = `${monoInput} cursor-pointer appearance-none pr-9`;

export const alertError =
  "flex items-center gap-2 rounded-sm border border-red-border bg-red-dim px-3.5 py-3 text-xs text-red";

export const alertInfo =
  "flex items-start gap-2 rounded-sm border border-[rgba(59,130,246,0.25)] bg-[rgba(59,130,246,0.08)] px-3.5 py-3 text-xs leading-snug text-text-secondary [&_strong]:font-semibold [&_strong]:text-text-primary [&_svg]:mt-0.5 [&_svg]:shrink-0 [&_svg]:text-[#60a5fa]";

export const iconBox =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-white/5 text-text-secondary";

export const iconButton =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-border text-text-muted transition-[color,border-color,background] duration-150 hover:enabled:border-[rgba(248,113,113,0.35)] hover:enabled:bg-[rgba(248,113,113,0.08)] hover:enabled:text-[#f87171] disabled:cursor-not-allowed disabled:opacity-35";

export const primaryButton =
  "rounded-sm border border-green-border bg-green-dim px-5 py-2 text-sm font-semibold text-green transition-[background,border-color] duration-150 hover:border-[rgba(0,255,128,0.45)] hover:bg-[rgba(0,255,128,0.2)]";

export const secondaryButton =
  "rounded-sm border border-border-strong px-4 py-2 text-sm font-medium text-text-secondary transition-[background,color] duration-150 hover:bg-white/[0.04] hover:text-text-primary";

export const dangerButton =
  "rounded-sm border border-red-border px-4 py-2 text-sm font-medium text-red transition-colors duration-150 hover:bg-red-dim";

export const thinScroll =
  "[scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.22)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-sm [&::-webkit-scrollbar-thumb]:bg-white/20 hover:[&::-webkit-scrollbar-thumb]:bg-white/30";
