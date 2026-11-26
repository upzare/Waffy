import Browser from "webextension-polyfill";
import { v4 as uuid4 } from "uuid";
import regularFont from "@fontsource/space-grotesk/files/space-grotesk-latin-400-normal.woff2?bytes";
import boldFont from "@fontsource/space-grotesk/files/space-grotesk-latin-700-normal.woff2?bytes";
import settingsTheme from "@/settings/settings.css?raw";
import {
  WRITING,
  WRITING_TOOL_TITLE,
  writingFailure,
  writingReplacementError,
  type WritingGenerationResult,
  type WritingPrompt,
  type WritingResult,
  type WritingSource,
} from "../writing";
import dialogStyles from "./writing-dialog.css?raw";

export const WRITING_DIALOG_FRAME = "data-waffy-writing-dialog";

const DRAFT_SUGGESTIONS = ["Ask for an update", "Say thank you", "Wish them luck", "Say goodbye"];

const REWRITE_SUGGESTIONS = [
  "Fix grammar",
  "Make it sound natural",
  "Shorten",
  "Make it more professional",
];

const MODAL_STYLES = `
  .writing-dialog {
    box-sizing: border-box;
    width: min(580px, calc(100vw - 32px));
    max-width: none;
    max-height: calc(100dvh - 32px);
    padding: 0;
    overflow: hidden;
    border: 1px solid rgb(255 255 255 / 12%);
    border-radius: 16px;
    background: #070807;
    color-scheme: dark;
    box-shadow: 0 20px 70px #0009;
    pointer-events: auto;
  }

  .writing-dialog::backdrop {
    background: rgb(0 0 0 / 60%);
    backdrop-filter: blur(4px);
  }

  .writing-dialog iframe {
    display: block;
    width: 100%;
    max-height: calc(100dvh - 34px);
    border: 0;
  }
`;

let modalStyle: CSSStyleSheet | undefined;

function removeDialog(dialog: HTMLDialogElement) {
  dialog.close();
  dialog.remove();
}

export function showWritingDialog(
  root: ShadowRoot,
  source: WritingSource,
  onDismiss: () => void,
  applyText?: (text: string) => Promise<WritingResult>
) {
  const dialog = document.createElement("dialog");
  dialog.className = "writing-dialog";
  dialog.setAttribute("aria-label", WRITING_TOOL_TITLE);

  // Keyboard events stay in the iframe, outside the host page's shortcut listeners.
  const frame = document.createElement("iframe");
  frame.title = WRITING_TOOL_TITLE;
  frame.setAttribute(WRITING_DIALOG_FRAME, "");
  frame.setAttribute("sandbox", "allow-same-origin");
  dialog.append(frame);

  if (!modalStyle) {
    modalStyle = new CSSStyleSheet();
    modalStyle.replaceSync(MODAL_STYLES);
  }
  if (!root.adoptedStyleSheets.includes(modalStyle)) root.adoptedStyleSheets.push(modalStyle);

  try {
    root.append(dialog);
    return mountWritingDialog(dialog, frame, source, onDismiss, applyText);
  } catch (error) {
    removeDialog(dialog);
    throw error;
  }
}

function mountWritingDialog(
  dialog: HTMLDialogElement,
  frame: HTMLIFrameElement,
  source: WritingSource,
  onDismiss: () => void,
  applyText?: (text: string) => Promise<WritingResult>
) {
  const frameDoc = frame.contentDocument;
  const frameWindow = frame.contentWindow as (Window & typeof globalThis) | null;
  if (!frameDoc || !frameWindow) throw new Error(`Could not open ${WRITING_TOOL_TITLE}.`);

  frameDoc.documentElement.lang = "en";
  const themeStyle = new frameWindow.CSSStyleSheet();
  themeStyle.replaceSync(`
    ${settingsTheme}
    html, body { height: 100%; overflow: hidden; }
    :root { color-scheme: dark; }
    body { margin: 0; background: var(--color-surface-1); }
  `);
  frameDoc.adoptedStyleSheets = [themeStyle];
  frameDoc.fonts.add(new frameWindow.FontFace("Space Grotesk", regularFont, { weight: "400" }));
  frameDoc.fonts.add(new frameWindow.FontFace("Space Grotesk", boldFont, { weight: "700" }));

  const frameHost = frameDoc.createElement("div");
  // The blank iframe is same-origin. Keep its contents in a closed shadow root.
  const frameRoot = frameHost.attachShadow({ mode: "closed" });
  const contentStyle = new frameWindow.CSSStyleSheet();
  contentStyle.replaceSync(dialogStyles);
  frameRoot.adoptedStyleSheets = [contentStyle];
  const content = frameDoc.createElement("div");
  content.className = "writing-layout";
  content.innerHTML = `
    <header class="writing-header">
      <h2>${WRITING_TOOL_TITLE}</h2>
      <span class="writing-progress-track" role="progressbar" aria-label="Generating text" hidden></span>
    </header>
    <main class="writing-body">
      <div class="writing-fields">
        <div class="writing-section" data-text-preview hidden>
          <label for="writing-text">Selected text</label>
          <textarea id="writing-text" readonly></textarea>
        </div>
        <div class="writing-section">
          <label for="writing-instruction">What would you like to do?</label>
          <div class="writing-instruction-field">
            <textarea id="writing-instruction" rows="1"></textarea>
            <button type="button" data-generate aria-label="Send instruction" title="Send instruction" disabled>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M5 12h14m-7-7 7 7-7 7"></path>
              </svg>
            </button>
          </div>
          <p class="writing-status" role="status" hidden>
            <svg class="writing-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m5 12 4 4L19 6" pathLength="1"></path>
            </svg>
            <span data-status-message></span>
          </p>
          <div class="writing-suggestions" data-suggestions></div>
        </div>
        <p class="writing-note" data-note hidden></p>
      </div>
    </main>
    <footer class="writing-footer">
      <button type="button" data-chat hidden>Ask in Chat</button>
      <button type="button" data-cancel>Cancel</button>
      <button type="button" data-apply disabled>Apply</button>
    </footer>
  `;

  frameRoot.append(content);
  frameDoc.body.append(frameHost);

  const textField = content.querySelector<HTMLTextAreaElement>("#writing-text")!;
  const textLabel = content.querySelector<HTMLLabelElement>('label[for="writing-text"]')!;
  const textPreview = content.querySelector<HTMLElement>("[data-text-preview]")!;
  const instruction = content.querySelector<HTMLTextAreaElement>("#writing-instruction")!;
  const generate = content.querySelector<HTMLButtonElement>("[data-generate]")!;
  const chat = content.querySelector<HTMLButtonElement>("[data-chat]")!;
  const cancel = content.querySelector<HTMLButtonElement>("[data-cancel]")!;
  const apply = content.querySelector<HTMLButtonElement>("[data-apply]")!;
  const suggestions = content.querySelector<HTMLDivElement>("[data-suggestions]")!;
  const note = content.querySelector<HTMLParagraphElement>("[data-note]")!;
  const status = content.querySelector<HTMLParagraphElement>(".writing-status")!;
  const statusMessage = content.querySelector<HTMLSpanElement>("[data-status-message]")!;
  const progressTrack = content.querySelector<HTMLSpanElement>(".writing-progress-track")!;
  const heightParts = [
    ...content.querySelectorAll(".writing-header, .writing-fields, .writing-footer"),
  ];

  const resize = () => {
    if (!dialog.open) return;
    const height = heightParts.reduce(
      (total, part) => total + part.getBoundingClientRect().height,
      0
    );
    const nextHeight = `${Math.ceil(height)}px`;
    if (frame.style.height !== nextHeight) frame.style.height = nextHeight;
  };
  const resizeObserver = new ResizeObserver(resize);
  const openDialog = () => {
    dialog.showModal();
    resize();
    instruction.focus({ preventScroll: true });
  };

  let text = source.text;
  textField.value = text;
  let hasGeneratedText = false;
  let closed = false;
  let requestId: string | null = null;
  let acting = false;
  let applyFailed = false;

  const updateSendButton = () => {
    generate.disabled = requestId !== null || acting || !instruction.value.trim();
  };

  const showStatus = (state: "success" | "error", message: string) => {
    status.dataset.state = state;
    status.hidden = false;
    statusMessage.textContent = message;
  };

  const setSuggestions = (choices: readonly string[]) => {
    const buttons = choices.map((suggestion) => {
      const button = frameDoc.createElement("button");
      button.type = "button";
      button.textContent = suggestion;
      button.addEventListener("click", () => {
        instruction.value = suggestion;
        updateSendButton();
        instruction.focus();
      });
      return button;
    });
    suggestions.replaceChildren(...buttons);
    return buttons;
  };

  let suggestionButtons = setSuggestions(text ? REWRITE_SUGGESTIONS : DRAFT_SUGGESTIONS);

  function render() {
    const waiting = requestId !== null;
    const hasText = Boolean(text);
    progressTrack.hidden = !waiting;
    textPreview.hidden = !hasText;
    chat.hidden = !hasText;
    instruction.placeholder = hasText
      ? "Describe how to rewrite this text"
      : "Describe what you want to write";
    textField.setAttribute("aria-busy", String(waiting));
    updateSendButton();
    instruction.disabled = acting;
    for (const button of suggestionButtons) button.disabled = acting;
    chat.disabled = acting;
    const replacementError =
      hasGeneratedText || source.kind === "read-only"
        ? writingReplacementError(source, text)
        : undefined;
    apply.disabled =
      !applyText ||
      waiting ||
      acting ||
      !hasGeneratedText ||
      applyFailed ||
      Boolean(replacementError);
    note.hidden = !replacementError;
    note.textContent = replacementError || "";
  }

  async function requestRewrite(event: Event) {
    if (!event.isTrusted || closed || generate.disabled) return;
    const isRewrite = Boolean(text);
    const draft = instruction.value;
    const prompt: WritingPrompt = {
      text,
      instruction: draft.trim(),
      singleLine: source.kind === "single-line",
    };
    const id = uuid4();
    requestId = id;
    instruction.value = "";
    instruction.focus({ preventScroll: true });
    status.hidden = true;
    render();
    const response = (await Browser.runtime
      .sendMessage({ action: WRITING.generate, id, prompt })
      .catch(() => undefined)) as WritingGenerationResult | undefined;
    if (requestId !== id) return;
    requestId = null;
    if (response?.ok) {
      text = response.text.replace(/\r\n?/g, "\n");
      hasGeneratedText = true;
      applyFailed = false;
      textLabel.textContent = "Generated text";
      textField.value = text;
      textField.scrollTop = 0;
      if (!isRewrite) suggestionButtons = setSuggestions(REWRITE_SUGGESTIONS);
      showStatus("success", isRewrite ? "Rewrite ready." : "Draft ready.");
    } else {
      if (!instruction.value) instruction.value = draft;
      showStatus("error", response?.message || "Could not reach the side panel. Try again.");
    }
    render();
  }

  instruction.addEventListener("input", updateSendButton);
  instruction.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey || event.isComposing || event.defaultPrevented)
      return;
    event.preventDefault();
    void requestRewrite(event);
  });
  generate.addEventListener("click", requestRewrite);
  chat.addEventListener("click", async (event) => {
    if (!event.isTrusted || chat.disabled) return;
    acting = true;
    render();
    const response = (await Browser.runtime
      .sendMessage({ action: WRITING.askInChat, text })
      .catch(() => undefined)) as WritingResult | undefined;
    if (closed) return;
    if (response?.ok) {
      onDismiss();
    } else {
      acting = false;
      showStatus("error", response?.message || "Could not reach the side panel. Try again.");
      render();
    }
  });
  apply.addEventListener("click", async (event) => {
    if (!event.isTrusted || apply.disabled || !applyText) return;
    acting = true;
    render();
    // Restore focus to the page before editing the target.
    dialog.close();
    const response = await applyText(text).catch(() =>
      writingFailure(
        source.text
          ? "Could not replace the selected text."
          : "Could not insert the generated text."
      )
    );
    if (closed) return;
    if (response.ok) {
      onDismiss();
    } else {
      acting = false;
      applyFailed = true;
      showStatus("error", response.message);
      render();
      openDialog();
    }
  });
  cancel.addEventListener("click", onDismiss);
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    onDismiss();
  });
  frameDoc.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || event.isComposing || event.defaultPrevented) return;
    event.preventDefault();
    onDismiss();
  });

  render();
  openDialog();
  heightParts.forEach((part) => resizeObserver.observe(part, { box: "border-box" }));
  return () => {
    if (closed) return;
    closed = true;
    resizeObserver.disconnect();
    const id = requestId;
    requestId = null;
    removeDialog(dialog);
    if (id) {
      void Browser.runtime.sendMessage({ action: WRITING.cancelGeneration, id }).catch(() => {});
    }
  };
}
