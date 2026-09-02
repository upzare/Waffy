import Browser from "webextension-polyfill";
import type { Runtime } from "webextension-polyfill";
import {
  disableOverlay,
  enableOverlay,
  getOverlayStatus,
  getTab,
  registerAutomationListeners,
  setOpenedTabs,
  setTab,
  startSession,
  stopSession,
} from "./background/automation";
import { captureVisibleTab, getPageContent, getPageInfo } from "./background/page";
import { closeSearchTabs, fetchWebPage, fetchWebSearch } from "./background/search";
import { initClient, initSettings } from "./client";

const stopGeneration = async () => {
  await Promise.all([closeSearchTabs(), stopSession()]);
  return { status: "success" };
};

registerAutomationListeners();

Browser.runtime.onMessage.addListener((request: any, sender: Runtime.MessageSender) => {
  switch (request.action) {
    case "SET_TAB":
      return setTab(request.tabId);
    case "GET_TAB":
      return getTab();
    case "SET_OPENED_TABS":
      return setOpenedTabs(request.tabs);
    case "ENABLE_OVERLAY":
      return enableOverlay(request.tabId);
    case "DISABLE_OVERLAY":
      return disableOverlay(request.tabId);
    case "GET_OVERLAY_STATUS":
      return getOverlayStatus(sender);
    case "START_SESSION":
      return startSession(request.tabId);
    case "STOP_SESSION":
      return stopSession();
    case "STOP_GENERATION":
      return stopGeneration();
    case "GET_PAGE_INFO":
      return getPageInfo(request.tabId);
    case "GET_PAGE_CONTENT":
      return getPageContent(request.tabId);
    case "CAPTURE_VISIBLE_TAB":
      return captureVisibleTab(request.tabId);
    case "WEB_SEARCH":
      return fetchWebSearch(request.query);
    case "WEB_FETCH":
      return fetchWebPage(request.url);
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
    Browser.windows.getCurrent().then((w) => {
      if (w.id) chrome.sidePanel.open({ windowId: w.id });
    });
  }
});
