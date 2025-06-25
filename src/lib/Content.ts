import { DomMessage } from '../types';

let tabId: number;
chrome.runtime.sendMessage({ action: 'GET_TAB_ID' }, (response) => {
    tabId = response.tabId;
    console.log("TAB ID: ", tabId);
});

function scroll(direction: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const initialX = window.scrollX;
        const initialY = window.scrollY;

        const onScroll = () => {
            if (window.scrollX !== initialX || window.scrollY !== initialY) {
                window.removeEventListener("scroll", onScroll);
                let outputMessage = "";
                if (direction === "up" || direction === "down") {
                    // if (y != 0) {
                    const scrollTop = window.scrollY;
                    const maxScrollTop = document.documentElement.scrollHeight - window.innerHeight;
                    const percentage = maxScrollTop > 0 ? Math.min(100, Math.round((scrollTop / maxScrollTop) * 100)) : 100;
                    outputMessage = `Scrollbar at ${percentage}% on the y-axis`;
                }
                if (direction === "left" || direction === "right") {
                    // if (x != 0) {
                    const scrollLeft = window.scrollX;
                    const maxScrollLeft = document.documentElement.scrollWidth - window.innerWidth;
                    const percentage = maxScrollLeft > 0 ? Math.min(100, Math.round((scrollLeft / maxScrollLeft) * 100)) : 100;
                    outputMessage = `Scrollbar at ${percentage}% on the x-axis`;
                }
                resolve(outputMessage);
            }
        };

        window.addEventListener("scroll", onScroll);
        let targetX = window.scrollX;
        let targetY = window.scrollY;
        switch (direction) {
            case "up":
                targetY = Math.max(0, window.scrollY - window.innerHeight);
                break;
            case "down":
                targetY = window.scrollY + window.innerHeight;
                break;
            case "left":
                targetX = Math.max(0, window.scrollX - window.innerWidth);
                break;
            case "right":
                targetX = window.scrollX + window.innerWidth;
                break;
        }
        window.scrollTo(targetX, targetY);
        setTimeout(() => {
            window.removeEventListener("scroll", onScroll);
            reject("No scrollbar movement happened");
        }, 500);
    });
}

function checkScrollbar() {
    const hasVerticalScroll = document.documentElement.scrollHeight > window.innerHeight;
    const hasHorizontalScroll = document.documentElement.scrollWidth > window.innerWidth;
    let scrollPosition = "";
    if (!hasVerticalScroll && !hasHorizontalScroll) {
        scrollPosition = "This page does not have any scrollbars";
    }
    else if (!hasVerticalScroll) {
        scrollPosition = "This page does not have a vertical scrollbar. " +
            `Horizontal scrollbar is at ${window.scrollX}px on the x-axis.`;
    }
    else if (!hasHorizontalScroll) {
        scrollPosition = "This page does not have a horizontal scrollbar. " +
            `Vertical scrollbar is at ${window.scrollY}px on the y-axis.`;
    }
    else {
        scrollPosition = `Scrollbar at ${window.scrollX}px on the x-axis and ${window.scrollY}px on the y-axis`;
    }
    return scrollPosition;
}

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
            case "SCROLL": {
                const direction = args.direction;
                // const x = args.x;
                // const y = args.y;
                (async () => {
                    await scroll(direction).then(res => {
                        sendResponse({ status: "success", value: res });
                    }).catch(err => {
                        sendResponse({ status: "error", value: err });
                    });
                })();
                break;
            }
            case "CHECK_SCROLLBAR": {
                const scrollPosition = checkScrollbar();
                sendResponse({ status: "success", value: scrollPosition });
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
