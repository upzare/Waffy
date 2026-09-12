import Browser from "webextension-polyfill";
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

/** Domains the fetch session needs: Network to detect idle, Runtime to read the DOM. */
const DOMAINS = ["Network", "Page", "Runtime"];
const ATTACH_RETRIES = 5;
const ATTACH_RETRY_DELAY_MS = 200;

const MIN_WAIT_MS = 300;
const CONTENT_POLL_MS = 200;
const CONTENT_STABLE_MS = 500;
const PAGE_READY_TIMEOUT_MS = 15000;
const NETWORK_IDLE_MS = 500;

/** Resource types that carry real page data. Sockets, beacons and media are ignored so
 *  streaming widgets and ad pings cannot keep a page from ever looking idle. */
const TRACKED_RESOURCE_TYPES = new Set(["Document", "XHR", "Fetch", "Script"]);

const SNAPSHOT_EXPRESSION =
  "({ url: location.href, title: document.title, html: document.documentElement.outerHTML })";
const PROBE_EXPRESSION =
  '({ readyState: document.readyState, chars: (document.body && document.body.innerText || "").length })';

type PageSnapshot = { url: string; title: string; html: string };
type PageProbe = { readyState: string; chars: number };
type OpenedTab = { tabId: number };

/** Tabs this module owns, so automation leaves them alone and cancellation can close them. */
const ownedTabIds = new Set<number>();

export const isOwnedTab = (tabId: number) => ownedTabIds.has(tabId);

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

  throw lastError instanceof Error ? lastError : new Error("Failed to attach to the tab.");
};

const detachDebugger = async (tabId: number) => {
  if (!(await isAttached(tabId))) return;
  try {
    await sendCommand(tabId, "Emulation.setFocusEmulationEnabled", { enabled: false });
  } catch (_) { }
  await disableDomains(tabId, DOMAINS);
  await detachTab(tabId);
};

const isDomReady = (readyState: string) =>
  readyState === "interactive" || readyState === "complete";

const probePage = async (tabId: number): Promise<PageProbe | null> => {
  try {
    const response = (await sendCommand(tabId, "Runtime.evaluate", {
      expression: PROBE_EXPRESSION,
      returnByValue: true,
    })) as { result?: { value?: Partial<PageProbe> } };

    const value = response?.result?.value;
    if (value?.readyState == null) return null;

    return { readyState: value.readyState, chars: value.chars ?? 0 };
  } catch {
    return null;
  }
};

/**
 * Snapshot at the first of: DOM ready + stable text, DOM ready + short network idle,
 * or a hard timeout. Never waits for tab "complete", and always resolves so we can
 * capture whatever is on the page.
 */
const waitForPageReady = (tabId: number): Promise<void> =>
  new Promise((resolve) => {
    const inflight = new Set<string>();
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;
    let lastChars: number | undefined;
    let stableSince: number | null = null;
    let networkIdle = false;
    let settled = false;
    const startedAt = Date.now();

    const finish = () => {
      if (settled) return;
      settled = true;
      chrome.debugger.onEvent.removeListener(onEvent);
      Browser.tabs.onRemoved.removeListener(onRemoved);
      clearTimeout(timeout);
      if (idleTimer) clearTimeout(idleTimer);
      if (pollTimer) clearTimeout(pollTimer);
      resolve();
    };

    const maybeFinish = (domReady: boolean) => {
      if (settled || Date.now() - startedAt < MIN_WAIT_MS || !domReady) return;

      const contentStable =
        stableSince != null && Date.now() - stableSince >= CONTENT_STABLE_MS;
      if (contentStable || networkIdle) finish();
    };

    const bumpIdle = () => {
      if (idleTimer) clearTimeout(idleTimer);
      networkIdle = false;
      if (inflight.size > 0) return;
      idleTimer = setTimeout(() => {
        networkIdle = true;
        void probeAndMaybeFinish();
      }, NETWORK_IDLE_MS);
    };

    const probeAndMaybeFinish = async () => {
      if (settled) return;
      const probe = await probePage(tabId);
      if (settled) return;

      if (probe) {
        if (lastChars === probe.chars) {
          if (stableSince == null) stableSince = Date.now();
        } else {
          lastChars = probe.chars;
          stableSince = Date.now();
        }
        maybeFinish(isDomReady(probe.readyState));
        return;
      }

      maybeFinish(false);
    };

    const schedulePoll = () => {
      pollTimer = setTimeout(() => {
        void probeAndMaybeFinish().then(() => {
          if (!settled) schedulePoll();
        });
      }, CONTENT_POLL_MS);
    };

    const onEvent = (source: chrome.debugger.Debuggee, method: string, params?: object) => {
      if (source.tabId !== tabId) return;
      const data = (params ?? {}) as { requestId?: string; type?: string };

      if (method === "Network.requestWillBeSent") {
        if (data.requestId && data.type && TRACKED_RESOURCE_TYPES.has(data.type)) {
          inflight.add(data.requestId);
          if (idleTimer) clearTimeout(idleTimer);
          networkIdle = false;
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

    const timeout = setTimeout(finish, PAGE_READY_TIMEOUT_MS);
    chrome.debugger.onEvent.addListener(onEvent);
    Browser.tabs.onRemoved.addListener(onRemoved);
    bumpIdle();
    void probeAndMaybeFinish().then(() => {
      if (!settled) schedulePoll();
    });
  });

/** Read the live DOM through CDP, which works without a content script on the page. */
export const snapshotPage = async (tabId: number): Promise<PageSnapshot | null> => {
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

export const closeOwnedTabs = async () => {
  const tabIds = [...ownedTabIds];
  ownedTabIds.clear();

  await Promise.all(
    tabIds.map(async (tabId) => {
      await detachDebugger(tabId).catch(() => { });
      await Browser.tabs.remove(tabId).catch(() => { });
    })
  );
};

export const openTab = async (url: string): Promise<OpenedTab | null> => {
  try {
    // Open blank and attach first
    const tab = await Browser.tabs.create({ url: "about:blank", active: false });
    if (tab.id == null) return null;
    ownedTabIds.add(tab.id);

    await attachDebugger(tab.id);
    await sendCommand(tab.id, "Page.setLifecycleEventsEnabled", { enabled: true }).catch(() => { });
    // Navigate, then reload for reliability
    await sendCommand(tab.id, "Page.navigate", { url });
    await waitForPageReady(tab.id);
    await sendCommand(tab.id, "Page.reload", { ignoreCache: false })
    await waitForPageReady(tab.id);

    return { tabId: tab.id };
  } catch {
    return null;
  }
};

const captureTab = async (tabId: number): Promise<string | null> => {
  try {
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

export const fetchWebPage = async (url: string) => {
  const trimmed = url.trim();
  if (!trimmed) return { status: "error", message: "URL is required." };
  if (!isHttpUrl(trimmed)) return { status: "error", message: "A valid http(s) URL is required." };

  try {
    const tab = await openTab(trimmed);
    if (!tab) return { status: "error", message: "Failed to open the page." };

    const page = await captureTab(tab.tabId);
    if (!page) return { status: "error", message: "Failed to read the page." };

    return { status: "success" as const, message: page };
  } catch (e) {
    return { status: "error", message: errorMessage(e) };
  } finally {
    await closeOwnedTabs();
  }
};
