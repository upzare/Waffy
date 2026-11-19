import Browser from "webextension-polyfill";
import type { Runtime } from "webextension-polyfill";
import { ACTIONS, base64ToBlob, bytesToBase64, type CapturePayload } from "@/lib/helper";
import {
  MIN_CAPTURE_SIZE,
  isCaptureRect,
  isCaptureViewport,
  type PanelSide,
  type CaptureState,
  type CaptureRect,
  type CaptureViewport,
} from "@/lib/capture";
import { SCREENSHOT_QUALITY, captureVisibleTab } from "./page";

const openWindows = new Set<number>();

const getPanelSide = async () => (await chrome.sidePanel.getLayout()).side;

const showCaptureOverlay = (tabId: number, side: PanelSide) =>
  Browser.tabs.sendMessage(tabId, { type: ACTIONS.showCaptureOverlay, side });

const hideCaptureOverlay = (tabId: number) =>
  Browser.tabs.sendMessage(tabId, { type: ACTIONS.hideCaptureOverlay });

const syncCapture = async (windowId: number) => {
  if (!openWindows.has(windowId)) return;
  const [tab] = await Browser.tabs.query({ active: true, windowId });
  if (tab?.id == null) return;
  await showCaptureOverlay(tab.id, await getPanelSide());
};

const markPanelOpen = async (windowId: number) => {
  openWindows.add(windowId);
  await syncCapture(windowId);
};

const markPanelClosed = async (windowId: number) => {
  openWindows.delete(windowId);
  const tabs = await Browser.tabs.query({ windowId });
  await Promise.all(tabs.flatMap((tab) => (tab.id == null ? [] : [hideCaptureOverlay(tab.id)])));
};

export const getCaptureState = async (
  sender: Runtime.MessageSender
): Promise<CaptureState> => {
  const windowId = sender.tab?.windowId;
  const visible = windowId != null && openWindows.has(windowId);
  return { visible, side: await getPanelSide() };
};

const cropCapture = async (image: string, rect: CaptureRect, viewport: CaptureViewport) => {
  const bitmap = await createImageBitmap(base64ToBlob(image, "image/jpeg"));
  try {
    const scaleX = bitmap.width / viewport.width;
    const scaleY = bitmap.height / viewport.height;
    const sx = Math.max(0, Math.min(bitmap.width - 1, Math.round(rect.x * scaleX)));
    const sy = Math.max(0, Math.min(bitmap.height - 1, Math.round(rect.y * scaleY)));
    const sw = Math.max(1, Math.min(bitmap.width - sx, Math.round(rect.width * scaleX)));
    const sh = Math.max(1, Math.min(bitmap.height - sy, Math.round(rect.height * scaleY)));
    const canvas = new OffscreenCanvas(sw, sh);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not crop the screenshot.");
    context.drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh);
    const blob = await canvas.convertToBlob({
      type: "image/jpeg",
      quality: SCREENSHOT_QUALITY / 100,
    });
    return bytesToBase64(new Uint8Array(await blob.arrayBuffer()));
  } finally {
    bitmap.close();
  }
};

const notifyPanel = (payload: CapturePayload) =>
  Browser.runtime.sendMessage({
    action: ACTIONS.attachCapture,
    payload,
  });

export const capture = async (
  sender: Runtime.MessageSender,
  rect: unknown,
  viewport: unknown
) => {
  const tabId = sender.tab?.id;
  if (tabId == null) return { status: "error", message: "No tab found." };

  if (
    !isCaptureRect(rect) ||
    rect.width < MIN_CAPTURE_SIZE ||
    rect.height < MIN_CAPTURE_SIZE ||
    !isCaptureViewport(viewport)
  ) {
    return { status: "error", message: "Select a larger area." };
  }

  const captured = await captureVisibleTab(tabId);
  if (captured.status !== "success" || !captured.image) {
    return { status: "error", message: "Failed to capture the page." };
  }

  try {
    const content = await cropCapture(captured.image, rect, viewport);
    await notifyPanel({ name: "page-capture.jpg", mimeType: "image/jpeg", content });
    return { status: "success" };
  } catch {
    return { status: "error", message: "Couldn't capture that area." };
  }
};

export const registerCaptureListeners = () => {
  chrome.sidePanel.onOpened?.addListener((info) => {
    void markPanelOpen(info.windowId);
  });
  chrome.sidePanel.onClosed?.addListener((info) => {
    void markPanelClosed(info.windowId);
  });

  Browser.tabs.onActivated.addListener((info) => {
    void syncCapture(info.windowId);
  });

  Browser.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
    if (changeInfo.status !== "complete" || tab.windowId == null || !tab.active) return;
    void syncCapture(tab.windowId);
  });

  Browser.windows.onRemoved.addListener((windowId) => {
    openWindows.delete(windowId);
  });
};
