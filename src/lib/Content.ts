import { DomMessage } from '../types';

let tabId: number;
chrome.runtime.sendMessage({ action: 'GET_TAB_ID' }, (response) => {
    tabId = response.tabId;
    console.log("TAB ID: ", tabId);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if ((message as DomMessage).type === 'INTERACT_DOM') {
        const name = message.name;
        const args = message.args;
        switch (name) {
            case "CLEAR_VALUE": {
                const element = document.activeElement as HTMLInputElement;
                const inputTags = ["input", "select", "textarea"];
                if (element && inputTags.includes(element.tagName.toLowerCase())) {
                    element.value = "";
                    sendResponse({ status: "success", value: "Value cleared successfully" });
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
            case "HIGHLIGHT_ELEMENT": {
                (async () => {
                    const element = document.activeElement as HTMLElement;
                    const originalOutline = element.style.outline;
                    const originalOutlineOffset = element.style.outlineOffset;
                    element.style.outline = '3px solid red';
                    element.style.outlineOffset = '-1px';
                    await new Promise(resolve => setTimeout(resolve, args.timeout || 1000));
                    element.style.outline = originalOutline;
                    element.style.outlineOffset = originalOutlineOffset;
                    sendResponse({ status: "success", value: "Element Highlighted" });
                })();
                break;
            }
            default:
                sendResponse({ status: "error", value: "Invalid function name" });
                break;
        }
    } else if ((message as DomMessage).type === 'GET_DEVICE_PIXEL_RATIO') {
        const ratio = window.devicePixelRatio;
        sendResponse({ status: "success", value: ratio });
    }
    return true;
});

export { };
