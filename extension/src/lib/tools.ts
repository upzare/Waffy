import { isInaccessiblePage } from "@/helper";

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
};

const _click = async ({ x, y, tabId }: { x: number; y: number; tabId: number }) => {
  chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", {
    type: "mousePressed",
    x,
    y,
    button: "left",
    clickCount: 1,
  });
  await sleep(50);
  chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x,
    y,
    button: "left",
    clickCount: 1,
  });
};

export const updateOpenedTabs = () => {
  return new Promise<void>((resolve) => {
    chrome.tabs.query({}, (tabs) => {
      if (chrome.runtime.lastError) {
        resolve();
        return;
      }
      chrome.runtime.sendMessage({ action: "SET_OPENED_TABS", tabs }, () => {
        resolve();
      });
    });
  });
};

export const fetchScreen = async () => {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: "GET_TAB" }, async (tab) => {
      if (!tab || !tab.id) {
        reject("Tab not found");
        return;
      }
      if (isInaccessiblePage(tab.url)) {
        reject(
          `Cannot capture screen on "${tab.url}". Browser internal pages cannot be accessed or automated.`
        );
        return;
      }
      const devicePixelRatio = await chrome.tabs
        .sendMessage(tab.id, { type: "GET_DEVICE_PIXEL_RATIO" })
        .then((res) => res.value)
        .catch((err) => window.devicePixelRatio);
      const meta = {
        url: tab.url,
        title: tab.title,
        pixelRatio: devicePixelRatio,
        loading_status: tab.status,
      };
      chrome.debugger.sendCommand(
        { tabId: tab.id },
        "Page.captureScreenshot",
        { format: "jpeg", quality: 10, fromSurface: true },
        (response?: { data?: string }) => {
          if (chrome.runtime.lastError) {
            reject(
              `Failed to capture screen. The page may be restricted or the debugger is not attached.`
            );
            return;
          }
          const base64Image = response?.data;
          resolve({ meta, base64Image });
        }
      );
    });
  })
    .then((data) => {
      const { meta, base64Image } = data as { meta: Record<string, string>; base64Image: string };
      return {
        status: "success",
        message: "Success: Screen fetched",
        data: { type: "screenshot", metadata: meta, image: base64Image },
      };
    })
    .catch((error) => {
      return { status: "error", message: "Error: " + error };
    });
};

const findNewTabFromClick = async (sourceTabId: number, tabIdsBefore: Set<number | undefined>) => {
  const tabsAfter = await new Promise<chrome.tabs.Tab[]>((resolve) =>
    chrome.tabs.query({}, resolve)
  );
  const newTabs = tabsAfter.filter((t) => t.id && !tabIdsBefore.has(t.id));
  if (newTabs.length === 1) return newTabs[0];
  return newTabs.find((t) => t.openerTabId === sourceTabId);
};

export const click = async ({ x, y }: { x: number; y: number }) => {
  console.log("CLICK: ", x, y);
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: "GET_TAB" }, async (tab) => {
      if (!tab || !tab.id) {
        reject("Tab not found");
        return;
      }
      const sourceTabId = tab.id;
      const tabsBefore = await new Promise<chrome.tabs.Tab[]>((resolve) =>
        chrome.tabs.query({}, resolve)
      );
      const tabIdsBefore = new Set(tabsBefore.map((t) => t.id));

      chrome.tabs.sendMessage(tab.id, {
        type: "INTERACT_DOM",
        name: "DISPLAY_POINTER",
        args: { x, y },
      });
      await _click({ x, y, tabId: tab.id });

      await sleep(500);
      const newTab = await findNewTabFromClick(sourceTabId, tabIdsBefore);

      if (newTab?.id) {
        await updateOpenedTabs();
        await chrome.runtime.sendMessage({ action: "SET_TAB", tabId: newTab.id });
        chrome.tabs.update(newTab.id, { active: true });
        resolve(
          `Click initiated. A new tab was opened (Tab ID: ${newTab.id}). Switched to the new tab.`
        );
      } else if (chrome.runtime.lastError) {
        reject("Failed to click on coordinates");
      } else {
        resolve("Click initiated");
      }
    });
  })
    .then((res) => {
      return { status: "success", message: "Success: " + res };
    })
    .catch((error) => {
      return { status: "error", message: "Error: " + error };
    });
};

export const keyPress = async ({ key }: { key: KEY_TYPES }) => {
  console.log("KEYPRESS: ", key);
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: "GET_TAB" }, async (tab) => {
      if (!tab || !tab.id) {
        reject("Tab not found");
        return;
      }
      await chrome.debugger.sendCommand({ tabId: tab.id }, "Input.dispatchKeyEvent", {
        type: "keyDown",
        windowsVirtualKeyCode: KEY_CODES[key],
        key: key,
        code: key,
        text: "\r",
      });
      sleep(50);
      await chrome.debugger.sendCommand({ tabId: tab.id }, "Input.dispatchKeyEvent", {
        type: "keyUp",
        windowsVirtualKeyCode: KEY_CODES[key],
        key: key,
        code: key,
        text: "\r",
      });
      if (chrome.runtime.lastError) {
        reject("Failed to press key");
      } else {
        resolve("Key pressed");
      }
    });
  })
    .then((res) => {
      return { status: "success", message: "Success: " + res };
    })
    .catch((error) => {
      return { status: "error", message: "Error: " + error };
    });
};

export const typeText = async ({ x, y, text }: { x: number; y: number; text: string }) => {
  console.log("TYPETEXT: ", x, y, text);
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: "GET_TAB" }, async (tab) => {
      if (!tab || !tab.id) {
        reject("Tab not found");
        return;
      }
      chrome.tabs.sendMessage(tab.id, {
        type: "INTERACT_DOM",
        name: "DISPLAY_POINTER",
        args: { x, y, timeout: text.length * 150 + 500 },
      });
      await _click({ x, y, tabId: tab.id });
      await sleep(100);
      for await (const char of text) {
        if (char === "\n") {
          keyPress({ key: "Enter" });
          continue;
        }
        await chrome.debugger.sendCommand({ tabId: tab.id }, "Input.dispatchKeyEvent", {
          type: "keyDown",
          text: char,
        });
        await sleep(25);
        await chrome.debugger.sendCommand({ tabId: tab.id }, "Input.dispatchKeyEvent", {
          type: "keyUp",
          text: char,
        });
        await sleep(10);
      }
      if (chrome.runtime.lastError) {
        reject("Failed to send keystrokes");
      } else {
        resolve("Text typed successfully");
      }
    });
  })
    .then((res) => {
      return { status: "success", message: "Success: " + res };
    })
    .catch((error) => {
      return { status: "error", message: "Error: " + error };
    });
};

export const clearValue = async ({ x, y }: { x: number; y: number }) => {
  console.log("CLEARVALUE: ", x, y);
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: "GET_TAB" }, async (tab) => {
      if (!tab || !tab.id) {
        reject("Tab not found");
        return;
      }
      chrome.tabs.sendMessage(tab.id, {
        type: "INTERACT_DOM",
        name: "DISPLAY_POINTER",
        args: { x, y },
      });
      await _click({ x, y, tabId: tab.id });
      await sleep(100);
      await chrome.debugger.sendCommand({ tabId: tab.id }, "Input.dispatchKeyEvent", {
        type: "char",
        commands: ["SelectAll"],
      });
      await sleep(100);
      await chrome.debugger.sendCommand({ tabId: tab.id }, "Input.dispatchKeyEvent", {
        type: "keyDown",
        key: "Backspace",
        code: "Backspace",
        windowsVirtualKeyCode: 8,
      });
      await sleep(50);
      await chrome.debugger.sendCommand({ tabId: tab.id }, "Input.dispatchKeyEvent", {
        type: "keyUp",
        key: "Backspace",
        code: "Backspace",
        windowsVirtualKeyCode: 8,
      });
      if (chrome.runtime.lastError) {
        reject("Failed to clear value");
      } else {
        resolve("Value cleared successfully");
      }
    });
  })
    .then((res) => {
      return { status: "success", message: "Success: " + res };
    })
    .catch((error) => {
      return { status: "error", message: "Error: " + error };
    });
};

export const getOption = async ({ x, y }: { x: number; y: number }) => {
  console.log("GETOPTION: ", x, y);
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: "GET_TAB" }, async (tab) => {
      if (!tab || !tab.id) {
        reject("Tab not found");
        return;
      }
      chrome.tabs.sendMessage(tab.id, {
        type: "INTERACT_DOM",
        name: "DISPLAY_POINTER",
        args: { x, y },
      });
      await _click({ x, y, tabId: tab.id });
      await chrome.tabs
        .sendMessage(tab.id, { type: "INTERACT_DOM", name: "GET_OPTION", args: {} })
        .then((res) => {
          if (res.status === "success") resolve(res.value);
          else reject(res.value);
        })
        .catch((error) => {
          reject(error.value);
        });
    });
  })
    .then((res) => {
      return { status: "success", message: "Success: " + res };
    })
    .catch((error) => {
      return { status: "error", message: "Error: " + error };
    });
};

export const setOption = async ({ x, y, value }: { x: number; y: number; value: string }) => {
  console.log("SETOPTION: ", x, y, value);
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: "GET_TAB" }, async (tab) => {
      if (!tab || !tab.id) {
        reject("Tab not found");
        return;
      }
      chrome.tabs.sendMessage(tab.id, {
        type: "INTERACT_DOM",
        name: "DISPLAY_POINTER",
        args: { x, y },
      });
      await _click({ x, y, tabId: tab.id });
      await chrome.tabs
        .sendMessage(tab.id, { type: "INTERACT_DOM", name: "SET_OPTION", args: { value } })
        .then((res) => {
          if (res.status === "success") resolve(res.value);
          else reject(res.value);
        })
        .catch((error) => {
          reject(error.value);
        });
    });
  })
    .then((res) => {
      return { status: "success", message: "Success: " + res };
    })
    .catch((error) => {
      return { status: "error", message: "Error: " + error };
    });
};

export const scroll = async ({
  x,
  y,
  xDistance,
  yDistance,
}: {
  x: number;
  y: number;
  xDistance: number;
  yDistance: number;
}) => {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: "GET_TAB" }, async (tab) => {
      if (!tab || !tab.id) {
        reject("Tab not found");
        return;
      }
      chrome.tabs.sendMessage(tab.id, {
        type: "INTERACT_DOM",
        name: "DISPLAY_POINTER",
        args: { x, y },
      });
      await chrome.debugger.sendCommand({ tabId: tab.id }, "Input.synthesizeScrollGesture", {
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
  })
    .then((res) => {
      return { status: "success", message: "Success: " + res };
    })
    .catch((error) => {
      return { status: "error", message: "Error: " + error };
    });
};

export const loadingState = async () => {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: "GET_TAB" }, async (tab) => {
      if (!tab || !tab.id) {
        reject("Tab not found");
        return;
      }
      chrome.debugger.sendCommand(
        { tabId: tab.id },
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
  })
    .then((res) => {
      return { status: "success", message: "Success: " + res };
    })
    .catch((error) => {
      return { status: "error", message: "Error: " + error };
    });
};

export const goto = async ({ url }: { url: string }) => {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: "GET_TAB" }, async (tab) => {
      if (!tab || !tab.id) {
        reject("Tab not found");
        return;
      }
      chrome.tabs.update(tab.id, { url: url }, (updatedTab) => {
        if (chrome.runtime.lastError) {
          reject("Failed to navigating to URL");
        } else {
          resolve("Navigated to URL successfully");
        }
      });
    });
  })
    .then((res) => {
      return { status: "success", message: "Success: " + res };
    })
    .catch((error) => {
      return { status: "error", message: "Error: " + error };
    });
};

export const getOpenedTabs = async () => {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({}, async (tabs) => {
      if (chrome.runtime.lastError) {
        reject("Failed to get the open tabs");
        return;
      }
      await chrome.runtime.sendMessage({ action: "SET_OPENED_TABS", tabs });
      const result = tabs.map((tab) => ({
        id: tab.id,
        title: tab.title,
        url: tab.url,
        active: tab.active,
      }));
      resolve(result);
    });
  })
    .then((tabs) => {
      return { status: "success", message: JSON.stringify(tabs) };
    })
    .catch((error) => {
      return { status: "error", message: "Error: " + error };
    });
};

export const openTab = async ({ url }: { url: string }) => {
  return new Promise((resolve, reject) => {
    chrome.tabs.create({ url: url }, async (tab) => {
      await updateOpenedTabs();
      await chrome.runtime.sendMessage({ action: "SET_TAB", tabId: tab?.id });
      if (chrome.runtime.lastError) {
        reject("Failed to open the URL");
      } else {
        resolve("URL opened in new tab successfully");
      }
    });
  })
    .then((res) => {
      return { status: "success", message: "Success: " + res };
    })
    .catch((error) => {
      return { status: "error", message: "Error: " + error };
    });
};

export const switchTab = async ({ tabId }: { tabId: number }) => {
  return new Promise((resolve, reject) => {
    chrome.tabs.update(tabId, { active: true }, async (tab) => {
      await updateOpenedTabs();
      await chrome.runtime.sendMessage({ action: "SET_TAB", tabId: tab?.id });
      if (chrome.runtime.lastError) {
        reject("Failed to switch tab");
      } else {
        resolve("Tab switched successfully");
      }
    });
  })
    .then((res) => {
      return { status: "success", message: "Success: " + res };
    })
    .catch((error) => {
      return { status: "error", message: "Error: " + error };
    });
};

export const closeTab = async ({ tabId }: { tabId: number }) => {
  return new Promise((resolve, reject) => {
    chrome.tabs.remove(tabId, () => {
      if (chrome.runtime.lastError) {
        reject("Failed to close the tab");
      } else {
        resolve("Tab closed successfully");
      }
    });
  })
    .then((res) => {
      return { status: "success", message: "Success: " + res };
    })
    .catch((error) => {
      return { status: "error", message: "Error: " + error };
    });
};

export const reload = async () => {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: "GET_TAB" }, async (tab) => {
      if (!tab || !tab.id) {
        reject("Tab not found");
        return;
      }
      chrome.tabs.reload(tab.id, () => {
        if (chrome.runtime.lastError) {
          reject("Failed to reload the page");
        } else {
          resolve("Reloaded the page successfully");
        }
      });
    });
  })
    .then((res) => {
      return { status: "success", message: "Success: " + res };
    })
    .catch((error) => {
      return { status: "error", message: "Error: " + error };
    });
};

export const wait = async ({ ms }: { ms: number }) => {
  return new Promise((resolve) => {
    setTimeout(() => resolve(`Waited for ${ms} milliseconds`), ms);
  })
    .then((res) => {
      return { status: "success", message: "Success: " + res };
    })
    .catch((error) => {
      return { status: "error", message: "Error: " + error };
    });
};

export const availableFunctions: { [key: string]: (args: any) => Promise<any> } = {
  fetchScreen: fetchScreen,
  click: click,
  typeText: typeText,
  clearValue: clearValue,
  keyPress: keyPress,
  getOption: getOption,
  setOption: setOption,
  scroll: scroll,
  loadingState: loadingState,
  goto: goto,
  getOpenedTabs: getOpenedTabs,
  openTab: openTab,
  switchTab: switchTab,
  closeTab: closeTab,
  reload: reload,
  wait: wait,
};
