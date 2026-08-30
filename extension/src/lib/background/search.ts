import Browser from "webextension-polyfill";
import type { Tabs } from "webextension-polyfill";
import { isHttpUrl, isInaccessiblePage } from "@/helper";
import {
  attachTab,
  detachTab,
  disableDomains,
  enableDomains,
  isAttached,
  sendCommand,
} from "../cdp";
import { errorMessage } from "../errors";
import { htmlToMarkdown } from "../html-to-markdown";
import { sleep } from "../utils";
import { renderPageMessage } from "./page";

/** Domains the search session needs: Network to detect idle, Runtime to read the DOM. */
const DOMAINS = ["Network", "Page", "Runtime"];
const ATTACH_RETRIES = 5;
const ATTACH_RETRY_DELAY_MS = 200;

const RESULT_LIMIT = 3;
const TAB_LOAD_TIMEOUT_MS = 15000;
const NETWORK_IDLE_MS = 500;
const NETWORK_IDLE_TIMEOUT_MS = 10000;

/** Resource types that carry real page data. Sockets, beacons and media are ignored so
 *  streaming widgets and ad pings cannot keep a page from ever looking idle. */
const TRACKED_RESOURCE_TYPES = new Set(["Document", "XHR", "Fetch", "Script"]);

const SNAPSHOT_EXPRESSION =
  "({ url: location.href, title: document.title, html: document.documentElement.outerHTML })";

type PageSnapshot = { url: string; title: string; html: string };
type SearchTab = { tabId: number; idle: Promise<void> };

/** Tabs this module owns, so automation leaves them alone and cancellation can close them. */
const searchTabIds = new Set<number>();

export const isSearchTab = (tabId: number) => searchTabIds.has(tabId);

const attachDebugger = async (tabId: number) => {
  let lastError: unknown;

  for (let attempt = 0; attempt < ATTACH_RETRIES; attempt++) {
    try {
      await attachTab(tabId);
      await enableDomains(tabId, DOMAINS);

      // Chrome throttles background tabs, so their JS may never hydrate. Presenting the tab
      // as active and focused lets it run without stealing focus from the user.
      await Promise.allSettled([
        sendCommand(tabId, "Page.setWebLifecycleState", { state: "active" }),
        sendCommand(tabId, "Emulation.setFocusEmulationEnabled", { enabled: true }),
      ]);
      return;
    } catch (e) {
      lastError = e;
      if (attempt < ATTACH_RETRIES - 1) await sleep(ATTACH_RETRY_DELAY_MS);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Failed to attach to the search tab.");
};

const detachDebugger = async (tabId: number) => {
  if (!(await isAttached(tabId))) return;
  try {
    await sendCommand(tabId, "Emulation.setFocusEmulationEnabled", { enabled: false });
  } catch (_) { }
  await disableDomains(tabId, DOMAINS);
  await detachTab(tabId);
};

/**
 * Resolve once tracked network traffic has been quiet for `idleMs`. The debugger attaches
 * only after the document has loaded, so this covers the JS/SPA fetches that follow.
 * Resolves early if the tab closes, and always resolves by `timeoutMs`.
 */
const waitForNetworkIdle = (
  tabId: number,
  idleMs = NETWORK_IDLE_MS,
  timeoutMs = NETWORK_IDLE_TIMEOUT_MS
): Promise<void> =>
  new Promise((resolve) => {
    const inflight = new Set<string>();
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      chrome.debugger.onEvent.removeListener(onEvent);
      Browser.tabs.onRemoved.removeListener(onRemoved);
      clearTimeout(timeout);
      if (idleTimer) clearTimeout(idleTimer);
      resolve();
    };

    const bumpIdle = () => {
      if (idleTimer) clearTimeout(idleTimer);
      if (inflight.size > 0) return;
      idleTimer = setTimeout(finish, idleMs);
    };

    const onEvent = (source: chrome.debugger.Debuggee, method: string, params?: object) => {
      if (source.tabId !== tabId) return;
      const data = (params ?? {}) as { requestId?: string; type?: string };

      if (method === "Network.requestWillBeSent") {
        if (data.requestId && data.type && TRACKED_RESOURCE_TYPES.has(data.type)) {
          inflight.add(data.requestId);
          if (idleTimer) clearTimeout(idleTimer);
        }
        return;
      }

      if (method === "Network.loadingFinished" || method === "Network.loadingFailed") {
        if (data.requestId) inflight.delete(data.requestId);
        bumpIdle();
      }
    };

    const onRemoved = (removedTabId: number) => {
      if (removedTabId === tabId) finish();
    };

    const timeout = setTimeout(finish, timeoutMs);
    chrome.debugger.onEvent.addListener(onEvent);
    Browser.tabs.onRemoved.addListener(onRemoved);
    bumpIdle();
  });

/** Read the live DOM through CDP, which works without a content script on the page. */
const snapshotPage = async (tabId: number): Promise<PageSnapshot | null> => {
  try {
    const response = (await sendCommand(tabId, "Runtime.evaluate", {
      expression: SNAPSHOT_EXPRESSION,
      returnByValue: true,
    })) as { result?: { value?: Partial<PageSnapshot> } };

    const value = response?.result?.value;
    if (!value?.html) return null;

    return { url: value.url ?? "", title: value.title ?? "", html: value.html };
  } catch {
    return null;
  }
};

/** DuckDuckGo Lite wraps every result in a redirect carrying the real destination. */
const extractResultUrls = (html: string, limit = RESULT_LIMIT): string[] => {
  const urls = new Set<string>();

  for (const match of html.matchAll(/\/\/duckduckgo\.com\/l\/\?uddg=([^&"'<\s]+)/g)) {
    let destination: string;
    try {
      destination = decodeURIComponent(match[1]);
    } catch {
      continue;
    }

    if (!isHttpUrl(destination)) continue;
    urls.add(destination);
    if (urls.size >= limit) break;
  }

  return [...urls];
};

/** A new tab reports "complete" on about:blank before navigation starts. Wait until
 *  the real http(s) document has loaded, otherwise attach/snapshot hit an empty page. */
const waitForTabComplete = (tabId: number, timeoutMs = TAB_LOAD_TIMEOUT_MS): Promise<void> =>
  new Promise((resolve, reject) => {
    let settled = false;

    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      Browser.tabs.onUpdated.removeListener(onUpdated);
      Browser.tabs.onRemoved.removeListener(onRemoved);
      fn();
    };

    const timer = setTimeout(() => {
      settle(() => reject(new Error("Timed out waiting for page to load.")));
    }, timeoutMs);

    const onUpdated = (id: number, info: Tabs.OnUpdatedChangeInfoType, tab: Tabs.Tab) => {
      if (id === tabId && info.status === "complete" && isHttpUrl(tab.url)) {
        settle(() => resolve());
      }
    };

    const onRemoved = (id: number) => {
      if (id === tabId) settle(() => reject(new Error("Tab was closed.")));
    };

    Browser.tabs.onUpdated.addListener(onUpdated);
    Browser.tabs.onRemoved.addListener(onRemoved);

    Browser.tabs.get(tabId).then(
      (tab) => {
        if (tab.status === "complete" && isHttpUrl(tab.url)) settle(() => resolve());
      },
      () => settle(() => reject(new Error("Tab was closed.")))
    );
  });

export const closeSearchTabs = async () => {
  const tabIds = [...searchTabIds];
  searchTabIds.clear();

  await Promise.all(
    tabIds.map(async (tabId) => {
      await detachDebugger(tabId).catch(() => { });
      await Browser.tabs.remove(tabId).catch(() => { });
    })
  );
};

const openSearchTab = async (url: string): Promise<SearchTab | null> => {
  try {
    const tab = await Browser.tabs.create({ url, active: false });
    if (tab.id == null) return null;
    searchTabIds.add(tab.id);

    // Attach only once a real document exists; a new tab starts out with no URL.
    await waitForTabComplete(tab.id);
    await attachDebugger(tab.id);

    return { tabId: tab.id, idle: waitForNetworkIdle(tab.id) };
  } catch {
    return null;
  }
};

const captureSearchTab = async (tabId: number, idle: Promise<void>): Promise<string | null> => {
  try {
    await idle;

    const tab = await Browser.tabs.get(tabId);
    if (isInaccessiblePage(tab.url)) return null;

    const snapshot = await snapshotPage(tabId);
    if (!snapshot) return null;

    const pageUrl = snapshot.url || tab.url || "";
    const rendered = renderPageMessage(
      htmlToMarkdown(snapshot.html, pageUrl, snapshot.title),
      pageUrl
    );
    return rendered.status === "success" ? rendered.message : null;
  } catch {
    return null;
  }
};

export const fetchWebSearch = async (query: string) => {
  const trimmed = query.trim();
  if (!trimmed) return { status: "error", message: "Search query is required." };

  try {
    const response = await fetch(
      `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(trimmed)}`
    );
    if (!response.ok) {
      return { status: "error", message: `DuckDuckGo search failed (${response.status}).` };
    }

    const urls = extractResultUrls(await response.text());
    if (urls.length === 0) return { status: "error", message: "No search results found." };

    const tabs = await Promise.all(urls.map((url) => openSearchTab(url)));
    const captured = await Promise.all(
      tabs.map((tab) => (tab ? captureSearchTab(tab.tabId, tab.idle) : null))
    );
    const sources = captured.filter((page): page is string => page != null);

    if (sources.length === 0) {
      return { status: "error", message: "Failed to read search result pages." };
    }

    const body = sources.map((source, i) => `## Source ${i + 1}\n${source}`).join("\n\n");
    return { status: "success" as const, message: `Query: ${trimmed}\n\n${body}` };
  } catch (e) {
    return { status: "error", message: errorMessage(e) };
  } finally {
    await closeSearchTabs();
  }
};
