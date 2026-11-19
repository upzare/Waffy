import Browser from "webextension-polyfill";
import { ACTIONS } from "@/lib/helper";
import { isPanelSide } from "@/lib/capture";
import type { DomMessage } from "../types";
import { initAutomationOverlay, syncAutomationOverlay } from "./content/automation-overlay";
import { interactDom } from "./content/interact";
import { getDevicePixelRatio, getPageContent } from "./content/page";
import {
  hideCaptureOverlay,
  initCaptureOverlay,
  showCaptureOverlay,
} from "./content/capture-overlay";

initCaptureOverlay();
initAutomationOverlay();
void syncAutomationOverlay();

Browser.runtime.onMessage.addListener((message: any) => {
  const msg = message as DomMessage;
  switch (msg.type) {
    case ACTIONS.getDevicePixelRatio:
      return getDevicePixelRatio();
    case ACTIONS.getPageContent:
      return getPageContent();
    case ACTIONS.interactDom:
      return interactDom(msg.name ?? "", msg.args ?? {});
    case ACTIONS.showCaptureOverlay:
      return showCaptureOverlay(isPanelSide(message?.side) ? message.side : "right");
    case ACTIONS.hideCaptureOverlay:
      return hideCaptureOverlay();
    default:
      return undefined;
  }
});
