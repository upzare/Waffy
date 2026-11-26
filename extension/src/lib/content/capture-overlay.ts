import Browser from "webextension-polyfill";
import { ACTIONS } from "@/lib/helper";
import { MIN_CAPTURE_SIZE, type CaptureRect } from "@/lib/capture";

const STYLES = `
  .capture-overlay {
    position: absolute;
    inset: 0;
    cursor: crosshair;
    pointer-events: auto;
    touch-action: none;
    user-select: none;
  }

  .capture-shade,
  .capture-selection,
  .capture-label {
    pointer-events: none;
  }

  .capture-shade {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
  }

  .capture-selection {
    position: absolute;
    box-sizing: border-box;
    border: 1.5px solid rgba(255, 255, 255, 0.95);
    box-shadow: 0 0 0 100vmax rgba(0, 0, 0, 0.45);
  }

  .capture-label {
    position: absolute;
    padding: 2px 6px;
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.82);
    color: #fff;
    font: 12px/1.4 ui-sans-serif, system-ui, sans-serif;
    white-space: nowrap;
  }
`;

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

const clamp = (value: number, max: number) => Math.min(max, Math.max(0, value));

function selectionRect(startX: number, startY: number, endX: number, endY: number): CaptureRect {
  const x = clamp(Math.min(startX, endX), window.innerWidth);
  const y = clamp(Math.min(startY, endY), window.innerHeight);
  const right = clamp(Math.max(startX, endX), window.innerWidth);
  const bottom = clamp(Math.max(startY, endY), window.innerHeight);
  return { x, y, width: right - x, height: bottom - y };
}

export function openCaptureOverlay(root: ShadowRoot, onClose: () => void) {
  const style = new CSSStyleSheet();
  style.replaceSync(STYLES);
  root.adoptedStyleSheets.push(style);

  const overlay = document.createElement("div");
  overlay.className = "capture-overlay";
  overlay.innerHTML = `
    <div class="capture-shade"></div>
    <div class="tool-hint">Drag to select an area. Press Esc to cancel.</div>
    <div class="capture-selection" hidden></div>
    <div class="capture-label" hidden></div>
  `;
  const shade = overlay.querySelector<HTMLDivElement>(".capture-shade")!;
  const hint = overlay.querySelector<HTMLDivElement>(".tool-hint")!;
  const selection = overlay.querySelector<HTMLDivElement>(".capture-selection")!;
  const label = overlay.querySelector<HTMLDivElement>(".capture-label")!;
  const listeners = new AbortController();
  const { signal } = listeners;
  let drag: { pointerId: number; x: number; y: number } | undefined;

  const remove = () => {
    listeners.abort();
    overlay.remove();
    root.adoptedStyleSheets = root.adoptedStyleSheets.filter((sheet) => sheet !== style);
  };

  const cancel = () => {
    if (signal.aborted) return;
    remove();
    onClose();
  };

  const capture = async (rect: CaptureRect) => {
    remove();
    // Let the page paint with both the selection and toolbar hidden.
    await nextFrame();
    await nextFrame();
    try {
      await Browser.runtime.sendMessage({
        action: ACTIONS.capture,
        rect,
        viewport: { width: window.innerWidth, height: window.innerHeight },
      });
    } catch {
      // The extension context can close while the capture is in progress.
    } finally {
      onClose();
    }
  };

  overlay.addEventListener(
    "pointerdown",
    (event) => {
      if (event.button !== 0 || drag) return;
      event.preventDefault();
      event.stopPropagation();
      overlay.setPointerCapture(event.pointerId);
      drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    },
    { signal }
  );
  overlay.addEventListener(
    "pointermove",
    (event) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      const { x, y, width, height } = selectionRect(drag.x, drag.y, event.clientX, event.clientY);
      if (!width && !height) return;

      shade.hidden = true;
      hint.hidden = true;
      selection.hidden = false;
      label.hidden = false;
      selection.style.left = `${x}px`;
      selection.style.top = `${y}px`;
      selection.style.width = `${width}px`;
      selection.style.height = `${height}px`;
      label.textContent = `${Math.round(width)} × ${Math.round(height)}`;
      label.style.left = `${x}px`;
      label.style.top = `${y > 28 ? y - 26 : y + 6}px`;
    },
    { signal }
  );
  overlay.addEventListener(
    "pointerup",
    (event) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      const rect = selectionRect(drag.x, drag.y, event.clientX, event.clientY);
      if (rect.width < MIN_CAPTURE_SIZE || rect.height < MIN_CAPTURE_SIZE) cancel();
      else void capture(rect);
    },
    { signal }
  );
  overlay.addEventListener(
    "pointercancel",
    (event) => {
      if (drag?.pointerId === event.pointerId) cancel();
    },
    { signal }
  );
  overlay.addEventListener(
    "contextmenu",
    (event) => {
      event.preventDefault();
      cancel();
    },
    { signal }
  );
  overlay.addEventListener("wheel", (event) => event.preventDefault(), { passive: false, signal });
  window.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      cancel();
    },
    { capture: true, signal }
  );

  root.append(overlay);
  return cancel;
}
