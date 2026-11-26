import Browser, { type Runtime } from "webextension-polyfill";
import { ACTIONS, base64ToBlob, bytesToBase64, type CapturePayload } from "@/lib/helper";
import {
  MIN_CAPTURE_SIZE,
  isCaptureRect,
  isCaptureViewport,
  type CaptureRect,
  type CaptureViewport,
} from "@/lib/capture";
import { SCREENSHOT_QUALITY, captureVisibleTab } from "./page";

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

const notifyPanel = (windowId: number, payload: CapturePayload) =>
  Browser.runtime.sendMessage({
    action: ACTIONS.attachCapture,
    windowId,
    payload,
  });

export const capture = async (sender: Runtime.MessageSender, rect: unknown, viewport: unknown) => {
  const tabId = sender.tab?.id;
  const windowId = sender.tab?.windowId;
  if (tabId == null || windowId == null)
    return { status: "error", message: "No tab/window found." };

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
    await notifyPanel(windowId, { name: "page-capture.jpg", mimeType: "image/jpeg", content });
    return { status: "success" };
  } catch {
    return { status: "error", message: "Couldn't capture that area." };
  }
};
