import Browser from "webextension-polyfill";
import type { Runtime, Tabs } from "webextension-polyfill";
import { isInaccessiblePage } from "@/helper";
import { attachTab, detachTab, disableDomains, enableDomains, isAttached } from "../cdp";
import { errorMessage } from "../errors";
import { isSearchTab } from "./search";

/** Domains the automation session drives: Overlay draws the cursor, DOM/Page back the actions. */
const DOMAINS = ["Page", "DOM", "Overlay"];
const WAFFY_GROUP_TITLE = "Waffy";
const WAFFY_GROUP_COLOR = "green" as const;

let openedTabs: Tabs.Tab[] = [];
let activeTabId: number | null = null;
let active = false;

const overlayInfo: Record<number, boolean> = {};

const setOverlay = (tabId: number, enabled: boolean) => {
  Browser.tabs
    .sendMessage(tabId, {
      type: "INTERACT_DOM",
      name: enabled ? "SHOW_OVERLAY" : "HIDE_OVERLAY",
    })
    .catch(() => {});
  overlayInfo[tabId] = enabled;
};

const disableNonActiveOverlays = (activeId: number) => {
  for (const key of Object.keys(overlayInfo)) {
    const tabId = Number(key);
    if (tabId !== activeId && overlayInfo[tabId]) setOverlay(tabId, false);
  }
};

/** Make one tab the only one showing the overlay. */
const focusTab = (tabId: number) => {
  disableNonActiveOverlays(tabId);
  activeTabId = tabId;
  setOverlay(tabId, true);
};

const addTabToWaffyGroup = async (tabId: number) => {
  if (!active || isSearchTab(tabId) || !chrome.tabGroups) return;
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.windowId == null) return;

    const existing = await chrome.tabGroups.query({
      title: WAFFY_GROUP_TITLE,
      windowId: tab.windowId,
    });
    const groupId = existing[0]?.id;
    const nextGroupId = await chrome.tabs.group({
      tabIds: tabId,
      ...(groupId != null ? { groupId } : {}),
    });
    await chrome.tabGroups.update(nextGroupId, {
      title: WAFFY_GROUP_TITLE,
      color: WAFFY_GROUP_COLOR,
      collapsed: false,
    });
  } catch {
    // Tab closed, restricted, or grouping unavailable — never fail the session.
  }
};

const clearWaffyGroups = async () => {
  if (!chrome.tabGroups) return;
  try {
    const groups = await chrome.tabGroups.query({ title: WAFFY_GROUP_TITLE });
    await Promise.all(
      groups.map(async (group) => {
        const tabs = await chrome.tabs.query({ groupId: group.id });
        const tabIds = tabs.map((tab) => tab.id).filter((id): id is number => id != null);
        if (tabIds.length) await chrome.tabs.ungroup(tabIds as [number, ...number[]]);
      })
    );
  } catch {
    // Group already gone or grouping unavailable.
  }
};

const attachDebugger = async (tabId: number) => {
  await attachTab(tabId);
  await enableDomains(tabId, DOMAINS);
};

const detachDebugger = async (tabId: number) => {
  if (!(await isAttached(tabId))) return;
  setOverlay(tabId, false);
  await disableDomains(tabId, DOMAINS);
  await detachTab(tabId);
};

const syncOpenedTabs = async () => {
  openedTabs = await Browser.tabs.query({});
};

/** Tabs automation may drive: real web pages that search does not own. */
const automationTabIds = (tabs: Tabs.Tab[]) =>
  tabs
    .filter((tab) => !isInaccessiblePage(tab.url))
    .map((tab) => tab.id)
    .filter((tabId): tabId is number => tabId != null && !isSearchTab(tabId));

const setActiveTab = async (tabId: number) => {
  await syncOpenedTabs();
  if (!openedTabs.some((tab) => tab.id === tabId)) return;
  focusTab(tabId);
  await addTabToWaffyGroup(tabId);
};

export const startSession = async (tabId: number) => {
  try {
    active = true;
    await syncOpenedTabs();
    await Promise.all(automationTabIds(openedTabs).map(attachDebugger));
    if (tabId) await setActiveTab(tabId);
    return { status: "success" };
  } catch (e) {
    return { status: "error", value: errorMessage(e) };
  }
};

export const stopSession = async () => {
  try {
    active = false;
    activeTabId = null;
    const tabs = await Browser.tabs.query({});
    await Promise.all([...automationTabIds(tabs).map(detachDebugger), clearWaffyGroups()]);
    return { status: "success" };
  } catch (e) {
    return { status: "error", value: errorMessage(e) };
  }
};

export const setTab = (tabId: number) => {
  const tab = openedTabs.find((t) => t.id === tabId);
  if (tab?.id == null) return Promise.resolve({ status: "error", value: "Tab not found" });

  focusTab(tab.id);
  void addTabToWaffyGroup(tab.id);
  return Promise.resolve({ status: "success", value: "Tab set successfully" });
};

export const getTab = () => Promise.resolve(openedTabs.find((tab) => tab.id === activeTabId));

export const setOpenedTabs = (tabs: Tabs.Tab[]) => {
  openedTabs = tabs;
  return Promise.resolve({ status: "success", value: "Tabs updated successfully" });
};

export const enableOverlay = (tabId: number) => {
  focusTab(tabId);
  return Promise.resolve({ status: "success", value: "Waffy overlay enabled" });
};

export const disableOverlay = (tabId: number) => {
  setOverlay(tabId, false);
  return Promise.resolve({ status: "success", value: "Waffy overlay disabled" });
};

export const getOverlayStatus = (sender: Runtime.MessageSender) => {
  const tabId = sender?.tab?.id;
  return Promise.resolve({
    status: tabId != null && overlayInfo[tabId] ? "enabled" : "disabled",
  });
};

export const registerAutomationListeners = () => {
  Browser.tabs.onCreated.addListener(async (tab) => {
    if (!active || tab.id == null) return;
    // Search/fetch tabs are created inactive; skip them so they never join the Waffy group.
    if (isSearchTab(tab.id) || !tab.active) {
      await syncOpenedTabs();
      return;
    }

    if (tab.openerTabId != null && tab.openerTabId === activeTabId) {
      await setActiveTab(tab.id);
      await Browser.tabs.update(tab.id, { active: true });
      return;
    }

    await syncOpenedTabs();
  });

  Browser.tabs.onUpdated.addListener((tabId, _changeInfo, tab) => {
    // Search runs its own debugger session, so its tabs must not get the automation overlay.
    if (!active || isSearchTab(tabId) || isInaccessiblePage(tab.url)) return;
    attachDebugger(tabId).catch((e) => console.error("Error attaching debugger:", errorMessage(e)));
  });
};
