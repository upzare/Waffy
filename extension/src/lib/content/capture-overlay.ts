import Browser from "webextension-polyfill";
import { ACTIONS } from "@/lib/helper";
import {
  MIN_CAPTURE_SIZE,
  isPanelSide,
  type PanelSide,
  type CaptureState,
  type CaptureRect,
} from "@/lib/capture";

const HOST_ID = "waffy-capture-overlay";

const CROP_ICON = `
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12.034 12.681a.498.498 0 0 1 .647-.647l9 3.5a.5.5 0 0 1-.033.943l-3.444 1.068a1 1 0 0 0-.66.66l-1.067 3.443a.5.5 0 0 1-.943.033z"></path>
    <path d="M5 3a2 2 0 0 0-2 2"></path>
    <path d="M19 3a2 2 0 0 1 2 2"></path>
    <path d="M5 21a2 2 0 0 1-2-2"></path>
    <path d="M9 3h1"></path>
    <path d="M9 21h2"></path>
    <path d="M14 3h1"></path>
    <path d="M3 9v1"></path>
    <path d="M21 9v2"></path>
    <path d="M3 14v1"></path>
  </svg>
`;

const STYLES = `
  :host {
    all: initial;
  }

  .is-hidden {
    display: none !important;
  }

  button {
    position: absolute;
    top: 50%;
    width: 36px;
    height: 36px;
    margin: 0;
    padding: 0;
    transform: translateY(-50%);
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.22);
    background: rgba(12, 12, 12, 0.9);
    color: #fff;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: auto;
    appearance: none;
  }

  button[data-side="left"] {
    left: 8px;
  }

  button[data-side="right"] {
    right: 8px;
  }

  button:hover {
    background: rgba(32, 32, 32, 0.96);
  }

  .capture-overlay {
    position: absolute;
    inset: 0;
    cursor: crosshair;
    pointer-events: auto;
    touch-action: none;
    user-select: none;
  }

  .shade,
  .hint,
  .selection,
  .label {
    pointer-events: none;
  }

  .shade {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
  }

  .hint {
    position: absolute;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    padding: 6px 10px;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.78);
    color: #fff;
    font: 12px/1.4 ui-sans-serif, system-ui, sans-serif;
    white-space: nowrap;
  }

  .selection {
    position: absolute;
    box-sizing: border-box;
    border: 1.5px solid rgba(255, 255, 255, 0.95);
    background: transparent;
    box-shadow: 0 0 0 100vmax rgba(0, 0, 0, 0.45);
  }

  .label {
    position: absolute;
    z-index: 1;
    padding: 2px 6px;
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.82);
    color: #fff;
    font: 12px/1.4 ui-sans-serif, system-ui, sans-serif;
    white-space: nowrap;
  }
`;

type CaptureUi = {
  host: HTMLDivElement;
  button: HTMLButtonElement;
  captureOverlay: HTMLDivElement;
  shade: HTMLDivElement;
  hint: HTMLDivElement;
  selection: HTMLDivElement;
  label: HTMLDivElement;
};

let ui: CaptureUi | null = null;
let side: PanelSide = "right";
let buttonVisible = false;
let selecting = false;
let capturing = false;
let buttonRequest = 0;
let drag: { pointerId: number; startX: number; startY: number } | null = null;

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const selectionRect = (startX: number, startY: number, endX: number, endY: number): CaptureRect => {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const x = clamp(Math.min(startX, endX), 0, viewportWidth);
  const y = clamp(Math.min(startY, endY), 0, viewportHeight);
  const right = clamp(Math.max(startX, endX), 0, viewportWidth);
  const bottom = clamp(Math.max(startY, endY), 0, viewportHeight);
  return { x, y, width: right - x, height: bottom - y };
};

const applyHostChrome = (host: HTMLElement, visible: boolean) => {
  const style = host.style;
  style.setProperty("all", "initial", "important");
  style.setProperty("position", "fixed", "important");
  style.setProperty("top", "0", "important");
  style.setProperty("right", "0", "important");
  style.setProperty("bottom", "0", "important");
  style.setProperty("left", "0", "important");
  style.setProperty("margin", "0", "important");
  style.setProperty("padding", "0", "important");
  style.setProperty("border", "0", "important");
  style.setProperty("background", "transparent", "important");
  style.setProperty("z-index", "2147483647", "important");
  style.setProperty("pointer-events", "none", "important");
  style.setProperty("overflow", "hidden", "important");
  style.setProperty("display", visible ? "block" : "none", "important");
};

const render = () => {
  if (!ui) return;
  const showHost = !capturing && (buttonVisible || selecting);
  applyHostChrome(ui.host, showHost);
  ui.button.classList.toggle("is-hidden", !buttonVisible || selecting || capturing);
  ui.button.dataset.side = side;
  ui.captureOverlay.classList.toggle("is-hidden", !selecting || capturing);
};

const resetSelectionBox = () => {
  if (!ui) return;
  ui.shade.classList.remove("is-hidden");
  ui.hint.classList.remove("is-hidden");
  ui.selection.classList.add("is-hidden");
  ui.label.classList.add("is-hidden");
};

const updateSelectionBox = (rect: CaptureRect) => {
  if (!ui) return;
  ui.shade.classList.add("is-hidden");
  ui.hint.classList.add("is-hidden");
  ui.selection.classList.remove("is-hidden");
  ui.label.classList.remove("is-hidden");
  ui.selection.style.left = `${rect.x}px`;
  ui.selection.style.top = `${rect.y}px`;
  ui.selection.style.width = `${rect.width}px`;
  ui.selection.style.height = `${rect.height}px`;
  ui.label.textContent = `${Math.round(rect.width)} × ${Math.round(rect.height)}`;
  const labelTop = rect.y > 28 ? rect.y - 26 : rect.y + 6;
  ui.label.style.left = `${rect.x}px`;
  ui.label.style.top = `${labelTop}px`;
};

const cancelSelection = () => {
  if (capturing) return;
  selecting = false;
  drag = null;
  resetSelectionBox();
  render();
};

const restoreButton = async () => {
  const requestId = ++buttonRequest;
  let visible = false;
  let nextSide = side;
  try {
    const response = (await Browser.runtime.sendMessage({
      action: ACTIONS.getCaptureButton,
    })) as CaptureState | undefined;
    visible = Boolean(response?.visible);
    if (isPanelSide(response?.side)) nextSide = response.side;
  } catch {
    visible = false;
  }
  if (requestId !== buttonRequest) return;
  side = nextSide;
  buttonVisible = visible;
  if (visible) ensureUi();
  render();
};

const finishSelection = async (rect: CaptureRect) => {
  capturing = true;
  selecting = false;
  drag = null;
  render();
  // Two frames let the browser paint the page without the dim overlay.
  await nextFrame();
  await nextFrame();

  try {
    await Browser.runtime.sendMessage({
      action: ACTIONS.capture,
      rect,
      viewport: { width: window.innerWidth, height: window.innerHeight },
    });
  } catch {
    // The panel reports capture failures. A closed extension context rejects here.
  } finally {
    capturing = false;
    resetSelectionBox();
    await restoreButton();
  }
};

const onKeyDown = (event: KeyboardEvent) => {
  if (!selecting) return;
  if (event.key !== "Escape") return;
  event.preventDefault();
  event.stopPropagation();
  cancelSelection();
};

const onPointerDown = (event: PointerEvent) => {
  if (!ui || event.button !== 0) return;
  event.preventDefault();
  event.stopPropagation();
  ui.captureOverlay.setPointerCapture(event.pointerId);
  drag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY };
};

const onPointerMove = (event: PointerEvent) => {
  if (!drag || event.pointerId !== drag.pointerId) return;
  const rect = selectionRect(drag.startX, drag.startY, event.clientX, event.clientY);
  if (rect.width <= 0 && rect.height <= 0) return;
  updateSelectionBox(rect);
};

const onPointerUp = (event: PointerEvent) => {
  if (!drag || event.pointerId !== drag.pointerId) return;
  const rect = selectionRect(drag.startX, drag.startY, event.clientX, event.clientY);
  drag = null;
  if (rect.width < MIN_CAPTURE_SIZE || rect.height < MIN_CAPTURE_SIZE) {
    cancelSelection();
    return;
  }
  void finishSelection(rect);
};

const onPointerCancel = (event: PointerEvent) => {
  if (!drag || event.pointerId !== drag.pointerId) return;
  cancelSelection();
};

const ensureUi = () => {
  if (ui) return ui;
  if (window.top !== window) return null;

  const existing = document.getElementById(HOST_ID);
  if (existing) existing.remove();

  const host = document.createElement("div");
  host.id = HOST_ID;
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = STYLES;

  const button = document.createElement("button");
  button.type = "button";
  button.title = "Capture area";
  button.setAttribute("aria-label", "Capture area");
  button.innerHTML = CROP_ICON;
  button.addEventListener("pointerdown", (event) => event.stopPropagation());
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (capturing || selecting) return;
    selecting = true;
    drag = null;
    resetSelectionBox();
    render();
  });

  const captureOverlay = document.createElement("div");
  captureOverlay.className = "capture-overlay is-hidden";
  const shade = document.createElement("div");
  shade.className = "shade";
  const hint = document.createElement("div");
  hint.className = "hint";
  hint.textContent = "Drag to select an area. Press Esc to cancel.";
  const selection = document.createElement("div");
  selection.className = "selection is-hidden";
  const label = document.createElement("div");
  label.className = "label is-hidden";
  captureOverlay.append(shade, hint, selection, label);
  captureOverlay.addEventListener("pointerdown", onPointerDown);
  captureOverlay.addEventListener("pointermove", onPointerMove);
  captureOverlay.addEventListener("pointerup", onPointerUp);
  captureOverlay.addEventListener("pointercancel", onPointerCancel);
  captureOverlay.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    cancelSelection();
  });
  captureOverlay.addEventListener("wheel", (event) => event.preventDefault(), {
    passive: false,
  });

  shadow.append(style, button, captureOverlay);
  (document.documentElement ?? document.body).append(host);
  window.addEventListener("keydown", onKeyDown, true);

  ui = { host, button, captureOverlay, shade, hint, selection, label };
  render();
  return ui;
};

export const showCaptureOverlay = (nextSide: PanelSide) => {
  buttonRequest += 1;
  if (!ensureUi()) return Promise.resolve({ status: "success" });
  side = nextSide;
  buttonVisible = true;
  if (!selecting && !capturing) render();
  return Promise.resolve({ status: "success" });
};

export const hideCaptureOverlay = () => {
  buttonRequest += 1;
  buttonVisible = false;
  if (selecting && !capturing) cancelSelection();
  else render();
  return Promise.resolve({ status: "success" });
};

export const initCaptureOverlay = () => {
  if (window.top !== window) return;
  void restoreButton();
};
