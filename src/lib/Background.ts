import Browser from "webextension-polyfill";
import { initClient, initSettings } from "./client";

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'GET_TAB_ID') {
    sendResponse({ tabId: sender?.tab?.id });
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

export { };