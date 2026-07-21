import Browser from "webextension-polyfill";
import type { DomMessage } from "../types";

async function initOverlay() {
  if (document.querySelector(".waffy-overlay")) {
    return;
  }

  const overlay = document.createElement("div");
  overlay.className = "waffy-overlay";
  const style = document.createElement("style");
  style.textContent = `
        .waffy-overlay {
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
            animation: waffyOverlayAnim 4s ease-in-out infinite;
        }
        
        @keyframes waffyOverlayAnim {
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
  overlay.style.display = "none";

  document.head.appendChild(style);
  document.body.appendChild(overlay);
}

function enableOverlay() {
  const overlay = document.querySelector(".waffy-overlay") as HTMLElement | null;
  if (overlay) {
    overlay.style.display = "block";
  }
}

function disableOverlay() {
  const overlay = document.querySelector(".waffy-overlay") as HTMLElement | null;
  if (overlay) {
    overlay.style.display = "none";
  }
}

Browser.runtime.onMessage.addListener((message: any) => {
  const msg = message as DomMessage;
  switch (msg.type) {
    case "GET_DEVICE_PIXEL_RATIO": {
      const ratio = window.devicePixelRatio;
      return Promise.resolve({ status: "success", value: ratio });
    }
    case "GET_PAGE_CONTENT": {
      return Promise.resolve({
        status: "success",
        url: window.location.href,
        title: document.title,
        html: document.documentElement.outerHTML,
      });
    }
    case "INTERACT_DOM": {
      const name = msg.name;
      const args = msg.args ?? {};
      switch (name) {
        case "GET_OPTION": {
          const element = document.activeElement as HTMLSelectElement;
          if (element && element.tagName.toLowerCase() === "select") {
            const options = Array.from(element.options).map((option) => option.value);
            const optionsMessage = "Available options -> " + options.join(", ");
            return Promise.resolve({ status: "success", value: optionsMessage });
          }
          return Promise.resolve({ status: "error", value: "Element is not a select element" });
        }
        case "SET_OPTION": {
          const element = document.activeElement as HTMLSelectElement;
          if (element && element.tagName.toLowerCase() === "select") {
            const value = args.value;
            const options = Array.from(element.options).map((option) => option.value);
            if (options.includes(value)) {
              element.value = value;
              return Promise.resolve({ status: "success", value: "Value set successfully" });
            }
            return Promise.resolve({ status: "error", value: "Value not found" });
          }
          return Promise.resolve({ status: "error", value: "Element is not a select element" });
        }
        case "DISPLAY_POINTER": {
          return (async () => {
            const { x, y, timeout } = args;
            const pointer = document.createElement("img");
            pointer.id = "waffy-pointer";
            pointer.src = Browser.runtime.getURL("shared/cursor.png");
            pointer.style.position = "fixed";
            pointer.style.left = `${x}px`;
            pointer.style.top = `${y}px`;
            pointer.style.width = "32px";
            pointer.style.height = "32px";
            pointer.style.zIndex = "999999";
            pointer.style.pointerEvents = "none";
            document.body.appendChild(pointer);
            await new Promise((resolve) => setTimeout(resolve, timeout || 1500));
            pointer.remove();
            return { status: "success", value: "Pointer displayed" };
          })();
        }
        case "SHOW_OVERLAY": {
          enableOverlay();
          return Promise.resolve({ status: "success", value: "Overlay Enabled" });
        }
        case "HIDE_OVERLAY": {
          disableOverlay();
          return Promise.resolve({ status: "success", value: "Overlay Disabled" });
        }
        default:
          return Promise.resolve({ status: "error", value: "Invalid function name" });
      }
    }
  }
  return undefined;
});

initOverlay().then(async () => {
  try {
    const response = (await Browser.runtime.sendMessage({
      action: "GET_OVERLAY_STATUS",
    })) as { status?: string } | undefined;
    if (response?.status === "enabled") {
      enableOverlay();
    } else {
      disableOverlay();
    }
  } catch {
    disableOverlay();
  }
});
