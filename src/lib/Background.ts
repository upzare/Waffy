import { initClient, initSettings } from "./client";

const overlayInfo: Record<number, boolean> = {};

let openedTabs: Record<any, any>[] = [];

let activeTabId: number | null = null;

let active = false;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case "SET_TAB": {
      const tab = openedTabs.find(tab => tab.id === request.tabId);
      if (tab) {
        activeTabId = tab.id;
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
      chrome.tabs.sendMessage(request.tabId, { type: "INTERACT_DOM", name: "SHOW_OVERLAY" });
      overlayInfo[request.tabId] = true;
      sendResponse({ status: "success", value: "Waffy overlay enabled" });
      break;
    }
    case "DISABLE_OVERLAY": {
      chrome.tabs.sendMessage(request.tabId, { type: "INTERACT_DOM", name: "HIDE_OVERLAY" });
      overlayInfo[request.tabId] = false;
      sendResponse({ status: "success", value: "Waffy overlay disabled" });
      break;
    }
    case "GET_OVERLAY_STATUS": {
      if (sender?.tab?.id) sendResponse({ status: overlayInfo[sender.tab.id] ? "enabled" : "disabled" });
      else sendResponse({ status: "disabled" });
      break;
    }
    default:
      break;
  }
  return true;
});

chrome.webNavigation.onCommitted.addListener((e) => {
  try {
    if (!active || e.url?.startsWith("chrome://") || e.frameType !== "outermost_frame") return;
    chrome.debugger.getTargets(async (targets) => {
      const isAttached = targets.some(
        (target) => target.tabId === e.tabId && target.attached
      );
      if (isAttached) return;
      chrome.debugger.attach({ tabId: e.tabId }, "1.3", async () => {
        if (chrome.runtime.lastError) {
          throw new Error("Debugger attach failed");
        }
        await chrome.debugger.sendCommand({ tabId: e.tabId }, "Page.enable");
        await chrome.debugger.sendCommand({ tabId: e.tabId }, "DOM.enable");
        await chrome.debugger.sendCommand({ tabId: e.tabId }, "Overlay.enable");
        console.log(`Debugger attached to tab ${e.tabId}`);
      });
    });
  } catch (e) {
    console.error("Error attaching controller:", e);
  }
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