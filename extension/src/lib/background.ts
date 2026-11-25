import Browser from "webextension-polyfill";
import type { Runtime } from "webextension-polyfill";
import { EXTENSION_VERSION, X_VERSION_URL } from "@/config";
import { ACTIONS, restrictLocalStorageAccess } from "@/lib/helper";
import { WRITING } from "./writing";
import {
  getAutomationOverlayStatus,
  getTab,
  registerAutomationListeners,
  setTab,
  startSession,
  stopSession,
} from "./background/automation";
import { createContextMenus, registerContextMenuListeners } from "./background/context-menu";
import { fetchWebPage } from "./background/fetch";
import { captureVisibleTab, getPageContent, getPageInfo } from "./background/page";
import { capture } from "./background/capture";
import { fetchWebSearch } from "./background/search";
import { getToolsOverlayState, registerToolsOverlayListeners } from "./background/tools-overlay";
import { relayWriting } from "./background/writing";
import { initClient, initSettings, migrateAppSettings } from "./client";

const webRequests = new Map<string, AbortController>();

async function handleWebRequest(id: string, read: (signal: AbortSignal) => Promise<unknown>) {
  const controller = new AbortController();
  webRequests.set(id, controller);
  try {
    return await read(controller.signal);
  } finally {
    webRequests.delete(id);
  }
}

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

void restrictLocalStorageAccess().catch(() =>
  console.error("Could not restrict extension storage access.")
);
registerAutomationListeners();
registerContextMenuListeners();
registerToolsOverlayListeners();

Browser.runtime.onMessage.addListener((request: any, sender: Runtime.MessageSender) => {
  switch (request.action) {
    case ACTIONS.setTab:
      return setTab(request.tabId);
    case ACTIONS.getTab:
      return getTab();
    case ACTIONS.getAutomationOverlayStatus:
      return getAutomationOverlayStatus(sender);
    case ACTIONS.startSession:
      return startSession(request.tabId);
    case ACTIONS.stopSession:
      return stopSession();
    case ACTIONS.cancelWebRequest:
      webRequests.get(request.id)?.abort();
      return undefined;
    case ACTIONS.getPageInfo:
      return getPageInfo(request.tabId);
    case ACTIONS.getPageContent:
      return getPageContent(request.tabId);
    case ACTIONS.captureVisibleTab:
      return captureVisibleTab(request.tabId);
    case ACTIONS.getToolsOverlayState:
      return getToolsOverlayState(sender);
    case ACTIONS.capture:
      return capture(sender, request.rect, request.viewport);
    case WRITING.readSelection:
    case WRITING.releaseSelection:
    case WRITING.apply:
      return relayWriting(request, sender);
    case ACTIONS.webSearch:
      return handleWebRequest(request.id, (signal) => fetchWebSearch(request.query, signal));
    case ACTIONS.webFetch:
      return handleWebRequest(request.id, (signal) => fetchWebPage(request.url, signal));
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
    } else if (details.reason === "update") {
      await migrateAppSettings();
      if (await releaseNotesAvailable()) {
        await Browser.tabs.create({ url: Browser.runtime.getURL("release.html") });
      }
    }
  } catch (error) {
    console.error("Failed to initialize extension:", error);
  }
});
