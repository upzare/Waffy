import Browser, { type Runtime } from "webextension-polyfill";
import { getAppSettings } from "@/lib/client";
import { errorMessage } from "@/lib/errors";
import { generateWritingText } from "@/lib/llm/generate";
import {
  WRITING,
  writingFailure,
  type WritingGenerationResult,
  type WritingPrompt,
} from "@/lib/writing";

type PanelWritingMessage =
  | { action: typeof WRITING.generate; id: string; prompt: WritingPrompt }
  | { action: typeof WRITING.cancelGeneration; id: string }
  | { action: typeof WRITING.askInChat; text: string };

export function registerWritingMessages(appendText: (text: string) => void) {
  let windowId: number | undefined;
  const requests = new Map<string, AbortController>();
  void Browser.windows
    .getCurrent()
    .then(({ id }) => {
      windowId = id;
    })
    .catch(() => {});

  const generate = async (key: string, prompt: WritingPrompt): Promise<WritingGenerationResult> => {
    if (requests.has(key)) return { ok: false, message: "A rewrite is already in progress." };
    const controller = new AbortController();
    requests.set(key, controller);
    try {
      const text = await generateWritingText(prompt, await getAppSettings(), controller.signal);
      return { ok: true, text };
    } catch (error) {
      return { ok: false, message: errorMessage(error, "Could not generate a rewrite.") };
    } finally {
      requests.delete(key);
    }
  };

  const onMessage = (incoming: unknown, sender: Runtime.MessageSender) => {
    if (
      windowId == null ||
      sender.tab?.windowId !== windowId ||
      sender.id !== Browser.runtime.id ||
      sender.frameId !== 0 ||
      !sender.documentId
    ) {
      return undefined;
    }
    const message = incoming as PanelWritingMessage | null;
    switch (message?.action) {
      case WRITING.generate:
        if (
          typeof message.id !== "string" ||
          typeof message.prompt?.text !== "string" ||
          typeof message.prompt?.instruction !== "string" ||
          !message.prompt.instruction.trim() ||
          typeof message.prompt.singleLine !== "boolean"
        ) {
          return Promise.resolve(writingFailure("Enter an instruction to generate a rewrite."));
        }
        return generate(`${sender.documentId}:${message.id}`, message.prompt);
      case WRITING.cancelGeneration:
        requests.get(`${sender.documentId}:${message.id}`)?.abort();
        return undefined;
      case WRITING.askInChat:
        if (typeof message.text !== "string" || !message.text) {
          return Promise.resolve(writingFailure("The selection is empty."));
        }
        appendText(message.text);
        return Promise.resolve({ ok: true });
      default:
        return undefined;
    }
  };

  Browser.runtime.onMessage.addListener(onMessage);
  return () => {
    Browser.runtime.onMessage.removeListener(onMessage);
    for (const request of requests.values()) request.abort();
    requests.clear();
  };
}
