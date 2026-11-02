export const PENDING_PANEL_ACTION_KEY = "pendingPanelAction";
export const SUMMARIZE_PAGE_ACTION = "SUMMARIZE_PAGE";
export const PENDING_PANEL_ACTION_TTL_MS = 30_000;

export type PendingPanelAction = {
  type: typeof SUMMARIZE_PAGE_ACTION;
  tabId: number;
  windowId: number;
  createdAt: number;
};
