export const panel =
  "mb-4 rounded-2xl border border-white/12 bg-white/6 px-4 py-5 backdrop-blur-[18px] sm:px-5";

export const panelTitle = "mb-1 text-base font-bold tracking-[-0.02em]";

export const panelSubtitle = "text-sm leading-relaxed text-white/45";

export const fieldLabel = "text-sm font-medium text-white/70";

export const textInput =
  "w-full rounded-2xl border border-white/15 bg-black/50 px-4 py-3 text-sm text-white outline-none transition-[border-color,box-shadow] placeholder:text-white/30 focus:border-[#00ff00]/70 focus:shadow-[0_0_0_3px_rgba(0,255,0,0.12)]";

export const monoInput = `${textInput} font-mono placeholder:font-sans`;

export const selectInput = `${monoInput} cursor-pointer appearance-none pr-10`;

export const alertError =
  "flex items-center gap-2 rounded-2xl border border-red-border bg-red-dim px-4 py-3 text-sm text-red";

export const alertInfo =
  "flex items-start gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-relaxed text-white/60 [&_strong]:font-semibold [&_strong]:text-white [&_svg]:mt-0.5 [&_svg]:shrink-0 [&_svg]:text-[#00ff00]";

export const iconBox =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/8 text-white/55";

export const iconButton =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 text-white/45 transition-colors duration-150 hover:enabled:border-[#ff5c5c]/40 hover:enabled:bg-[#ff5c5c]/10 hover:enabled:text-[#ff5c5c] disabled:cursor-not-allowed disabled:opacity-35";

export const revealButton =
  "absolute right-2 flex h-8 w-8 items-center justify-center rounded-full text-white/45 transition-colors duration-150 hover:bg-white/10 hover:text-white";

export const primaryButton =
  "inline-flex items-center justify-center rounded-full border border-[#00ff00] bg-[#00ff00] px-5 py-2 text-sm font-bold text-black transition-colors duration-300 hover:border-white hover:bg-white";

export const secondaryButton =
  "inline-flex items-center justify-center rounded-full border border-white/15 bg-white/6 px-4 py-2 text-sm font-bold text-white backdrop-blur-[18px] transition-colors duration-300 hover:bg-white/10";

export const dangerButton =
  "inline-flex items-center justify-center rounded-full border border-red-border px-4 py-2 text-sm font-bold text-red transition-colors duration-150 hover:bg-red-dim";

export const badge =
  "shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.16em]";

export const badgeOn = `${badge} border-[#00ff00]/40 text-[#00ff00]`;

export const badgeOff = `${badge} border-white/15 text-white/40`;

export const thinScroll =
  "[scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.22)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20 hover:[&::-webkit-scrollbar-thumb]:bg-white/30";
