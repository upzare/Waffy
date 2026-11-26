import {
  writingFailure,
  writingReplacementError,
  writingTargetChanged,
  type WritingResult,
  type WritingSource,
} from "../writing";

type TextControl = HTMLInputElement | HTMLTextAreaElement;

export type WritingSelection = {
  source: WritingSource;
  applyText?: (text: string) => Promise<WritingResult>;
};

const READ_ONLY = '[aria-readonly="true"], [aria-disabled="true"], [inert]';

export function focusedElement() {
  let element = document.activeElement;
  while (element instanceof HTMLElement) {
    const inner = chrome.dom?.openOrClosedShadowRoot(element)?.activeElement;
    if (!inner) break;
    element = inner;
  }
  return element;
}

const isTextControl = (element: Element | null): element is TextControl =>
  element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement;

function readOnlySelection(text: string): WritingSelection | undefined {
  if (text) return { source: { text, kind: "read-only" } };
}

const isVisible = (element: HTMLElement) => element.checkVisibility({ visibilityProperty: true });

function isWritableControl(control: TextControl) {
  return (
    !control.readOnly &&
    !control.matches(":disabled") &&
    !control.closest(READ_ONLY) &&
    isVisible(control)
  );
}

const isFocused = (element: HTMLElement) =>
  (element.getRootNode() as Document | ShadowRoot).activeElement === element;

const textEditEvent = (text: string, inserting: boolean): InputEventInit => ({
  bubbles: true,
  composed: true,
  inputType: inserting ? "insertText" : "insertReplacementText",
  data: text,
});

async function confirmEdit(kept: () => boolean): Promise<WritingResult> {
  // A controlled editor can reconcile its value after handling input.
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  return kept() ? { ok: true } : writingFailure("This editor did not keep the generated text.");
}

function readControl(
  control: TextControl,
  start: number,
  end: number
): WritingSelection | undefined {
  const { value, maxLength, type } = control;
  const text = value.slice(start, end);
  if (!isWritableControl(control)) return readOnlySelection(text);

  const kind = control instanceof HTMLInputElement ? "single-line" : "multiline";
  const source: WritingSource = {
    text,
    kind,
    maxLength: maxLength < 0 ? undefined : Math.max(0, maxLength - (value.length - text.length)),
  };
  const stillCurrent = () =>
    control.type === type &&
    control.maxLength === maxLength &&
    control.value === value &&
    isWritableControl(control);

  return {
    source,
    async applyText(replacement) {
      const error = writingReplacementError(source, replacement);
      if (error) return writingFailure(error);
      if (!stillCurrent()) return writingTargetChanged(source);
      if (replacement === text) return { ok: true };

      control.focus({ preventScroll: true });
      if (!isFocused(control) || !stillCurrent()) return writingTargetChanged(source);
      const expected = value.slice(0, start) + replacement + value.slice(end);
      control.setSelectionRange(start, end);
      if (!document.execCommand("insertText", false, replacement)) {
        if (!isFocused(control) || !stillCurrent()) return writingTargetChanged(source);
        control.setRangeText(replacement, start, end, "end");
        control.dispatchEvent(new InputEvent("input", textEditEvent(replacement, start === end)));
      }
      return confirmEdit(() => control.isConnected && control.value === expected);
    },
  };
}

function editingHost(node: Node) {
  const element = node instanceof Element ? node : node.parentElement;
  if (
    !(element instanceof HTMLElement) ||
    !element.isContentEditable ||
    element.closest(READ_ONLY)
  ) {
    return;
  }
  let host = element;
  while (host.parentElement?.isContentEditable) host = host.parentElement;
  if (host !== document.documentElement) return host;
}

function rangeEditingHost({ startContainer, endContainer }: AbstractRange) {
  const host = editingHost(startContainer);
  if (
    host &&
    (startContainer === endContainer || editingHost(endContainer) === host) &&
    isVisible(host)
  ) {
    return host;
  }
}

function sameRange(a: AbstractRange, b: AbstractRange) {
  return (
    a.startContainer === b.startContainer &&
    a.startOffset === b.startOffset &&
    a.endContainer === b.endContainer &&
    a.endOffset === b.endOffset
  );
}

function readSelectionBounds(selection: Selection, root: Node) {
  return (
    selection.getComposedRanges?.({ shadowRoots: root instanceof ShadowRoot ? [root] : [] })[0] ??
    new StaticRange(selection.getRangeAt(0))
  );
}

function readEditableRange(host: HTMLElement, bounds: StaticRange, text: string): WritingSelection {
  const source: WritingSource = { text, kind: "multiline" };
  const range = document.createRange();
  range.setStart(bounds.startContainer, bounds.startOffset);
  range.setEnd(bounds.endContainer, bounds.endOffset);
  const contents = bounds.collapsed ? undefined : range.cloneContents();
  const stillCurrent = () =>
    sameRange(range, bounds) &&
    rangeEditingHost(range) === host &&
    (!contents || range.cloneContents().isEqualNode(contents));

  return {
    source,
    async applyText(replacement) {
      if (!stillCurrent()) return writingTargetChanged(source);
      host.focus({ preventScroll: true });
      if (!isFocused(host) || !stillCurrent()) return writingTargetChanged(source);

      const before = document.createRange();
      before.selectNodeContents(host);
      before.setEnd(range.startContainer, range.startOffset);
      const after = document.createRange();
      after.selectNodeContents(host);
      after.setStart(range.endContainer, range.endOffset);
      const normalize = (value: string) => value.replace(/\n/g, "").replace(/\u00a0/g, " ");
      const expected = normalize(before.toString() + replacement + after.toString());
      const kept = () => host.isConnected && normalize(host.textContent ?? "") === expected;

      const selection = document.getSelection();
      if (!selection) return writingTargetChanged(source);
      selection.setBaseAndExtent(
        range.startContainer,
        range.startOffset,
        range.endContainer,
        range.endOffset
      );
      const hasTargetSelection = () =>
        isFocused(host) &&
        selection.rangeCount > 0 &&
        sameRange(readSelectionBounds(selection, host.getRootNode()), bounds);

      if (
        range.startContainer === range.endContainer &&
        range.startContainer instanceof Text &&
        !replacement.includes("\n") &&
        hasTargetSelection() &&
        document.execCommand("insertText", false, replacement)
      ) {
        return confirmEdit(kept);
      }

      const event = textEditEvent(replacement, bounds.collapsed);
      if (
        host.dispatchEvent(
          new InputEvent("beforeinput", { ...event, cancelable: true, targetRanges: [bounds] })
        )
      ) {
        if (!stillCurrent() || !hasTargetSelection()) return writingTargetChanged(source);
        // A native edit joins blocks as needed and records the replacement in undo history.
        if (!document.execCommand("insertText", false, replacement)) {
          return writingFailure(
            "Could not apply the generated text in this editor. Copy & paste it manually."
          );
        }
      }
      return confirmEdit(kept);
    },
  };
}

export function readWritingSelection(active: Element | null): WritingSelection | undefined {
  if (isTextControl(active)) {
    if (active.type === "password") return;
    const { selectionStart: start, selectionEnd: end } = active;
    if (start !== null && end !== null && start < end) {
      return readControl(active, start, end);
    }
    const text = document.getSelection()?.toString() ?? "";
    if (text || start === null || end === null) return readOnlySelection(text);
    return readControl(active, start, end);
  }

  const selection = document.getSelection();
  const text = selection?.toString() ?? "";
  if (!active || !selection?.rangeCount) return readOnlySelection(text);

  const root = active.getRootNode();
  const range = selection.getRangeAt(0);
  const bounds = readSelectionBounds(selection, root);
  // Rescoping a shadow selection can widen it to the surrounding editable host.
  if (
    bounds.collapsed !== (text.length === 0) ||
    (root === document && !sameRange(bounds, range))
  ) {
    return readOnlySelection(text);
  }
  const host = rangeEditingHost(bounds);
  return host?.contains(active) ? readEditableRange(host, bounds, text) : readOnlySelection(text);
}
