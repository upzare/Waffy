const KEY_CODES = {
    Enter: 13,
    Backspace: 8,
    Delete: 46,
    Tab: 9,
    Escape: 27,
    Space: 32,
    ArrowUp: 38,
    ArrowDown: 40,
    ArrowLeft: 37,
    ArrowRight: 39,
    PageUp: 33,
    PageDown: 34,
};

type KEY_TYPES = keyof typeof KEY_CODES;

const sleep = async (ms: number) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

const _click = async ({ x, y, tabId }: { x: number, y: number, tabId: number }) => {
    chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", {
        type: 'mousePressed',
        x,
        y,
        button: 'left',
        clickCount: 1,
    });
    await sleep(50);
    chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", {
        type: 'mouseReleased',
        x,
        y,
        button: 'left',
        clickCount: 1,
    });
}

export const fetchScreen = async () => {
    return new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            if (!tabs || !tabs[0]?.id) {
                return;
            }
            const devicePixelRatio = await chrome.tabs.sendMessage(tabs[0].id, { type: "GET_DEVICE_PIXEL_RATIO" }).then(res => res.value).catch(err => window.devicePixelRatio);
            const meta = {
                url: tabs[0].url,
                title: tabs[0].title,
                pixelRatio: devicePixelRatio,
                loading_status: tabs[0].status
            }
            chrome.tabs.captureVisibleTab({ format: "png" }).then((dataUrl) => {
                const base64Image = dataUrl.split(',')[1];
                resolve({ meta, base64Image });
            }).catch((error) => {
                reject("Failed to capture DOM image");
            });
        });
    }).then((data) => {
        const { meta, base64Image } = data as { meta: Record<string, string>, base64Image: string };
        return { status: "success", message: "Success: Screen fetched", data: { type: "screenshot", metadata: meta, image: base64Image, parser: 1 } };
    }).catch((error) => {
        return { status: "error", message: "Error: " + error };
    });
}

export const click = async ({ x, y }: { x: number, y: number }) => {
    console.log("CLICK: ", x, y);
    return new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            if (!tabs || !tabs[0]?.id) {
                return;
            }
            chrome.tabs.sendMessage(tabs[0].id, { type: "INTERACT_DOM", name: "DISPLAY_POINTER", args: { x, y } })
            await _click({ x, y, tabId: tabs[0].id });
            if (chrome.runtime.lastError) {
                reject("Failed to click on coordinates");
            } else {
                resolve("Clicked on coordinates");
            }
        });
    }).then((res) => {
        return { status: "success", message: "Success: " + res };;
    }).catch((error) => {
        return { status: "error", message: "Error: " + error };
    });
}

export const keyPress = async ({ key }: { key: KEY_TYPES }) => {
    console.log("KEYPRESS: ", key);
    return new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            if (!tabs || !tabs[0]?.id) {
                return;
            }
            await chrome.debugger.sendCommand({ tabId: tabs[0].id }, 'Input.dispatchKeyEvent', {
                type: 'keyDown',
                windowsVirtualKeyCode: KEY_CODES[key],
                key: key,
                code: key,
                text: '\r',
            });
            sleep(50);
            await chrome.debugger.sendCommand({ tabId: tabs[0].id }, 'Input.dispatchKeyEvent', {
                type: 'keyUp',
                windowsVirtualKeyCode: KEY_CODES[key],
                key: key,
                code: key,
                text: '\r',
            });
            if (chrome.runtime.lastError) {
                reject("Failed to press key");
            } else {
                resolve("Key pressed");
            }
        });
    }).then((res) => {
        return { status: "success", message: "Success: " + res };;
    }).catch((error) => {
        return { status: "error", message: "Error: " + error };
    });
}

export const typeText = async ({ x, y, text }: { x: number, y: number, text: string }) => {
    console.log("TYPETEXT: ", x, y, text);
    return new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            if (!tabs || !tabs[0]?.id) {
                return;
            }
            chrome.tabs.sendMessage(tabs[0].id, { type: "INTERACT_DOM", name: "DISPLAY_POINTER", args: { x, y, timeout: text.length * 150 + 500 } })
            await _click({ x, y, tabId: tabs[0].id });
            await sleep(300);
            for await (const char of text) {
                if (char === '\n') {
                    keyPress({ key: "Enter" });
                    continue;
                }
                await chrome.debugger.sendCommand({ tabId: tabs[0].id }, 'Input.dispatchKeyEvent', {
                    type: 'keyDown',
                    text: char,
                });
                await sleep(50);
                await chrome.debugger.sendCommand({ tabId: tabs[0].id }, 'Input.dispatchKeyEvent', {
                    type: 'keyUp',
                    text: char,
                });
                await sleep(100);
            }
            if (chrome.runtime.lastError) {
                reject("Failed to send keystrokes");
            } else {
                resolve("Text typed successfully");
            }
        });
    }).then((res) => {
        return { status: "success", message: "Success: " + res };;
    }).catch((error) => {
        return { status: "error", message: "Error: " + error };
    });
}

export const clearValue = async ({ x, y }: { x: number, y: number }) => {
    console.log("CLEARVALUE: ", x, y);
    return new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            if (!tabs || !tabs[0]?.id) {
                return;
            }
            chrome.tabs.sendMessage(tabs[0].id, { type: "INTERACT_DOM", name: "DISPLAY_POINTER", args: { x, y } });
            await _click({ x, y, tabId: tabs[0].id });
            await sleep(100);
            await chrome.debugger.sendCommand({ tabId: tabs[0].id }, 'Input.dispatchKeyEvent', {
                type: 'char',
                commands: ["SelectAll"]
            });
            await sleep(100);
            await chrome.debugger.sendCommand({ tabId: tabs[0].id }, 'Input.dispatchKeyEvent', {
                type: 'keyDown',
                key: 'Backspace',
                code: 'Backspace',
                windowsVirtualKeyCode: 8,
            });
            await sleep(50);
            await chrome.debugger.sendCommand({ tabId: tabs[0].id }, 'Input.dispatchKeyEvent', {
                type: 'keyUp',
                key: 'Backspace',
                code: 'Backspace',
                windowsVirtualKeyCode: 8,
            });
            if (chrome.runtime.lastError) {
                reject("Failed to clear value");
            } else {
                resolve("Value cleared successfully");
            }
        });
    }).then((res) => {
        return { status: "success", message: "Success: " + res };
    }).catch((error) => {
        return { status: "error", message: "Error: " + error };
    });
}

export const getOption = async ({ x, y }: { x: number, y: number }) => {
    console.log("GETOPTION: ", x, y);
    return new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            if (!tabs || !tabs[0]?.id) {
                return;
            }
            chrome.tabs.sendMessage(tabs[0].id, { type: "INTERACT_DOM", name: "DISPLAY_POINTER", args: { x, y } })
            await _click({ x, y, tabId: tabs[0].id });
            await chrome.tabs.sendMessage(tabs[0].id, { type: "INTERACT_DOM", name: "GET_OPTION", args: {} })
                .then((res) => {
                    if (res.status === "success")
                        resolve(res.value);
                    else
                        reject(res.value);
                })
                .catch((error) => {
                    reject(error.value);
                });
        });
    }).then((res) => {
        return { status: "success", message: "Success: " + res };;
    }).catch((error) => {
        return { status: "error", message: "Error: " + error };
    });
}

export const setOption = async ({ x, y, value }: { x: number, y: number, value: string }) => {
    console.log("SETOPTION: ", x, y, value);
    return new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            if (!tabs || !tabs[0]?.id) {
                return;
            }
            chrome.tabs.sendMessage(tabs[0].id, { type: "INTERACT_DOM", name: "DISPLAY_POINTER", args: { x, y } })
            await _click({ x, y, tabId: tabs[0].id });
            await chrome.tabs.sendMessage(tabs[0].id, { type: "INTERACT_DOM", name: "SET_OPTION", args: { value } })
                .then((res) => {
                    if (res.status === "success")
                        resolve(res.value);
                    else
                        reject(res.value);
                })
                .catch((error) => {
                    reject(error.value);
                });
        });
    }).then((res) => {
        return { status: "success", message: "Success: " + res };;
    }).catch((error) => {
        return { status: "error", message: "Error: " + error };
    });
}

export const loadingState = async () => {
    return new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs || !tabs[0]?.id) {
                return;
            }
            chrome.debugger.sendCommand(
                { tabId: tabs[0].id },
                "Runtime.evaluate",
                { expression: "document.readyState" },
                (result?: { result?: { value: string } }) => {
                    if (chrome.runtime.lastError) {
                        reject("Failed to get the state of the page");
                    } else {
                        const readyState = result?.result?.value;
                        if (readyState === "complete") {
                            resolve("Page is fully loaded");
                        } else {
                            resolve("Page is under loading");
                        }
                    }
                }

            );
        });
    }).then((res) => {
        return { status: "success", message: "Success: " + res };;
    }).catch((error) => {
        return { status: "error", message: "Error: " + error };
    });
}

export const goto = async ({ url }: { url: string }) => {
    return new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            if (!tabs || !tabs[0]?.id) {
                return;
            }
            chrome.tabs.update(tabs[0].id, { url: url }, (updatedTab) => {
                if (chrome.runtime.lastError) {
                    reject("Failed to navigating to URL");
                } else {
                    resolve("Navigated to URL successfully");
                }
            });
        });
    }).then((res) => {
        return { status: "success", message: "Success: " + res };;
    }).catch((error) => {
        return { status: "error", message: "Error: " + error };
    });
}

export const open = async ({ url }: { url: string }) => {
    return new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs || !tabs[0]?.id) {
                return;
            }
            chrome.tabs.create({ url: url }, (tab) => {
                if (chrome.runtime.lastError) {
                    reject("Failed to open the URL");
                } else {
                    resolve("URL opened in new tab successfully");
                }
            });
        });
    }).then((res) => {
        return { status: "success", message: "Success: " + res };;
    }).catch((error) => {
        return { status: "error", message: "Error: " + error };
    });
}

export const close = async () => {
    return new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs || !tabs[0]?.id) {
                return;
            }
            chrome.tabs.remove(tabs[0].id, () => {
                if (chrome.runtime.lastError) {
                    reject("Failed to close the page");
                } else {
                    resolve("Page closed successfully");
                }
            });
        });
    }).then((res) => {
        return { status: "success", message: "Success: " + res };;
    }).catch((error) => {
        return { status: "error", message: "Error: " + error };
    });
}

export const reload = async () => {
    return new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs || !tabs[0]?.id) {
                return;
            }
            chrome.tabs.reload(tabs[0].id, () => {
                if (chrome.runtime.lastError) {
                    reject("Failed to reload the page");
                } else {
                    resolve("Reloaded the page successfully");
                }
            });
        });
    }).then((res) => {
        return { status: "success", message: "Success: " + res };;
    }).catch((error) => {
        return { status: "error", message: "Error: " + error };
    });
}

export const getScrollPortions = async () => {
    return new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            if (!tabs || !tabs[0]?.id) {
                return;
            }
            const devicePixelRatio = await chrome.tabs.sendMessage(tabs[0].id, { type: "GET_DEVICE_PIXEL_RATIO" }).then(res => res.value).catch(err => window.devicePixelRatio);
            const meta = {
                url: tabs[0].url,
                title: tabs[0].title,
                pixelRatio: devicePixelRatio,
                loading_status: tabs[0].status
            }
            chrome.tabs.captureVisibleTab({ format: "png" }).then((dataUrl) => {
                const base64Image = dataUrl.split(',')[1];
                resolve({ meta, base64Image });
            }).catch((error) => {
                reject("Failed to capture DOM image");
            });
        });
    }).then((data) => {
        const { meta, base64Image } = data as { meta: Record<string, string>, base64Image: string };
        return { status: "success", message: "Success: Scroll portions fetched", data: { type: "screenshot", metadata: meta, image: base64Image, parser: 2 } };
    }).catch((error) => {
        return { status: "error", message: "Error: " + error };
    });
}

export const scroll = async ({ x, y, xDistance, yDistance }: { x: number, y: number, xDistance: number, yDistance: number }) => {
    return new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            if (!tabs || !tabs[0]?.id) {
                return;
            }
            chrome.tabs.sendMessage(tabs[0].id, { type: "INTERACT_DOM", name: "DISPLAY_POINTER", args: { x, y } })
            await chrome.debugger.sendCommand({ tabId: tabs[0].id }, 'Input.synthesizeScrollGesture', {
                x,
                y,
                xDistance: -xDistance,
                yDistance: -yDistance,
            });
            if (chrome.runtime.lastError) {
                reject("Failed to scroll");
            } else {
                resolve("Scroll initiated");
            }
        });
    }).then((res) => {
        return { status: "success", message: "Success: " + res };;
    }).catch((error) => {
        return { status: "error", message: "Error: " + error };
    });
}

export const wait = async ({ ms }: { ms: number }) => {
    return new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            if (!tabs || !tabs[0]?.id) {
                return;
            }
            await new Promise(r => setTimeout(r, ms));
            resolve(`Waited for ${ms} milliseconds`);
        });
    }).then((res) => {
        return { status: "success", message: "Success: " + res };;
    }).catch((error) => {
        return { status: "error", message: "Error: " + error };
    });
}

export const availableFunctions: { [key: string]: (args: any) => Promise<any> } = {
    "fetchScreen": fetchScreen,
    "click": click,
    "typeText": typeText,
    "clearValue": clearValue,
    "keyPress": keyPress,
    "getOption": getOption,
    "setOption": setOption,
    "loadingState": loadingState,
    "goto": goto,
    "open": open,
    "close": close,
    "reload": reload,
    "getScrollPortions": getScrollPortions,
    "scroll": scroll,
    "wait": wait,
};