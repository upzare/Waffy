import Browser from "webextension-polyfill";
import type { Runtime, Tabs } from "webextension-polyfill";
import { initClient, initSettings } from "./client";
import { getActiveTab, isInaccessiblePage } from "@/helper";
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
  console.log("Tab updates:", tab);
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
          const tab = await getActiveTab();
          if (!tab) {
            return { status: "error", message: "No active tab found." };
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
        try {
          const tab = await getActiveTab();
          if (!tab?.id || tab.windowId == null) {
            return { status: "error", message: "No active tab found." };
          }
          if (isInaccessiblePage(tab.url)) {
            return {
              status: "error",
              message: `Cannot capture "${tab.url}". Browser internal pages are not accessible.`,
            };
          }
          const dataUrl = await Browser.tabs.captureVisibleTab(tab.windowId, {
            format: "jpeg",
            quality: 50,
          });
          const base64Image = dataUrl.replace(/^data:image\/\w+;base64,/, "");
          return {
            status: "success",
            image: base64Image,
            metadata: {
              url: tab.url ?? "",
              title: tab.title ?? "",
              loading_status: tab.status ?? "",
            },
          };
        } catch (e) {
          return { status: "error", message: String(e) };
        }
      })();
    }
    case "GET_PAGE_CONTENT": {
      return (async () => {
        try {
          const tab = await getActiveTab();
          if (!tab?.id) {
            return { status: "error", message: "No active tab found." };
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
          if (!response || response.status === "error") {
            return {
              status: "error",
              message: response?.value ?? "Failed to read page content.",
            };
          }
          const pageUrl = response.url ?? "";
          const { title, markdown } = htmlToMarkdown(
            String(response.html ?? ""),
            pageUrl,
            response.title ?? ""
          );
          const maxChars = 16000;
          const content = markdown.length > maxChars ? markdown.slice(0, maxChars) + "\n...[truncated]" : markdown;
          return {
            status: "success",
            message: `URL: ${pageUrl}\nTitle: ${title}\n\nContent:\n${content}`,
          };
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
