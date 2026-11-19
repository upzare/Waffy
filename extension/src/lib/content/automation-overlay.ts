import Browser from "webextension-polyfill";
import { ACTIONS } from "@/lib/helper";

const AUTOMATION_OVERLAY_STYLE = `
  .waffy-automation-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    z-index: 2147483647;
    border: 0px solid transparent;
    box-shadow: inset 0 0 20px rgba(0, 255, 255, 0.4),
                inset 0 0 35px rgba(0, 255, 255, 0.3),
                inset 0 0 50px rgba(0, 255, 255, 0.2);
    animation: waffyAutomationOverlayAnim 4s ease-in-out infinite;
  }

  @keyframes waffyAutomationOverlayAnim {
    0% {
      box-shadow: inset 0 0 20px rgba(0, 255, 255, 0.4),
                  inset 0 0 35px rgba(0, 255, 255, 0.3),
                  inset 0 0 50px rgba(0, 255, 255, 0.2);
    }
    14% {
      box-shadow: inset 0 0 24px rgba(0, 255, 200, 0.5),
                  inset 0 0 36px rgba(0, 255, 200, 0.35),
                  inset 0 0 46px rgba(0, 255, 200, 0.25);
    }
    28% {
      box-shadow: inset 0 0 26px rgba(0, 255, 127, 0.5),
                  inset 0 0 40px rgba(0, 255, 127, 0.4),
                  inset 0 0 46px rgba(0, 255, 127, 0.3);
    }
    42% {
      box-shadow: inset 0 0 25px rgba(144, 238, 144, 0.5),
                  inset 0 0 35px rgba(144, 238, 144, 0.38),
                  inset 0 0 48px rgba(144, 238, 144, 0.28);
    }
    56% {
      box-shadow: inset 0 0 24px rgba(173, 216, 230, 0.48),
                  inset 0 0 34px rgba(173, 216, 230, 0.34),
                  inset 0 0 46px rgba(173, 216, 230, 0.24);
    }
    70% {
      box-shadow: inset 0 0 25px rgba(221, 160, 221, 0.5),
                  inset 0 0 35px rgba(221, 160, 221, 0.36),
                  inset 0 0 50px rgba(221, 160, 221, 0.26);
    }
    84% {
      box-shadow: inset 0 0 22px rgba(175, 238, 238, 0.46),
                  inset 0 0 32px rgba(175, 238, 238, 0.32),
                  inset 0 0 45px rgba(175, 238, 238, 0.22);
    }
    100% {
      box-shadow: inset 0 0 20px rgba(0, 255, 255, 0.4),
                  inset 0 0 35px rgba(0, 255, 255, 0.3),
                  inset 0 0 50px rgba(0, 255, 255, 0.2);
    }
  }
`;

const automationOverlayElement = () =>
  document.querySelector(".waffy-automation-overlay") as HTMLElement | null;

export const initAutomationOverlay = () => {
  if (automationOverlayElement()) return;

  const style = document.createElement("style");
  style.textContent = AUTOMATION_OVERLAY_STYLE;

  const overlay = document.createElement("div");
  overlay.className = "waffy-automation-overlay";
  overlay.style.display = "none";

  document.head.appendChild(style);
  document.body.appendChild(overlay);
};

export const enableAutomationOverlay = () => {
  const overlay = automationOverlayElement();
  if (overlay) overlay.style.display = "block";
};

export const disableAutomationOverlay = () => {
  const overlay = automationOverlayElement();
  if (overlay) overlay.style.display = "none";
};

export const syncAutomationOverlay = async () => {
  try {
    const response = (await Browser.runtime.sendMessage({
      action: ACTIONS.getAutomationOverlayStatus,
    })) as { status?: string } | undefined;
    if (response?.status === "enabled") enableAutomationOverlay();
    else disableAutomationOverlay();
  } catch {
    disableAutomationOverlay();
  }
};

export const showAutomationOverlay = () => {
  enableAutomationOverlay();
  return Promise.resolve({ status: "success", value: "Automation overlay enabled" });
};

export const hideAutomationOverlay = () => {
  disableAutomationOverlay();
  return Promise.resolve({ status: "success", value: "Automation overlay disabled" });
};
