import Browser from "webextension-polyfill";
import type { Tabs } from "webextension-polyfill";
import { isInaccessiblePage } from "@/helper";
import { errorMessage } from "../errors";
import { htmlToMarkdown, type HtmlToMarkdownResult } from "../html-to-markdown";
import { sleep } from "../utils";

const MAX_CONTENT_CHARS = 12000;
const TAB_FOCUS_SETTLE_MS = 100;
const SCREENSHOT_QUALITY = 25;

type ResolvedTab = { ok: true; tabId: number; tab: Tabs.Tab } | { ok: false; message: string };

type ContentScriptResponse = {
  status?: string;
  value?: string;
  html?: string;
  url?: string;
  title?: string;
};

/** Resolve a tab that content scripts and CDP can actually read. */
const resolveAccessibleTab = async (tabId: unknown, verb: string): Promise<ResolvedTab> => {
  if (typeof tabId !== "number") return { ok: false, message: "tabId is required." };

  const tab = await Browser.tabs.get(tabId);
  if (tab?.id == null) return { ok: false, message: "No tab found." };

  if (isInaccessiblePage(tab.url)) {
    return {
      ok: false,
      message: `Cannot ${verb} "${tab.url}". Browser internal pages are not accessible.`,
    };
  }

  return { ok: true, tabId: tab.id, tab };
};

/** Render already-extracted Markdown as a tool message. Kept separate from extraction so
 *  callers that also need the raw Markdown do not have to convert the HTML twice. */
export const renderPageMessage = (
  { title, markdown }: HtmlToMarkdownResult,
  pageUrl: string,
  maxChars = MAX_CONTENT_CHARS
) => {
  const content =
    markdown.length > maxChars ? `${markdown.slice(0, maxChars)}\n...[truncated]` : markdown;

  if (!content.trim()) {
    return { status: "error" as const, message: "Page had no extractable content." };
  }

  return {
    status: "success" as const,
    message: `URL: ${pageUrl}\nTitle: ${title}\n\nContent:\n${content}`,
  };
};

export const getPageInfo = async (tabId: unknown) => {
  try {
    const resolved = await resolveAccessibleTab(tabId, "read");
    if (!resolved.ok) return { status: "error", message: resolved.message };

    const { tab } = resolved;
    return {
      status: "success",
      message: `URL: ${tab.url ?? ""}\nTitle: ${tab.title ?? ""}\nLoading: ${tab.status ?? ""}`,
    };
  } catch (e) {
    return { status: "error", message: errorMessage(e) };
  }
};

export const getPageContent = async (tabId: unknown) => {
  try {
    const resolved = await resolveAccessibleTab(tabId, "read");
    if (!resolved.ok) return { status: "error", message: resolved.message };

    const response = (await Browser.tabs.sendMessage(resolved.tabId, {
      type: "GET_PAGE_CONTENT",
    })) as ContentScriptResponse;

    if (!response || response.status === "error" || !response.html) {
      return { status: "error", message: response?.value ?? "Failed to read page content." };
    }

    const pageUrl = response.url ?? "";
    return renderPageMessage(htmlToMarkdown(response.html, pageUrl, response.title ?? ""), pageUrl);
  } catch (e) {
    return { status: "error", message: errorMessage(e) };
  }
};

export const captureVisibleTab = async (tabId: unknown) => {
  let previousTabId: number | undefined;

  try {
    const resolved = await resolveAccessibleTab(tabId, "capture");
    if (!resolved.ok) return { status: "error", message: resolved.message };

    const { tab } = resolved;
    if (tab.windowId == null) return { status: "error", message: "No tab found." };

    // captureVisibleTab only captures the focused tab in a window.
    if (!tab.active) {
      const [focused] = await Browser.tabs.query({ active: true, windowId: tab.windowId });
      previousTabId = focused?.id;
      await Browser.tabs.update(resolved.tabId, { active: true });
      await sleep(TAB_FOCUS_SETTLE_MS);
    }

    const dataUrl = await Browser.tabs.captureVisibleTab(tab.windowId, {
      format: "jpeg",
      quality: SCREENSHOT_QUALITY,
    });
    const captured = await Browser.tabs.get(resolved.tabId);

    return {
      status: "success",
      image: dataUrl.replace(/^data:image\/\w+;base64,/, ""),
      metadata: {
        url: captured.url ?? tab.url ?? "",
        title: captured.title ?? tab.title ?? "",
        loading_status: captured.status ?? tab.status ?? "",
      },
    };
  } catch (e) {
    return { status: "error", message: errorMessage(e) };
  } finally {
    if (previousTabId != null) {
      await Browser.tabs.update(previousTabId, { active: true }).catch(() => { });
    }
  }
};
