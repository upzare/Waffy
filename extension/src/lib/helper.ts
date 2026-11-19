import Browser from "webextension-polyfill";
import type { Tabs } from "webextension-polyfill";

export const ACTIONS = {
  setTab: "SET_TAB",
  getTab: "GET_TAB",
  setOpenedTabs: "SET_OPENED_TABS",
  enableAutomationOverlay: "ENABLE_AUTOMATION_OVERLAY",
  disableAutomationOverlay: "DISABLE_AUTOMATION_OVERLAY",
  getAutomationOverlayStatus: "GET_AUTOMATION_OVERLAY_STATUS",
  startSession: "START_SESSION",
  stopSession: "STOP_SESSION",
  stopGeneration: "STOP_GENERATION",
  getPageInfo: "GET_PAGE_INFO",
  getPageContent: "GET_PAGE_CONTENT",
  captureVisibleTab: "CAPTURE_VISIBLE_TAB",
  webSearch: "WEB_SEARCH",
  webFetch: "WEB_FETCH",
  reloadPanel: "RELOAD_PANEL",
  getCaptureButton: "GET_CAPTURE_BUTTON",
  capture: "CAPTURE",
  attachCapture: "ATTACH_CAPTURE",
  showCaptureOverlay: "SHOW_CAPTURE_OVERLAY",
  hideCaptureOverlay: "HIDE_CAPTURE_OVERLAY",
  getDevicePixelRatio: "GET_DEVICE_PIXEL_RATIO",
  interactDom: "INTERACT_DOM",
} as const;

export const DOM_ACTIONS = {
  getOption: "GET_OPTION",
  setOption: "SET_OPTION",
  displayPointer: "DISPLAY_POINTER",
  animatePointer: "ANIMATE_POINTER",
  showAutomationOverlay: "SHOW_AUTOMATION_OVERLAY",
  hideAutomationOverlay: "HIDE_AUTOMATION_OVERLAY",
} as const;

export type RuntimeMessage<T = undefined> = {
  action: string;
  windowId: number;
  payload?: T;
};

export type CapturePayload = {
  name: string;
  mimeType: string;
  content: string;
};

/** Internal / extension pages that content scripts and automation cannot access. */
const INACCESSIBLE_URL_PREFIXES = [
  "chrome://",
  "chrome-extension://",
  "chrome-search://",
  "chrome-devtools://",
  "devtools://",
  "brave://",
  "edge://",
  "extension://",
  "opera://",
  "vivaldi://",
  "arc://",
  "about:",
  "moz-extension://",
  "view-source:",
  "data:",
  "blob:",
] as const;

export const isInaccessiblePage = (url?: string) =>
  !url || INACCESSIBLE_URL_PREFIXES.some((prefix) => url.startsWith(prefix));

export const isHttpUrl = (url?: string) =>
  !!url && (url.startsWith("http://") || url.startsWith("https://"));

const BASE64_CHUNK = 0x8000;

export const stripBase64Prefix = (value: string) => value.replace(/^data:[^;]+;base64,/, "");

export const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (let index = 0; index < bytes.length; index += BASE64_CHUNK) {
    const chunk = bytes.subarray(index, index + BASE64_CHUNK);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
};

export const base64ToBytes = (value: string) => {
  const binary = atob(stripBase64Prefix(value));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

export const base64ToBlob = (value: string, type: string) =>
  new Blob([base64ToBytes(value)], { type });

export async function getCurrentWindowTabs(): Promise<Tabs.Tab[]> {
  const current = await Browser.windows.getCurrent();
  if (current.id == null) return [];
  return Browser.tabs.query({ windowId: current.id });
}

export async function getActiveTab(): Promise<Tabs.Tab | undefined> {
  const current = await Browser.tabs.query({ active: true, currentWindow: true });
  if (current[0]?.id) return current[0];

  const windows = await Browser.windows.getAll({ populate: true, windowTypes: ["normal"] });
  for (const win of windows) {
    const tab = win.tabs?.find((t) => t.active);
    if (tab?.id) return tab;
  }
  return undefined;
}
