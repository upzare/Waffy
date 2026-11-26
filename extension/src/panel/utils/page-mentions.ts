import type { Tabs } from "webextension-polyfill";
import Browser from "webextension-polyfill";
import { ACTIONS, isInaccessiblePage } from "@/lib/helper";
import type { PageSource, SkillMention } from "@/types";
import { findSlashCommand } from "./slash-commands";
import { SKILL_MARKUP_PATTERN, skillMentionSpan } from "./skill-mentions";
import { decodeLiteralText, encodeLiteralCharacter } from "./literal-text";

export const SLASH_MARKUP = "/[__display__](__id__)";
export const PAGE_MARKUP = "@[__display__](tab:__id__)";
export const MUTED_PAGE_MARKUP = "@[__display__](muted:__id__)";

export const MENTION_CHIP_CLASS =
  "rounded-sm bg-[rgba(0,200,83,0.18)] [box-decoration-break:clone] [-webkit-box-decoration-break:clone]";
export const MENTION_CHIP_COMPOSER_CLASS = `${MENTION_CHIP_CLASS} text-transparent`;
export const MENTION_CHIP_MUTED_CLASS =
  "rounded-sm bg-white/12 [box-decoration-break:clone] [-webkit-box-decoration-break:clone] text-transparent";
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
    .filter(
      (tab): tab is Tabs.Tab & { id: number } => tab.id != null && !isInaccessiblePage(tab.url)
    )
    .sort(
      (a, b) =>
        Number(Boolean(b.active)) - Number(Boolean(a.active)) || (a.index ?? 0) - (b.index ?? 0)
    );

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

export async function fetchPageContent(
  tabId: number
): Promise<{ ok: true; content: string } | { ok: false; message: string }> {
  try {
    const response = (await Browser.runtime.sendMessage({
      action: ACTIONS.getPageContent,
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

export function selectedCommandOffset(markup: string): number | undefined {
  const selected = markup.matchAll(SLASH_MARKUP_PATTERN).next().value;
  return selected && markupToDisplay(markup.slice(0, selected.index)).length;
}

export function selectedSkillMentions(markup: string): SkillMention[] {
  return Array.from(markup.matchAll(SKILL_MARKUP_PATTERN), (match) => ({
    name: match[1],
    id: match[2],
    revision: match[3],
    offset: markupToDisplay(markup.slice(0, match.index)).length,
  }));
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

export function readComposerText(markup: string) {
  const display = markup
    .replace(SLASH_MARKUP_PATTERN, "/$1")
    .replace(PAGE_MARKUP_PATTERN, "@$1")
    .replace(MUTED_MARKUP_PATTERN, "@$1")
    .replace(SKILL_MARKUP_PATTERN, (_, name) => `$${name}`);
  return decodeLiteralText(display);
}

export const markupToDisplay = (markup: string) => readComposerText(markup).text;

type MarkupSpan = { start: number; end: number; markup: string };

function formatPromptMentions<T extends { mention: string }>(
  display: string,
  pages: T[],
  {
    commandOffset,
    skill,
    formatCommand,
    formatPage,
    formatSkill,
    literalOffsets = [],
    formatLiteral,
  }: {
    commandOffset?: number;
    skill?: SkillMention;
    formatCommand: (text: string) => string;
    formatPage: (page: T) => string;
    formatSkill: (skill: SkillMention) => string;
    literalOffsets?: readonly number[];
    formatLiteral?: (character: string) => string;
  }
): string {
  const command = findSlashCommand(display, commandOffset);
  const spans: MarkupSpan[] = command
    ? [{ ...command, markup: formatCommand(display.slice(command.start, command.end)) }]
    : [];
  const skillSpan = skillMentionSpan(display, skill);
  if (skill && skillSpan) spans.push({ ...skillSpan, markup: formatSkill(skill) });
  const byLength = [...pages].sort((a, b) => b.mention.length - a.mention.length);
  const literal = new Set(literalOffsets);

  for (const page of byLength) {
    let from = 0;
    while (from < display.length) {
      const start = display.indexOf(page.mention, from);
      if (start === -1) break;
      const end = start + page.mention.length;
      from = start + 1;
      if (literal.has(start) || spans.some((span) => start < span.end && end > span.start)) continue;
      spans.push({ start, end, markup: formatPage(page) });
    }
  }

  if (formatLiteral) {
    for (const start of literal) {
      if (display[start] && !spans.some((span) => start >= span.start && start < span.end)) {
        spans.push({ start, end: start + 1, markup: formatLiteral(display[start]) });
      }
    }
  }
  spans.sort((a, b) => a.start - b.start);
  let result = "";
  let cursor = 0;
  for (const span of spans) {
    result += display.slice(cursor, span.start) + span.markup;
    cursor = span.end;
  }
  return result + display.slice(cursor);
}

export function displayToMarkup(
  display: string,
  pages: ComposerPageMention[],
  commandOffset?: number,
  skill?: SkillMention,
  literalOffsets?: readonly number[]
): string {
  return formatPromptMentions(display, pages, {
    commandOffset,
    skill,
    literalOffsets,
    formatLiteral: encodeLiteralCharacter,
    formatCommand: (text) => {
      const name = text.slice(1);
      return `/[${name}](${name.toLowerCase()})`;
    },
    formatPage: (page) => {
      const label = page.label || page.mention.slice(1);
      return page.muted || page.tabId == null
        ? `@[${label}](muted:${encodeURIComponent(label)})`
        : `@[${label}](tab:${page.tabId})`;
    },
    formatSkill: ({ id, name, revision }) => `$[${name}](skill:${id}:${revision})`,
  });
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

export function buildPageTaggedPrompt(
  prompt: string,
  pages: PageSource[],
  commandOffset?: number,
  skill?: SkillMention
): string {
  const controls = [findSlashCommand(prompt, commandOffset), skillMentionSpan(prompt, skill)]
    .filter((span) => span !== undefined)
    .sort((a, b) => b.start - a.start);

  let userMessage = prompt;
  for (const { start, end } of controls) {
    const before = userMessage.slice(0, start);
    const after = userMessage.slice(end);
    userMessage = before.trim() ? before + after.replace(/^ /, "") : after.replace(/^(?:\r?\n| )/, "");
  }
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
        `<page mention="${escapeXml(page.mention)}" title="${escapeXml(page.title)}" url="${escapeXml(page.url)}">\n${escapeXml(page.content)}\n</page>`
    )
    .join("\n");

  return `<user_message>
${escapeXml(userMessage)}
</user_message>
<page_sources>
${sources}
</page_sources>`;
}

/** Wrap composer chips as Streamdown mention tags so the rest of the prompt renders as Markdown. */
export function wrapPromptMentions(
  prompt: string,
  pages: PageSource[],
  commandOffset?: number,
  skill?: SkillMention,
  literalOffsets?: readonly number[]
): string {
  const wrap = (text: string) => `<mention>${escapeXml(text)}</mention>`;
  return formatPromptMentions(prompt, pages, {
    commandOffset,
    skill,
    literalOffsets,
    formatCommand: wrap,
    formatPage: (page) => wrap(page.mention),
    formatSkill: ({ name }) => wrap(`$${name}`),
  });
}
