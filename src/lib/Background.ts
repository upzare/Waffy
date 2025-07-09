import { initClient, initSettings } from "./client";

const overlayInfo: Record<number, boolean> = {};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case "GET_TAB_ID": {
      sendResponse({ tabId: sender?.tab?.id });
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