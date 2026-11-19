import Browser from "webextension-polyfill";
import type { Runtime } from "webextension-polyfill";
import { EXTENSION_VERSION, X_VERSION_URL } from "@/config";
import { ACTIONS } from "@/lib/helper";
import {
  disableAutomationOverlay,
  enableAutomationOverlay,
  getAutomationOverlayStatus,
  getTab,
  registerAutomationListeners,
  setOpenedTabs,
  setTab,
  startSession,
  stopSession,
} from "./background/automation";
import { createContextMenus, registerContextMenuListeners } from "./background/context-menu";
import { closeOwnedTabs, fetchWebPage } from "./background/fetch";
import { captureVisibleTab, getPageContent, getPageInfo } from "./background/page";
import {
  capture,
  getCaptureState,
  registerCaptureListeners,
} from "./background/capture";
import { fetchWebSearch } from "./background/search";
import { initClient, initSettings } from "./client";

const stopGeneration = async () => {
  await Promise.all([closeOwnedTabs(), stopSession()]);
  return { status: "success" };
};

const releaseNotesAvailable = async () => {
  try {
    const url = new URL(X_VERSION_URL);
    url.searchParams.set("version", EXTENSION_VERSION);
    const response = await fetch(url);
    return response.status === 200;
  } catch {
    return false;
  }
};

registerAutomationListeners();
registerContextMenuListeners();
registerCaptureListeners();

Browser.runtime.onMessage.addListener((request: any, sender: Runtime.MessageSender) => {
  switch (request.action) {
    case ACTIONS.setTab:
      return setTab(request.tabId);
    case ACTIONS.getTab:
      return getTab();
    case ACTIONS.setOpenedTabs:
      return setOpenedTabs(request.tabs);
    case ACTIONS.enableAutomationOverlay:
      return enableAutomationOverlay(request.tabId);
    case ACTIONS.disableAutomationOverlay:
      return disableAutomationOverlay(request.tabId);
    case ACTIONS.getAutomationOverlayStatus:
      return getAutomationOverlayStatus(sender);
    case ACTIONS.startSession:
      return startSession(request.tabId);
    case ACTIONS.stopSession:
      return stopSession();
    case ACTIONS.stopGeneration:
      return stopGeneration();
    case ACTIONS.getPageInfo:
      return getPageInfo(request.tabId);
    case ACTIONS.getPageContent:
      return getPageContent(request.tabId);
    case ACTIONS.captureVisibleTab:
      return captureVisibleTab(request.tabId);
    case ACTIONS.getCaptureButton:
      return getCaptureState(sender);
    case ACTIONS.capture:
      return capture(sender, request.rect, request.viewport);
    case ACTIONS.webSearch:
      return fetchWebSearch(request.query);
    case ACTIONS.webFetch:
      return fetchWebPage(request.url);
    default:
      return undefined;
  }
});

// chrome-only
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

Browser.runtime.onInstalled.addListener(async (details) => {
  createContextMenus();
  try {
    await Promise.all([initClient(), initSettings()]);
    if (details.reason === "install") {
      await Browser.tabs.create({ url: Browser.runtime.getURL("setup.html") });
    } else if (details.reason === "update" && (await releaseNotesAvailable())) {
      await Browser.tabs.create({ url: Browser.runtime.getURL("release.html") });
    }
  } catch (error) {
    console.error("Failed to initialize extension:", error);
  }
});
