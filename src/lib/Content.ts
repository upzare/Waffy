import type { DomMessage } from '../types';

async function initOverlay() {
    if (document.querySelector('.waffy-overlay')) {
        return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'waffy-overlay';
    const style = document.createElement('style');
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
    overlay.style.display = 'none';

    document.head.appendChild(style);
    document.body.appendChild(overlay);
}

function enableOverlay() {
    const overlay = document.querySelector('.waffy-overlay') as HTMLElement | null;
    if (overlay) {
        overlay.style.display = 'block';
    }
}

function disableOverlay() {
    const overlay = document.querySelector('.waffy-overlay') as HTMLElement | null;
    if (overlay) {
        overlay.style.display = 'none';
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch ((message as DomMessage).type) {
        case "GET_DEVICE_PIXEL_RATIO": {
            const ratio = window.devicePixelRatio;
            sendResponse({ status: "success", value: ratio });
            break;
        }
        case "INTERACT_DOM": {
            const name = message.name;
            const args = message.args;
            switch (name) {
                case "GET_OPTION": {
                    const element = document.activeElement as HTMLSelectElement;
                    if (element && element.tagName.toLowerCase() === "select") {
                        const options = Array.from(element.options).map(option => option.value);
                        const message = "Available options -> " + options.join(", ");
                        sendResponse({ status: "success", value: message });
                    } else {
                        sendResponse({ status: "error", value: "Element is not a select element" });
                    }
                    break;
                }
                case "SET_OPTION": {
                    const element = document.activeElement as HTMLSelectElement;
                    if (element && element.tagName.toLowerCase() === "select") {
                        const value = args.value;
                        const options = Array.from(element.options).map(option => option.value);
                        if (options.includes(value)) {
                            element.value = value;
                            sendResponse({ status: "success", value: "Value set successfully" });
                        } else {
                            sendResponse({ status: "error", value: "Value not found" });
                        }
                    } else {
                        sendResponse({ status: "error", value: "Element is not a select element" });
                    }
                    break;
                }
                case "DISPLAY_POINTER": {
                    (async () => {
                        const { x, y, timeout } = args;
                        const pointer = document.createElement("img");
                        pointer.id = "waffy-pointer";
                        pointer.src = chrome.runtime.getURL("shared/cursor.png");
                        pointer.style.position = "fixed";
                        pointer.style.left = `${x}px`;
                        pointer.style.top = `${y}px`;
                        pointer.style.width = "32px";
                        pointer.style.height = "32px";
                        pointer.style.zIndex = "999999";
                        pointer.style.pointerEvents = "none";
                        document.body.appendChild(pointer);
                        await new Promise(resolve => setTimeout(resolve, timeout || 1500));
                        pointer.remove();
                        sendResponse({ status: "success", value: "Pointer displayed" });
                    })();
                    break;
                }
                case "SHOW_OVERLAY": {
                    enableOverlay();
                    sendResponse({ status: "success", value: "Overlay Enabled" });
                    break;
                }
                case "HIDE_OVERLAY": {
                    disableOverlay();
                    sendResponse({ status: "success", value: "Overlay Disabled" });
                    break;
                }
                default:
                    sendResponse({ status: "error", value: "Invalid function name" });
                    break;
            }
            break;
        }
    }
    return true;
});

initOverlay().then(() => {
    chrome.runtime.sendMessage({ action: "GET_OVERLAY_STATUS" }, (response) => {
        if (response.status === "enabled") {
            enableOverlay();
        } else {
            disableOverlay();
        }
    });
});