import Browser, { type Runtime } from "webextension-polyfill";
import { WRITING, type WritingSelectionMessage } from "../writing";

export function relayWriting(request: WritingSelectionMessage, sender: Runtime.MessageSender) {
  const tabId = sender.tab?.id;
  if (
    tabId == null ||
    sender.id !== Browser.runtime.id ||
    sender.frameId !== 0 ||
    typeof request.id !== "string" ||
    (request.action === WRITING.apply && typeof request.text !== "string")
  ) {
    return undefined;
  }

  // The focused child frame records the selection. Only that frame owns its request ID.
  return Browser.tabs.sendMessage(tabId, request);
}
