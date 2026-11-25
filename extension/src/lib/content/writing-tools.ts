import Browser, { type Runtime } from "webextension-polyfill";
import { v4 as uuid4 } from "uuid";
import {
  WRITING,
  WRITING_TOOL_TITLE,
  writingTargetChanged,
  type WritingResult,
  type WritingSelectionMessage,
  type WritingSource,
} from "../writing";
import { showWritingDialog, WRITING_DIALOG_FRAME } from "./writing-dialog";
import { focusedElement, readWritingSelection, type WritingSelection } from "./writing-selection";

type PageSelection = WritingSelection & { release?: () => void };
type WritingSession = { close?: () => void };

let active: WritingSession | undefined;

const isFrame = (element: Element | null) => element?.matches("iframe, frame, object");

async function readPageSelection(): Promise<PageSelection | undefined> {
  const element = focusedElement();
  if (!isFrame(element)) return readWritingSelection(element);

  const id = uuid4();
  const source = (await Browser.runtime
    .sendMessage({ action: WRITING.readSelection, id })
    .catch(() => undefined)) as WritingSource | undefined;
  if (!source) return;
  if (source.kind === "read-only") return { source };
  return {
    source,
    async applyText(text) {
      const result = (await Browser.runtime
        .sendMessage({ action: WRITING.apply, id, text })
        .catch(() => undefined)) as WritingResult | undefined;
      return result ?? writingTargetChanged(source);
    },
    release() {
      void Browser.runtime.sendMessage({ action: WRITING.releaseSelection, id }).catch(() => { });
    },
  };
}

export function dismissWritingTools() {
  const close = active?.close;
  active = undefined;
  close?.();
}

export async function openWritingTools(root: ShadowRoot, showStatus: (message: string) => void) {
  if (active) return;
  const opening: WritingSession = {};
  active = opening;
  let selection: PageSelection | undefined;
  try {
    selection = await readPageSelection();
    if (active !== opening) return;
    if (!selection) {
      showStatus("Select text or place the cursor in an input field.");
      return;
    }
    const { source, applyText, release } = selection;
    const closeDialog = showWritingDialog(root, source, dismissWritingTools, applyText);
    opening.close = () => {
      try {
        closeDialog();
      } finally {
        release?.();
      }
    };
    if (active !== opening) opening.close();
  } catch {
    if (active === opening) showStatus(`Could not open ${WRITING_TOOL_TITLE}.`);
  } finally {
    if (!opening.close) {
      if (active === opening) active = undefined;
      selection?.release?.();
    }
  }
}

export function registerWritingFrame() {
  if (window.frameElement?.hasAttribute(WRITING_DIALOG_FRAME)) return;

  let captured: { id: string; applyText: NonNullable<WritingSelection["applyText"]> } | undefined;
  Browser.runtime.onMessage.addListener((incoming: unknown, sender: Runtime.MessageSender) => {
    if (sender.id !== Browser.runtime.id) return undefined;
    const message = incoming as WritingSelectionMessage | null;
    switch (message?.action) {
      case WRITING.readSelection: {
        if (!document.hasFocus()) return undefined;
        const element = focusedElement();
        if (isFrame(element)) return undefined;
        const selection = readWritingSelection(element);
        const applyText = selection?.applyText;
        captured = applyText ? { id: message.id, applyText } : undefined;
        return selection ? Promise.resolve(selection.source) : undefined;
      }
      case WRITING.apply:
        if (captured?.id === message.id) return captured.applyText(message.text);
        return undefined;
      case WRITING.releaseSelection:
        if (captured?.id === message.id) captured = undefined;
        return undefined;
      default:
        return undefined;
    }
  });
  window.addEventListener("pagehide", () => {
    captured = undefined;
  });
}
