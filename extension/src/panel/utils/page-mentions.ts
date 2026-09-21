import type { Tabs } from "webextension-polyfill";
import Browser from "webextension-polyfill";
import { isInaccessiblePage } from "@/helper";
import type { PageSource } from "@/types";
import { SLASH_COMMAND_VALUES, stripSlashCommands, type SlashCommand } from "./slash-commands";

export const SLASH_MARKUP = "/[__display__](__id__)";
export const PAGE_MARKUP = "@[__display__](tab:__id__)";
export const MUTED_PAGE_MARKUP = "@[__display__](muted:__id__)";

export const MENTION_CHIP_CLASS = "rounded-sm bg-[rgba(0,200,83,0.18)] [box-decoration-break:clone] [-webkit-box-decoration-break:clone]";
export const MENTION_CHIP_COMPOSER_CLASS = `${MENTION_CHIP_CLASS} text-transparent`;
export const MENTION_CHIP_MUTED_CLASS = "rounded-sm bg-white/12 [box-decoration-break:clone] [-webkit-box-decoration-break:clone] text-transparent";
export const MENTION_CHIP_BUBBLE_CLASS = `${MENTION_CHIP_CLASS} text-white`;

const SLASH_MARKUP_PATTERN = /\/\[([^\]]+)\]\((search|research|automate)\)/gi;
const PAGE_MARKUP_PATTERN = /@\[([^\]]+)\]\(tab:(\d+)\)/g;
const MUTED_MARKUP_PATTERN = /@\[([^\]]+)\]\(muted:([^)]+)\)/g;

export type WindowPage = {
  tabId: number;
  title: string;
  url: string;
  favIconUrl?: string;
  active: boolean;
  hostname: string;
  label: string;
};

export type ComposerPageMention = {
  label: string;
  mention: string;
  tabId?: number;
  url?: string;
  muted: boolean;
  index: number;
};

export function sanitizeMentionLabel(label: string): string {
  return label.replace(/[[\]]/g, "").replace(/\s+/g, " ").trim() || "Untitled";
}

function tabHostname(url?: string): string {
  if (!url) return "";
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

export function toWindowPages(tabs: Tabs.Tab[]): WindowPage[] {
  const readable = tabs
    .filter((tab): tab is Tabs.Tab & { id: number } => tab.id != null && !isInaccessiblePage(tab.url))
    .sort((a, b) => Number(Boolean(b.active)) - Number(Boolean(a.active)) || (a.index ?? 0) - (b.index ?? 0));

  const titleCounts = new Map<string, number>();
  for (const tab of readable) {
    const title = sanitizeMentionLabel(tab.title ?? "");
    titleCounts.set(title, (titleCounts.get(title) ?? 0) + 1);
  }

  const used = new Map<string, number>();
  return readable.map((tab) => {
    const title = sanitizeMentionLabel(tab.title ?? "");
    const hostname = tabHostname(tab.url);
    let label = titleCounts.get(title)! > 1 && hostname ? `${title} (${hostname})` : title;
    const seen = used.get(label) ?? 0;
    used.set(label, seen + 1);
    if (seen > 0) label = `${label} · ${tab.id}`;
    return {
      tabId: tab.id,
      title,
      url: tab.url ?? "",
      favIconUrl: tab.favIconUrl,
      active: Boolean(tab.active),
      hostname,
      label,
    };
  });
}

export function isMutedMentionId(id: string): boolean {
  return id.startsWith("muted:");
}

export async function fetchPageContent(
  tabId: number
): Promise<{ ok: true; content: string } | { ok: false; message: string }> {
  try {
    const response = (await Browser.runtime.sendMessage({
      action: "GET_PAGE_CONTENT",
      tabId,
    })) as { status?: string; message?: string };
    if (!response || response.status === "error" || !response.message) {
      return { ok: false, message: response?.message ?? "Failed to read page content." };
    }
    return { ok: true, content: response.message };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

export function parseSlashCommandsFromMarkup(markup: string): SlashCommand[] {
  const commands: SlashCommand[] = [];
  const pattern = new RegExp(SLASH_MARKUP_PATTERN.source, "gi");
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(markup))) {
    commands.push(match[1].toLowerCase() as SlashCommand);
  }
  return commands;
}

export function parsePageMentionsFromMarkup(markup: string): ComposerPageMention[] {
  const mentions: ComposerPageMention[] = [];
  const live = new RegExp(PAGE_MARKUP_PATTERN.source, "g");
  let match: RegExpExecArray | null;
  while ((match = live.exec(markup))) {
    const label = match[1];
    mentions.push({
      label,
      mention: `@${label}`,
      tabId: Number(match[2]),
      muted: false,
      index: match.index,
    });
  }
  const muted = new RegExp(MUTED_MARKUP_PATTERN.source, "g");
  while ((match = muted.exec(markup))) {
    const label = match[1];
    mentions.push({
      label,
      mention: `@${label}`,
      muted: true,
      index: match.index,
    });
  }
  return mentions.sort((a, b) => a.index - b.index);
}

export function markupToDisplay(markup: string): string {
  return markup
    .replace(SLASH_MARKUP_PATTERN, "/$1")
    .replace(PAGE_MARKUP_PATTERN, "@$1")
    .replace(MUTED_MARKUP_PATTERN, "@$1");
}

type MarkupSpan = { start: number; end: number; markup: string };

function collectSlashSpans(display: string): MarkupSpan[] {
  const spans: MarkupSpan[] = [];
  for (const command of SLASH_COMMAND_VALUES) {
    const pattern = new RegExp(`/${command}\\b`, "gi");
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(display))) {
      const value = match[0].slice(1).toLowerCase();
      spans.push({
        start: match.index,
        end: match.index + match[0].length,
        markup: `/[${value}](${value})`,
      });
    }
  }
  return spans;
}

function overlaps(start: number, end: number, spans: MarkupSpan[]): boolean {
  return spans.some((span) => start < span.end && end > span.start);
}

export function displayToMarkup(display: string, pages: ComposerPageMention[]): string {
  const spans = collectSlashSpans(display);
  const byLength = [...pages].sort((a, b) => b.mention.length - a.mention.length);

  for (const page of byLength) {
    let from = 0;
    while (from < display.length) {
      const start = display.indexOf(page.mention, from);
      if (start === -1) break;
      const end = start + page.mention.length;
      from = start + 1;
      if (overlaps(start, end, spans)) continue;
      const label = page.label || page.mention.slice(1);
      const markup =
        page.muted || page.tabId == null
          ? `@[${label}](muted:${encodeURIComponent(label)})`
          : `@[${label}](tab:${page.tabId})`;
      spans.push({ start, end, markup });
    }
  }

  spans.sort((a, b) => a.start - b.start);
  const kept: MarkupSpan[] = [];
  for (const span of spans) {
    if (!overlaps(span.start, span.end, kept)) kept.push(span);
  }

  let result = "";
  let cursor = 0;
  for (const span of kept) {
    result += display.slice(cursor, span.start) + span.markup;
    cursor = span.end;
  }
  return result + display.slice(cursor);
}

export function rebindStoredPages(pages: PageSource[], open: WindowPage[]): ComposerPageMention[] {
  return pages.map((page, index) => {
    const mention = page.mention.startsWith("@") ? page.mention : `@${page.mention}`;
    const label = mention.slice(1);
    const live =
      open.find((item) => item.tabId === page.tabId) ??
      (page.url ? open.find((item) => item.url === page.url) : undefined);
    if (!live) {
      return { label, mention, url: page.url, muted: true, index };
    }
    return { label, mention, tabId: live.tabId, url: live.url, muted: false, index };
  });
}

export function parsePageSources(value?: string): PageSource[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is PageSource => {
      if (!item || typeof item !== "object") return false;
      const page = item as PageSource;
      return (
        typeof page.mention === "string" &&
        typeof page.title === "string" &&
        typeof page.url === "string" &&
        typeof page.tabId === "number" &&
        typeof page.content === "string"
      );
    });
  } catch {
    return [];
  }
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildPageTaggedPrompt(prompt: string, pages: PageSource[]): string {
  const userMessage = stripSlashCommands(prompt) || prompt.trim();
  if (pages.length === 0) return userMessage;

  const seen = new Set<number>();
  const uniquePages: PageSource[] = [];
  for (const page of pages) {
    if (seen.has(page.tabId)) continue;
    seen.add(page.tabId);
    uniquePages.push(page);
  }

  const sources = uniquePages
    .map(
      (page) =>
        `<page mention="${escapeXml(page.mention)}" title="${escapeXml(page.title)}" url="${escapeXml(page.url)}">\n${page.content}\n</page>`
    )
    .join("\n");

  return `<user_message>
${userMessage}
</user_message>
<page_sources>
${sources}
</page_sources>`;
}

export type PromptToken = { type: "text" | "mention"; value: string };

export function tokenizeTaggedPrompt(prompt: string, pages: PageSource[]): PromptToken[] {
  const spans: { start: number; end: number }[] = [];

  for (const command of SLASH_COMMAND_VALUES) {
    const pattern = new RegExp(`/${command}\\b`, "gi");
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(prompt))) {
      spans.push({ start: match.index, end: match.index + match[0].length });
    }
  }

  const mentions = [...new Set(pages.map((page) => page.mention))].sort((a, b) => b.length - a.length);
  for (const mention of mentions) {
    let from = 0;
    while (from < prompt.length) {
      const start = prompt.indexOf(mention, from);
      if (start === -1) break;
      const end = start + mention.length;
      from = start + 1;
      if (!spans.some((span) => start < span.end && end > span.start)) {
        spans.push({ start, end });
      }
    }
  }

  spans.sort((a, b) => a.start - b.start);
  const kept: { start: number; end: number }[] = [];
  for (const span of spans) {
    if (!kept.some((existing) => span.start < existing.end && span.end > existing.start)) {
      kept.push(span);
    }
  }

  const tokens: PromptToken[] = [];
  let cursor = 0;
  for (const span of kept) {
    if (span.start > cursor) {
      tokens.push({ type: "text", value: prompt.slice(cursor, span.start) });
    }
    tokens.push({ type: "mention", value: prompt.slice(span.start, span.end) });
    cursor = span.end;
  }
  if (cursor < prompt.length) {
    tokens.push({ type: "text", value: prompt.slice(cursor) });
  }
  return tokens.length > 0 ? tokens : [{ type: "text", value: prompt }];
}

/** Wrap / and @ chips as Streamdown mention tags so the rest of the prompt still renders as Markdown. */
export function wrapPromptMentions(prompt: string, pages: PageSource[]): string {
  return tokenizeTaggedPrompt(prompt, pages)
    .map((token) =>
      token.type === "mention" ? `<mention>${escapeXml(token.value)}</mention>` : token.value
    )
    .join("");
}
