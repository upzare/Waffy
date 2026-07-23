import Browser from "webextension-polyfill";
import type { Runtime, Tabs } from "webextension-polyfill";
import { initClient, initSettings } from "./client";
import { isInaccessiblePage } from "@/helper";
import { htmlToMarkdown } from "./html-to-markdown";

const overlayInfo: Record<number, boolean> = {};

let openedTabs: Tabs.Tab[] = [];

let activeTabId: number | null = null;

let active = false;

const syncOpenedTabs = async (): Promise<void> => {
  openedTabs = await Browser.tabs.query({});
};

const disableOverlay = (tabId: number) => {
  void Browser.tabs
    .sendMessage(tabId, { type: "INTERACT_DOM", name: "HIDE_OVERLAY" })
    .catch(() => { });
  overlayInfo[tabId] = false;
};

const enableOverlay = (tabId: number) => {
  void Browser.tabs
    .sendMessage(tabId, { type: "INTERACT_DOM", name: "SHOW_OVERLAY" })
    .catch(() => { });
  overlayInfo[tabId] = true;
};

const disableNonActiveOverlays = (activeId: number) => {
  for (const tabId of Object.keys(overlayInfo)) {
    const id = Number(tabId);
    if (id !== activeId && overlayInfo[id]) {
      disableOverlay(id);
    }
  }
};

const setActiveTab = async (tabId: number) => {
  await syncOpenedTabs();
  const tab = openedTabs.find((t) => t.id === tabId);
  if (!tab) return;
  disableNonActiveOverlays(tabId);
  activeTabId = tabId;
  enableOverlay(tabId);
};

// chrome-only
const attachDebugger = (tabId: number): Promise<void> => {
  return new Promise((resolve, reject) => {
    chrome.debugger.getTargets((targets) => {
      const isAttached = targets.some((target) => target.tabId === tabId && target.attached);
      if (isAttached) {
        resolve();
        return;
      }
      chrome.debugger.attach({ tabId }, "1.3", async () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        try {
          await chrome.debugger.sendCommand({ tabId }, "Page.enable");
          await chrome.debugger.sendCommand({ tabId }, "DOM.enable");
          await chrome.debugger.sendCommand({ tabId }, "Overlay.enable");
          resolve();
        } catch (e) {
          reject(e);
        }
      });
    });
  });
};

const detachDebugger = async (tabId: number): Promise<void> => {
  disableOverlay(tabId);
  try {
    await chrome.debugger.sendCommand({ tabId }, "Page.disable");
    await chrome.debugger.sendCommand({ tabId }, "DOM.disable");
    await chrome.debugger.sendCommand({ tabId }, "Overlay.disable");
  } catch (_) { }
  return new Promise((resolve) => {
    chrome.debugger.detach({ tabId }, () => resolve());
  });
};

Browser.tabs.onCreated.addListener(async (tab) => {
  if (!active || !tab.id) return;
  if (tab.openerTabId != null && tab.openerTabId === activeTabId) {
    await setActiveTab(tab.id);
    await Browser.tabs.update(tab.id, { active: true });
  } else {
    await syncOpenedTabs();
  }
});

Browser.tabs.onUpdated.addListener((tabId, _changeInfo, tab) => {
  if (!active || isInaccessiblePage(tab.url)) return;
  attachDebugger(tabId).catch((e) => console.error("Error attaching debugger:", e));
});

const startSession = async (tabId: number) => {
  active = true;
  await syncOpenedTabs();
  for (const tab of openedTabs) {
    if (isInaccessiblePage(tab.url) || !tab.id) continue;
    await attachDebugger(tab.id);
  }
  if (tabId) await setActiveTab(tabId);
};

const stopSession = async () => {
  active = false;
  activeTabId = null;
  const tabs = await Browser.tabs.query({});
  for (const tab of tabs) {
    if (isInaccessiblePage(tab.url) || !tab.id) continue;
    await detachDebugger(tab.id);
  }
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const formatPageMarkdown = (
  html: string,
  pageUrl: string,
  fallbackTitle: string,
  header?: string,
  maxChars = 8000,
) => {
  const { title, markdown } = htmlToMarkdown(html, pageUrl, fallbackTitle);
  const content =
    markdown.length > maxChars
      ? markdown.slice(0, maxChars) + "\n...[truncated]"
      : markdown;
  if (!content.trim()) {
    return { status: "error" as const, message: "Page had no extractable content." };
  }
  const prefix = header ? `${header}\n` : "";
  return {
    status: "success" as const,
    message: `${prefix}URL: ${pageUrl}\nTitle: ${title}\n\nContent:\n${content}`,
  };
};

const waitForTabComplete = (tabId: number, timeoutMs = 15000): Promise<void> =>
  new Promise((resolve, reject) => {
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      Browser.tabs.onUpdated.removeListener(listener);
      fn();
    };

    const timer = setTimeout(() => {
      finish(() => reject(new Error("Timed out waiting for Google AI Mode page to load.")));
    }, timeoutMs);

    const listener = (updatedTabId: number, changeInfo: Tabs.OnUpdatedChangeInfoType) => {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        finish(() => resolve());
      }
    };

    Browser.tabs.onUpdated.addListener(listener);

    void Browser.tabs.get(tabId).then((tab) => {
      if (tab.status === "complete") {
        finish(() => resolve());
      }
    });
  });

const waitAiModeFromTab = async (tabId: number) => {
  let lastError: unknown;
  for (let i = 0; i < 8; i++) {
    try {
      return (await Browser.tabs.sendMessage(tabId, {
        type: "WAIT_AI_MODE_CONTENT",
      })) as {
        status?: string;
        value?: string;
        html?: string;
        url?: string;
        title?: string;
      };
    } catch (e) {
      lastError = e;
      await sleep(250);
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Content script not ready on Google AI Mode tab.");
};

const fetchGoogleAiMode = async (query: string) => {
  const trimmed = query.trim();
  if (!trimmed) {
    return { status: "error", message: "Search query is required." };
  }

  let searchWindowId: number | undefined;

  try {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(trimmed)}&udm=50&hl=en`;
    const searchWindow = await Browser.windows.create({
      url: searchUrl,
      type: "popup",
      width: 1,
      height: 1,
      focused: false
    });
    const searchTabId = searchWindow.tabs?.[0]?.id;
    if (searchWindow.id == null || searchTabId == null) {
      return { status: "error", message: "Failed to open Google AI Mode window." };
    }
    searchWindowId = searchWindow.id;

    const start = performance.now();

    await waitForTabComplete(searchTabId);
    const response = await waitAiModeFromTab(searchTabId);
    if (!response || response.status === "error" || !response.html) {
      return {
        status: "error",
        message: response?.value ?? "Failed to read Google AI Mode response.",
      };
    }

    const end = performance.now();
    console.log("Search Time:", end - start);

    return formatPageMarkdown(
      response.html,
      response.url ?? searchUrl,
      response.title ?? "",
      `Query: ${trimmed}`
    );
  } catch (e) {
    return { status: "error", message: String(e) };
  } finally {
    if (searchWindowId != null) {
      try {
        await Browser.windows.remove(searchWindowId);
      } catch (_) { }
    }
  }
};

Browser.runtime.onMessage.addListener((request: any, sender: Runtime.MessageSender) => {
  switch (request.action) {
    case "SET_TAB": {
      const tab = openedTabs.find((tab) => tab.id === request.tabId);
      if (tab?.id != null) {
        disableNonActiveOverlays(tab.id);
        activeTabId = tab.id;
        enableOverlay(tab.id);
        return Promise.resolve({ status: "success", value: "Tab set successfully" });
      }
      return Promise.resolve({ status: "error", value: "Tab not found" });
    }
    case "GET_TAB": {
      const tab = openedTabs.find((tab) => tab.id === activeTabId);
      return Promise.resolve(tab);
    }
    case "SET_OPENED_TABS": {
      openedTabs = request.tabs;
      return Promise.resolve({ status: "success", value: "Tabs updated successfully" });
    }
    case "SET_ACTIVE": {
      active = request.active;
      return Promise.resolve({ status: "success", value: "State updated successfully" });
    }
    case "ENABLE_OVERLAY": {
      disableNonActiveOverlays(request.tabId);
      activeTabId = request.tabId;
      enableOverlay(request.tabId);
      return Promise.resolve({ status: "success", value: "Waffy overlay enabled" });
    }
    case "DISABLE_OVERLAY": {
      disableOverlay(request.tabId);
      return Promise.resolve({ status: "success", value: "Waffy overlay disabled" });
    }
    case "GET_OVERLAY_STATUS": {
      if (sender?.tab?.id)
        return Promise.resolve({ status: overlayInfo[sender.tab.id] ? "enabled" : "disabled" });
      return Promise.resolve({ status: "disabled" });
    }
    case "START_SESSION": {
      return startSession(request.tabId)
        .then(() => ({ status: "success" }))
        .catch((e) => ({ status: "error", value: String(e) }));
    }
    case "STOP_SESSION": {
      return stopSession()
        .then(() => ({ status: "success" }))
        .catch((e) => ({ status: "error", value: String(e) }));
    }
    case "GET_PAGE_INFO": {
      return (async () => {
        try {
          if (typeof request.tabId !== "number") {
            return { status: "error", message: "tabId is required." };
          }
          const tab = await Browser.tabs.get(request.tabId);
          if (!tab?.id) {
            return { status: "error", message: "No tab found." };
          }
          if (isInaccessiblePage(tab.url)) {
            return {
              status: "error",
              message: `Cannot read "${tab.url}". Browser internal pages are not accessible.`,
            };
          }
          return {
            status: "success",
            message: `URL: ${tab.url ?? ""}\nTitle: ${tab.title ?? ""}\nLoading: ${tab.status ?? ""}`,
          };
        } catch (e) {
          return { status: "error", message: String(e) };
        }
      })();
    }
    case "CAPTURE_VISIBLE_TAB": {
      return (async () => {
        let previousTabId: number | undefined;
        try {
          if (typeof request.tabId !== "number") {
            return { status: "error", message: "tabId is required." };
          }
          const tab = await Browser.tabs.get(request.tabId);
          if (!tab?.id || tab.windowId == null) {
            return { status: "error", message: "No tab found." };
          }
          if (isInaccessiblePage(tab.url)) {
            return {
              status: "error",
              message: `Cannot capture "${tab.url}". Browser internal pages are not accessible.`,
            };
          }

          // captureVisibleTab only captures the focused tab in a window.
          if (!tab.active) {
            const [focused] = await Browser.tabs.query({
              active: true,
              windowId: tab.windowId,
            });
            previousTabId = focused?.id;
            await Browser.tabs.update(tab.id, { active: true });
            await sleep(100);
          }

          const dataUrl = await Browser.tabs.captureVisibleTab(tab.windowId, {
            format: "jpeg",
            quality: 50,
          });
          const base64Image = dataUrl.replace(/^data:image\/\w+;base64,/, "");
          const captured = await Browser.tabs.get(tab.id);
          return {
            status: "success",
            image: base64Image,
            metadata: {
              url: captured.url ?? tab.url ?? "",
              title: captured.title ?? tab.title ?? "",
              loading_status: captured.status ?? tab.status ?? "",
            },
          };
        } catch (e) {
          return { status: "error", message: String(e) };
        } finally {
          if (previousTabId != null) {
            try {
              await Browser.tabs.update(previousTabId, { active: true });
            } catch (_) { }
          }
        }
      })();
    }
    case "FETCH_GOOGLE_AI_MODE": {
      return fetchGoogleAiMode(request.query);
    }
    case "GET_PAGE_CONTENT": {
      return (async () => {
        try {
          if (typeof request.tabId !== "number") {
            return { status: "error", message: "tabId is required." };
          }
          const tab = await Browser.tabs.get(request.tabId);
          if (!tab?.id) {
            return { status: "error", message: "No tab found." };
          }
          if (isInaccessiblePage(tab.url)) {
            return {
              status: "error",
              message: `Cannot read "${tab.url}". Browser internal pages are not accessible.`,
            };
          }
          const response = (await Browser.tabs.sendMessage(tab.id, {
            type: "GET_PAGE_CONTENT",
          })) as {
            status?: string;
            value?: string;
            html?: string;
            url?: string;
            title?: string;
          };
          if (!response || response.status === "error" || !response.html) {
            return {
              status: "error",
              message: response?.value ?? "Failed to read page content.",
            };
          }
          return formatPageMarkdown(response.html, response.url ?? "", response.title ?? "");
        } catch (e) {
          return { status: "error", message: String(e) };
        }
      })();
    }
    default:
      return undefined;
  }
});

// chrome-only
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

Browser.runtime.onInstalled.addListener(async () => {
  try {
    await Promise.all([initClient(), initSettings()]);
  } catch (error) {
    console.error("Failed to initialize extension:", error);
  }
});

Browser.commands.onCommand.addListener((command) => {
  if (command === "open_side_panel") {
    void Browser.windows.getCurrent().then((w) => {
      if (w.id) chrome.sidePanel.open({ windowId: w.id });
    });
  }
});
