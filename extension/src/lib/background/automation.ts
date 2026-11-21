import Browser from "webextension-polyfill";
import type { Runtime } from "webextension-polyfill";
import { ACTIONS, DOM_ACTIONS, isInaccessiblePage } from "@/lib/helper";
import { attachTab, detachTab, disableDomains, enableDomains, isAttached } from "../cdp";
import { errorMessage } from "../errors";
import { isOwnedTab } from "./fetch";

/** Domains the automation session drives: Overlay draws the cursor, DOM/Page back the actions. */
const DOMAINS = ["Page", "DOM", "Overlay"];
const WAFFY_GROUP_TITLE = "Waffy";
const WAFFY_GROUP_COLOR = "green" as const;

let activeTabId: number | null = null;
let active = false;

const attachedTabs = new Map<number, Promise<void>>();
const groupedTabs = new Map<number, number>();

const setAutomationOverlay = (tabId: number, enabled: boolean) => {
  Browser.tabs
    .sendMessage(tabId, {
      type: ACTIONS.interactDom,
      name: enabled ? DOM_ACTIONS.showAutomationOverlay : DOM_ACTIONS.hideAutomationOverlay,
    })
    .catch(() => {});
};

/** Make one tab the only one showing the overlay. */
const focusTab = (tabId: number) => {
  if (activeTabId !== null && activeTabId !== tabId) setAutomationOverlay(activeTabId, false);
  activeTabId = tabId;
  setAutomationOverlay(tabId, true);
};

const addTabToWaffyGroup = async (tabId: number) => {
  if (!active || isOwnedTab(tabId) || !chrome.tabGroups) return;
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.windowId == null || tab.groupId >= 0) return;

    const existing = await chrome.tabGroups.query({
      windowId: tab.windowId,
    });
    const sessionGroups = new Set(groupedTabs.values());
    const groupId = existing.find((group) => sessionGroups.has(group.id))?.id;
    const nextGroupId = await chrome.tabs.group({
      tabIds: tabId,
      ...(groupId != null ? { groupId } : {}),
    });
    groupedTabs.set(tabId, nextGroupId);
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
  await Promise.allSettled(
    Array.from(groupedTabs, async ([tabId, groupId]) => {
      const tab = await chrome.tabs.get(tabId);
      if (tab.groupId === groupId) await chrome.tabs.ungroup(tabId);
    })
  );
  groupedTabs.clear();
};

const detachDebugger = async (tabId: number) => {
  if (!(await isAttached(tabId))) return;
  await disableDomains(tabId, DOMAINS);
  await detachTab(tabId);
};

function attachDebugger(tabId: number): Promise<void> {
  const existing = attachedTabs.get(tabId);
  if (existing) return existing;
  const attaching = attachTab(tabId)
    .then(async () => {
      try {
        await enableDomains(tabId, DOMAINS);
      } catch (error) {
        await detachDebugger(tabId);
        throw error;
      }
    })
    .catch((error) => {
      attachedTabs.delete(tabId);
      throw error;
    });
  attachedTabs.set(tabId, attaching);
  return attaching;
}

const setActiveTab = async (tabId: number) => {
  const tab = await Browser.tabs.get(tabId);
  if (!active) throw new Error("The automation session has ended.");
  if (isOwnedTab(tabId)) throw new Error("This tab is being used for a web lookup.");
  if (!isInaccessiblePage(tab.url)) await attachDebugger(tabId);
  if (!active) return;
  focusTab(tabId);
  await addTabToWaffyGroup(tabId);
};

export const startSession = async (tabId: number) => {
  try {
    active = true;
    await setActiveTab(tabId);
    return { status: "success" };
  } catch (e) {
    return { status: "error", value: errorMessage(e) };
  }
};

export const stopSession = async () => {
  try {
    active = false;
    if (activeTabId !== null) setAutomationOverlay(activeTabId, false);
    activeTabId = null;
    const pending = [...attachedTabs];
    await Promise.all([
      ...pending.map(([id, ready]) =>
        ready.then(
          () => detachDebugger(id),
          () => {}
        )
      ),
      clearWaffyGroups(),
    ]);
    attachedTabs.clear();
    return { status: "success" };
  } catch (e) {
    return { status: "error", value: errorMessage(e) };
  }
};

export const setTab = async (tabId: number) => {
  try {
    await setActiveTab(tabId);
    return { status: "success", value: "Tab set successfully" };
  } catch (error) {
    return { status: "error", value: errorMessage(error) };
  }
};

export const getTab = async () =>
  activeTabId === null ? undefined : Browser.tabs.get(activeTabId).catch(() => undefined);

export const getAutomationOverlayStatus = (sender: Runtime.MessageSender) => {
  const tabId = sender?.tab?.id;
  return Promise.resolve({
    status: active && tabId != null && activeTabId === tabId ? "enabled" : "disabled",
  });
};

export const registerAutomationListeners = () => {
  chrome.debugger.onDetach.addListener(({ tabId }) => {
    if (tabId != null) attachedTabs.delete(tabId);
  });
  Browser.tabs.onCreated.addListener(async (tab) => {
    if (!active || tab.id == null) return;
    // Search/fetch tabs are created inactive; skip them so they never join the Waffy group.
    if (isOwnedTab(tab.id) || !tab.active) return;

    if (tab.openerTabId != null && tab.openerTabId === activeTabId) {
      await setActiveTab(tab.id);
      await Browser.tabs.update(tab.id, { active: true });
    }
  });

  Browser.tabs.onUpdated.addListener((tabId, _changeInfo, tab) => {
    // Fetch/search runs its own debugger session, so its tabs must not get the automation overlay.
    if (!active || tabId !== activeTabId || isInaccessiblePage(tab.url)) return;
    attachDebugger(tabId).catch((e) => console.error("Error attaching debugger:", errorMessage(e)));
  });
};
