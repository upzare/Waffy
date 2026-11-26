import Browser, { type Runtime } from "webextension-polyfill";
import { ACTIONS } from "@/lib/helper";
import type { ToolsOverlayState } from "@/types";

const panelOpenKey = (windowId: number) => `toolsOverlayOpenWindow:${windowId}`;

async function isPanelOpen(windowId: number) {
  const key = panelOpenKey(windowId);
  const state = await chrome.storage.session.get(key);
  return state[key] === true;
}

function syncTab(tabId: number | undefined) {
  if (tabId == null) return;
  return Browser.tabs
    .sendMessage(tabId, { type: ACTIONS.syncToolsOverlay }, { frameId: 0 })
    .catch(() => {});
}

async function setPanelOpen(windowId: number, open: boolean) {
  const key = panelOpenKey(windowId);
  if (open) await chrome.storage.session.set({ [key]: true });
  else await chrome.storage.session.remove(key);

  const tabs = await Browser.tabs.query(open ? { windowId, active: true } : { windowId });
  await Promise.all(tabs.map((tab) => syncTab(tab.id)));
}

export async function getToolsOverlayState(
  sender: Runtime.MessageSender
): Promise<ToolsOverlayState> {
  const windowId = sender.tab?.windowId;
  if (windowId == null || !(await isPanelOpen(windowId))) return { visible: false };
  return { visible: true, side: (await chrome.sidePanel.getLayout()).side };
}

export function registerToolsOverlayListeners() {
  chrome.sidePanel.onOpened?.addListener(({ windowId }) => {
    void setPanelOpen(windowId, true);
  });
  chrome.sidePanel.onClosed?.addListener(({ windowId }) => {
    void setPanelOpen(windowId, false);
  });
  Browser.tabs.onActivated.addListener(async ({ tabId, windowId }) => {
    if (await isPanelOpen(windowId)) await syncTab(tabId);
  });
  Browser.windows.onRemoved.addListener((windowId) => {
    void chrome.storage.session.remove(panelOpenKey(windowId));
  });
}
