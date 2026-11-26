import Browser from "webextension-polyfill";
import { ACTIONS } from "@/lib/helper";
import { WRITING_TOOL_TITLE } from "@/lib/writing";
import type { ToolsOverlayState } from "@/types";
import { openCaptureOverlay } from "./capture-overlay";
import { dismissWritingTools, openWritingTools } from "./writing-tools";

const HOST_ID = "waffy-tools-overlay";

const CAPTURE_ICON = `
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12.034 12.681a.498.498 0 0 1 .647-.647l9 3.5a.5.5 0 0 1-.033.943l-4.344 1.068a1 1 0 0 0-.732.732l-1.067 4.344a.5.5 0 0 1-.943.033z"></path>
    <path d="M5 3a2 2 0 0 0-2 2"></path>
    <path d="M19 3a2 2 0 0 1 2 2"></path>
    <path d="M5 21a2 2 0 0 1-2-2"></path>
    <path d="M9 3h1"></path>
    <path d="M9 21h2"></path>
    <path d="M14 3h1"></path>
    <path d="M3 9v1"></path>
    <path d="M21 9v1"></path>
    <path d="M3 14v1"></path>
  </svg>
`;

const WRITING_ICON = `
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12 19h10"></path>
    <path d="m14 5 5 5"></path>
    <path d="M5.5 19 3 19l.5-4 12-12a2.8 2.8 0 0 1 4 4l-12 12z"></path>
  </svg>
`;

const STYLES = `
  :host {
    all: initial !important;
    display: block !important;
    position: fixed !important;
    inset: 0 !important;
    overflow: hidden !important;
    pointer-events: none !important;
    z-index: 2147483647 !important;
  }

  :host([hidden]),
  [hidden] {
    display: none !important;
  }

  .toolbar {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .toolbar[data-side="left"] {
    left: 8px;
  }

  .toolbar[data-side="right"] {
    right: 8px;
  }

  .tool-button {
    width: 36px;
    height: 36px;
    margin: 0;
    padding: 0;
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

  .tool-button:hover {
    background: rgba(32, 32, 32, 0.96);
  }

  .tool-hint {
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
    pointer-events: none;
  }
`;

let ui: ReturnType<typeof createToolsUi> | undefined;
let cancelCapture: (() => void) | undefined;
let syncRequest = 0;

function createToolButton(
  label: string,
  icon: string,
  open: () => void,
  preserveSelection = false
) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "tool-button";
  button.title = label;
  button.setAttribute("aria-label", label);
  button.innerHTML = icon;
  button.addEventListener("pointerdown", (event) => {
    if (preserveSelection) event.preventDefault();
    event.stopPropagation();
  });
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    if (event.isTrusted) open();
  });
  return button;
}

function createToolsUi() {
  document.getElementById(HOST_ID)?.remove();
  const host = document.createElement("div");
  host.id = HOST_ID;
  const root = host.attachShadow({ mode: "closed" });
  const style = new CSSStyleSheet();
  style.replaceSync(STYLES);
  root.adoptedStyleSheets = [style];

  const toolbar = document.createElement("div");
  toolbar.className = "toolbar";
  toolbar.setAttribute("role", "group");
  toolbar.setAttribute("aria-label", "Waffy tools");

  const status = document.createElement("div");
  status.className = "tool-hint";
  status.setAttribute("role", "status");
  status.hidden = true;
  let statusTimer: number | undefined;
  const showStatus = (message = "") => {
    window.clearTimeout(statusTimer);
    status.textContent = message;
    status.hidden = !message;
    if (message) {
      statusTimer = window.setTimeout(() => {
        status.hidden = true;
      }, 3000);
    }
  };

  const capture = createToolButton("Capture area", CAPTURE_ICON, () => {
    showStatus();
    dismissWritingTools();
    toolbar.hidden = true;
    cancelCapture = openCaptureOverlay(root, () => {
      cancelCapture = undefined;
      toolbar.hidden = false;
    });
  });
  const writing = createToolButton(
    WRITING_TOOL_TITLE,
    WRITING_ICON,
    () => {
      showStatus();
      void openWritingTools(root, showStatus);
    },
    true
  );
  toolbar.append(capture, writing);
  root.append(toolbar, status);
  document.documentElement.append(host);
  return { host, toolbar, showStatus };
}

function hideToolsOverlay() {
  if (ui) {
    ui.host.hidden = true;
    ui.showStatus();
  }
  dismissWritingTools();
  cancelCapture?.();
}

export async function syncToolsOverlay() {
  const request = ++syncRequest;
  const state = (await Browser.runtime
    .sendMessage({ action: ACTIONS.getToolsOverlayState })
    .catch(() => undefined)) as ToolsOverlayState | undefined;
  if (request !== syncRequest) return;
  if (!state?.visible) {
    hideToolsOverlay();
    return;
  }
  ui ??= createToolsUi();
  ui.toolbar.dataset.side = state.side;
  ui.host.hidden = false;
}

export function initToolsOverlay() {
  void syncToolsOverlay();
  window.addEventListener("pagehide", () => {
    syncRequest += 1;
    hideToolsOverlay();
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) void syncToolsOverlay();
  });
}
