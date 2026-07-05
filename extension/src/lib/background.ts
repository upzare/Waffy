import { initClient, initSettings } from "./client";
import { isInaccessiblePage } from "@/helper";

const overlayInfo: Record<number, boolean> = {};

let openedTabs: Record<any, any>[] = [];

let activeTabId: number | null = null;

let active = false;

const syncOpenedTabs = (): Promise<void> => {
  return new Promise((resolve) => {
    chrome.tabs.query({}, (tabs) => {
      openedTabs = tabs;
      resolve();
    });
  });
};

const disableOverlay = (tabId: number) => {
  chrome.tabs.sendMessage(tabId, { type: "INTERACT_DOM", name: "HIDE_OVERLAY" }).catch(() => { });
  overlayInfo[tabId] = false;
};

const enableOverlay = (tabId: number) => {
  chrome.tabs.sendMessage(tabId, { type: "INTERACT_DOM", name: "SHOW_OVERLAY" }).catch(() => { });
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

const attachDebugger = (tabId: number): Promise<void> => {
  return new Promise((resolve, reject) => {
    chrome.debugger.getTargets((targets) => {
      const isAttached = targets.some(
        (target) => target.tabId === tabId && target.attached
      );
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

chrome.tabs.onCreated.addListener(async (tab) => {
  if (!active || !tab.id) return;
  if (tab.openerTabId != null && tab.openerTabId === activeTabId) {
    await setActiveTab(tab.id);
    chrome.tabs.update(tab.id, { active: true });
  } else {
    await syncOpenedTabs();
  }
});

chrome.tabs.onUpdated.addListener((tabId, _changeInfo, tab) => {
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
  const tabs = await new Promise<chrome.tabs.Tab[]>((resolve) => chrome.tabs.query({}, resolve));
  for (const tab of tabs) {
    if (isInaccessiblePage(tab.url) || !tab.id) continue;
    await detachDebugger(tab.id);
  }
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case "SET_TAB": {
      const tab = openedTabs.find(tab => tab.id === request.tabId);
      if (tab) {
        disableNonActiveOverlays(tab.id);
        activeTabId = tab.id;
        enableOverlay(tab.id);
        sendResponse({ status: "success", value: "Tab set successfully" });
      } else {
        sendResponse({ status: "error", value: "Tab not found" });
      }
      break;
    }
    case "GET_TAB": {
      const tab = openedTabs.find(tab => tab.id === activeTabId);
      sendResponse(tab);
      break;
    }
    case "SET_OPENED_TABS": {
      openedTabs = request.tabs;
      sendResponse({ status: "success", value: "Tabs updated successfully" });
      break;
    }
    case "SET_ACTIVE": {
      active = request.active;
      sendResponse({ status: "success", value: "State updated successfully" });
      break;
    }
    case "ENABLE_OVERLAY": {
      disableNonActiveOverlays(request.tabId);
      activeTabId = request.tabId;
      enableOverlay(request.tabId);
      sendResponse({ status: "success", value: "Waffy overlay enabled" });
      break;
    }
    case "DISABLE_OVERLAY": {
      disableOverlay(request.tabId);
      sendResponse({ status: "success", value: "Waffy overlay disabled" });
      break;
    }
    case "GET_OVERLAY_STATUS": {
      if (sender?.tab?.id) sendResponse({ status: overlayInfo[sender.tab.id] ? "enabled" : "disabled" });
      else sendResponse({ status: "disabled" });
      break;
    }
    case "START_SESSION": {
      startSession(request.tabId)
        .then(() => sendResponse({ status: "success" }))
        .catch((e) => sendResponse({ status: "error", value: String(e) }));
      break;
    }
    case "STOP_SESSION": {
      stopSession()
        .then(() => sendResponse({ status: "success" }))
        .catch((e) => sendResponse({ status: "error", value: String(e) }));
      break;
    }
    default:
      break;
  }
  return true;
});

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

chrome.runtime.onInstalled.addListener((event) => {
  initClient();
  if (event.reason === "install") {
    initSettings();
  }
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "open_side_panel") {
    chrome.windows.getCurrent(w => {
      if (w.id) chrome.sidePanel.open({ windowId: w.id });
    });
  }
});
