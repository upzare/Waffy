import {
  PENDING_PANEL_ACTION_KEY,
  SUMMARIZE_PAGE_ACTION,
  type PendingPanelAction,
} from "../panel-actions";

const SUMMARIZE_PAGE_MENU_ID = "waffy-summarize-page";

export const createContextMenus = () => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: SUMMARIZE_PAGE_MENU_ID,
      title: "Summarize this page",
      contexts: ["page"],
      documentUrlPatterns: ["http://*/*", "https://*/*", "file://*/*"],
    });
  });
};

export const registerContextMenuListeners = () => {
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    switch (info.menuItemId) {
      case SUMMARIZE_PAGE_MENU_ID: {
        if (tab?.id == null || tab.windowId == null) return;

        // sidePanel.open must run synchronously within the user gesture.
        chrome.sidePanel.open({ windowId: tab.windowId }).catch((error) => {
          console.error("Failed to open side panel:", error);
        });

        const action: PendingPanelAction = {
          type: SUMMARIZE_PAGE_ACTION,
          tabId: tab.id,
          windowId: tab.windowId,
          createdAt: Date.now(),
        };
        chrome.storage.session.set({ [PENDING_PANEL_ACTION_KEY]: action }).catch((error) => {
          console.error("Failed to queue panel action:", error);
        });
        break;
      }
      default:
        break;
    }
  });
};
