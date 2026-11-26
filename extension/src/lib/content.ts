import Browser from "webextension-polyfill";
import { ACTIONS } from "@/lib/helper";
import type { DomMessage } from "../types";
import { initAutomationOverlay, syncAutomationOverlay } from "./content/automation-overlay";
import { interactDom } from "./content/interact";
import { getDevicePixelRatio, getPageContent } from "./content/page";
import { initToolsOverlay, syncToolsOverlay } from "./content/tools-overlay";
import { registerWritingFrame } from "./content/writing-tools";

if (window.top === window) {
  initToolsOverlay();
  initAutomationOverlay();
  void syncAutomationOverlay();
  Browser.runtime.onMessage.addListener((incoming: unknown) => {
    const message = incoming as DomMessage | null;
    switch (message?.type) {
      case ACTIONS.getDevicePixelRatio:
        return getDevicePixelRatio();
      case ACTIONS.getPageContent:
        return getPageContent();
      case ACTIONS.interactDom:
        return interactDom(message.name ?? "", message.args ?? {});
      case ACTIONS.syncToolsOverlay:
        return syncToolsOverlay();
      default:
        return undefined;
    }
  });
} else {
  registerWritingFrame();
}
