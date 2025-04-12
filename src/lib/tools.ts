import jsPDF from 'jspdf';
import { marked } from 'marked';
import type { DomProps } from '../types';

export async function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function getDom(): Promise<DomProps[] | string> {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: "GET_DOM" }, (response) => {
            if (response) {
                resolve(response);
            } else {
                reject("Failed to get DOM data");
            }
        });
    });
}

export const fetchScreen = async () => {
    return new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs || !tabs[0]?.id) {
                return;
            }
            const currentUrl = tabs[0].url;
            chrome.tabs.captureVisibleTab({ format: "png" }).then((dataUrl) => {
                const base64String = dataUrl.split(',')[1];
                resolve({ currentUrl, base64String });
            }).catch((error) => {
                reject("Failed to capture DOM");
            });
        });
    }).then(async (data) => {
        const { currentUrl, base64String } = data as { currentUrl: string, base64String: string };
        const response = await fetch("http://localhost:8000/inference", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                image: base64String,
            }),
        });
        return { currentUrl, response };
    }).then(async (data) => {
        const { currentUrl, response } = data as { currentUrl: string, response: Response };
        const jsonResponse = await response.json();
        let domProps = [];
        for await (const res of jsonResponse.props) {
            domProps.push(res);
        }
        chrome.runtime.sendMessage({ action: "SET_DOM", props: domProps });
        return { status: "success", message: "Success: Dom fetched", data: { type: "dom", url: currentUrl, annotatedImage: jsonResponse.image_url, ocr_content: jsonResponse.ocr_response } };
    }).catch((error) => {
        return { status: "error", message: "Error: " + error };
    });
}

export const click = async ({ elementId, highlight = true }: { elementId: number, highlight?: boolean }) => {
    return new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            if (!tabs || !tabs[0]?.id) {
                return;
            }
            const annotatedDom: DomProps[] = (await getDom()) as DomProps[];
            console.log("ANNOTATED DOM: ", annotatedDom);
            if (typeof annotatedDom === "string") {
                reject(annotatedDom);
                return;
            }
            const target = annotatedDom.find(e => e.id === elementId.toString());
            console.log("TARGET: ", target);
            if (target) {
                const devicePixelRatio = window.devicePixelRatio;
                const x = target.x;
                const y = target.y;
                const click_cords_x = (x + target.width / 2) / devicePixelRatio;
                const click_cords_y = (y + target.height / 2) / devicePixelRatio;
                console.log("CLICK CORDS: ", click_cords_x, click_cords_y);
                chrome.debugger.sendCommand({ tabId: tabs[0].id }, "Input.dispatchMouseEvent", {
                    type: 'mousePressed',
                    x: click_cords_x,
                    y: click_cords_y,
                    button: 'left',
                    clickCount: 1,
                });
                sleep(50);
                if (highlight) chrome.tabs.sendMessage(tabs[0].id, { type: "INTERACT_DOM", name: "HIGHLIGHT_ELEMENT", args: {} });
                chrome.debugger.sendCommand({ tabId: tabs[0].id }, "Input.dispatchMouseEvent", {
                    type: 'mouseReleased',
                    x: click_cords_x,
                    y: click_cords_y,
                    button: 'left',
                    clickCount: 1,
                });
                if (chrome.runtime.lastError) {
                    reject("Failed to click on coordinates");
                } else {
                    resolve("Clicked on coordinates");
                }
            } else {
                reject("Element not found");
            }
        });
    }).then((res) => {
        return { status: "success", message: "Success: " + res };;
    }).catch((error) => {
        return { status: "error", message: "Error: " + error };
    });
}

export const enterKey = async () => {
    return new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            if (!tabs || !tabs[0]?.id) {
                return;
            }
            await chrome.debugger.sendCommand({ tabId: tabs[0]?.id }, 'Input.dispatchKeyEvent', {
                type: 'keyDown',
                windowsVirtualKeyCode: 13,
                key: 'Enter',
                code: 'Enter',
                text: '\r',
            });
            sleep(50);
            chrome.tabs.sendMessage(tabs[0].id, { type: "INTERACT_DOM", name: "HIGHLIGHT_ELEMENT", args: {} });
            await chrome.debugger.sendCommand({ tabId: tabs[0]?.id }, 'Input.dispatchKeyEvent', {
                type: 'keyUp',
                windowsVirtualKeyCode: 13,
                key: 'Enter',
                code: 'Enter',
                text: '\r',
            });
            if (chrome.runtime.lastError) {
                reject("Failed to press enter key");
            } else {
                resolve("Enter key pressed");
            }
        });
    }).then((res) => {
        return { status: "success", message: "Success: " + res };;
    }).catch((error) => {
        return { status: "error", message: "Error: " + error };
    });
}

export const typeText = async ({ elementId, text }: { elementId: number, text: string }) => {
    return new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            if (!tabs || !tabs[0]?.id) {
                return;
            }
            await click({ elementId, highlight: false });
            chrome.tabs.sendMessage(tabs[0].id, { type: "INTERACT_DOM", name: "HIGHLIGHT_ELEMENT", args: { timeout: text.length * 150 } });
            for await (const char of text) {
                if (char === '\n') {
                    enterKey();
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

export const getOption = async ({ elementId }: { elementId: number }) => {
    return new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            if (!tabs || !tabs[0]?.id) {
                return;
            }
            await click({ elementId });
            await chrome.tabs.sendMessage(tabs[0].id, { type: "INTERACT_DOM", name: "GET_OPTION", args: {} })
                .then((res) => {
                    resolve(res.value);
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

export const setOption = async ({ elementId, value }: { elementId: number, value: string }) => {
    return new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            if (!tabs || !tabs[0]?.id) {
                return;
            }
            await click({ elementId });
            await chrome.tabs.sendMessage(tabs[0].id, { type: "INTERACT_DOM", name: "SET_OPTION", args: { value } })
                .then((res) => {
                    resolve(res.value);
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
                        console.log("ready state: ", readyState);
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
            chrome.tabs.reload(tabs[0].id, undefined, () => {
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

export const scroll = async ({ direction }: { direction: string }) => {
    return new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            if (!tabs || !tabs[0]?.id) {
                return;
            }
            await chrome.tabs.sendMessage(tabs[0].id, { type: "INTERACT_DOM", name: "SCROLL", args: { direction } })
                .then((res) => {
                    resolve(res.value);
                })
                .catch((error) => {
                    reject(error);
                });
        });
    }).then((res) => {
        return { status: "success", message: "Success: " + res };;
    }).catch((error) => {
        return { status: "error", message: "Error: " + error };
    });
}

export const checkScrollbar = async () => {
    return new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs || !tabs[0]?.id) {
                return;
            }
            chrome.tabs.sendMessage(tabs[0].id, { type: "INTERACT_DOM", name: "CHECK_SCROLLBAR", args: {} })
                .then((res) => {
                    resolve(res.value);
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

export const pdf = ({ text }: { text: string }) => {
    return new Promise(async (resolve, reject) => {
        const content = await marked(text);
        const pdf = new jsPDF();
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(12);
        pdf.text(content.replace(/<[^>]+>/g, '').trim(), 10, 10);
        const pdfBlob = pdf.output("blob");
        const pdfFile = new File([pdfBlob], "generated.pdf", { type: "application/pdf" });
        resolve({ status: "success", message: "Success: PDF generated", data: { type: "pdf", file: pdfFile } });
    });
}

export const availableFunctions: { [key: string]: (args: any) => Promise<any> } = {
    "fetchScreen": fetchScreen,
    "click": click,
    "typeText": typeText,
    "enterKey": enterKey,
    "getOption": getOption,
    "setOption": setOption,
    "loadingState": loadingState,
    "goto": goto,
    "open": open,
    "close": close,
    "reload": reload,
    "checkScrollbar": checkScrollbar,
    "scroll": scroll,
    "wait": wait,
    "pdf": pdf,
};