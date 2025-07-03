import { DomMessage } from '../types';

let tabId: number;
chrome.runtime.sendMessage({ action: 'GET_TAB_ID' }, (response) => {
    tabId = response.tabId;
    console.log("TAB ID: ", tabId);
});

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
                case "CLEAR_VALUE": {
                    const element = document.activeElement as HTMLInputElement;
                    const inputTags = ["input", "select", "textarea"];
                    if (element && inputTags.includes(element.tagName.toLowerCase())) {
                        element.value = "";
                        sendResponse({ status: "success", value: "Value cleared successfully" });
                    } else if (element && element.isContentEditable) {
                        // @ts-ignore
                        element.innerHTML = window.trustedTypes.emptyHTML;
                    } else {
                        sendResponse({ status: "error", value: "Element is not an input element" });
                    }
                    break;
                }
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
                default:
                    sendResponse({ status: "error", value: "Invalid function name" });
                    break;
            }
            break;
        }
    }
    return true;
});

export { };
