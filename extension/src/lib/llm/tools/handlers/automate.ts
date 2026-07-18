import Browser from "webextension-polyfill";
import type { Tabs } from "webextension-polyfill";
import { isInaccessiblePage } from "@/helper";
import { AutomateToolResult } from "../automate";

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

const getSessionTab = async () => (await Browser.runtime.sendMessage({ action: "GET_TAB" })) as Tabs.Tab | undefined;

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

export const updateOpenedTabs = async () => {
  try {
    const tabs = await Browser.tabs.query({});
    await Browser.runtime.sendMessage({ action: "SET_OPENED_TABS", tabs });
  } catch {
    // ignore
  }
};

const fetchScreen = async (): Promise<AutomateToolResult> => {
  try {
    const tab = await getSessionTab();
    if (!tab || !tab.id) {
      return { status: "error", message: "Error: Tab not found" };
    }
    if (isInaccessiblePage(tab.url)) {
      return {
        status: "error",
        message:
          "Error: " +
          `Cannot capture screen on "${tab.url}". Browser internal pages cannot be accessed or automated.`,
      };
    }
    const devicePixelRatio = await Browser.tabs
      .sendMessage(tab.id, { type: "GET_DEVICE_PIXEL_RATIO" })
      .then((res) => (res as { value: number }).value)
      .catch(() => window.devicePixelRatio);
    const meta = {
      url: tab.url,
      title: tab.title,
      pixelRatio: devicePixelRatio,
      loading_status: tab.status,
    };
    const base64Image = await new Promise<string>((resolve, reject) => {
      chrome.debugger.sendCommand(
        { tabId: tab.id },
        "Page.captureScreenshot",
        { format: "jpeg", quality: 10, fromSurface: true },
        (response?: { data?: string }) => {
          if (chrome.runtime.lastError || !response?.data) {
            reject(
              new Error(
                "Failed to capture screen. The page may be restricted or the debugger is not attached."
              )
            );
            return;
          }
          resolve(response.data);
        }
      );
    });
    return {
      status: "success",
      message: "Success: Screen fetched",
      data: { type: "screenshot", metadata: meta, image: base64Image },
    };
  } catch (error) {
    return { status: "error", message: "Error: " + error };
  }
};

const findNewTabFromClick = async (sourceTabId: number, tabIdsBefore: Set<number | undefined>) => {
  const tabsAfter = await Browser.tabs.query({});
  const newTabs = tabsAfter.filter((t) => t.id && !tabIdsBefore.has(t.id));
  if (newTabs.length === 1) return newTabs[0];
  return newTabs.find((t) => t.openerTabId === sourceTabId);
};

const click = async ({ x, y }: { x: number; y: number }): Promise<AutomateToolResult> => {
  console.log("CLICK: ", x, y);
  try {
    const tab = await getSessionTab();
    if (!tab || !tab.id) {
      return { status: "error", message: "Error: Tab not found" };
    }
    const sourceTabId = tab.id;
    const tabsBefore = await Browser.tabs.query({});
    const tabIdsBefore = new Set(tabsBefore.map((t) => t.id));

    void Browser.tabs.sendMessage(tab.id, {
      type: "INTERACT_DOM",
      name: "DISPLAY_POINTER",
      args: { x, y },
    });
    await _click({ x, y, tabId: tab.id });

    await sleep(500);
    const newTab = await findNewTabFromClick(sourceTabId, tabIdsBefore);

    if (newTab?.id) {
      await updateOpenedTabs();
      await Browser.runtime.sendMessage({ action: "SET_TAB", tabId: newTab.id });
      await Browser.tabs.update(newTab.id, { active: true });
      return {
        status: "success",
        message: `Success: Click initiated. A new tab was opened (Tab ID: ${newTab.id}). Switched to the new tab.`,
      };
    }
    return { status: "success", message: "Success: Click initiated" };
  } catch (error) {
    return { status: "error", message: "Error: " + error };
  }
};

const keyPress = async ({ key }: { key: KEY_TYPES }): Promise<AutomateToolResult> => {
  console.log("KEYPRESS: ", key);
  try {
    const tab = await getSessionTab();
    if (!tab || !tab.id) {
      return { status: "error", message: "Error: Tab not found" };
    }
    await chrome.debugger.sendCommand({ tabId: tab.id }, "Input.dispatchKeyEvent", {
      type: "keyDown",
      windowsVirtualKeyCode: KEY_CODES[key],
      key: key,
      code: key,
      text: "\r",
    });
    await sleep(50);
    await chrome.debugger.sendCommand({ tabId: tab.id }, "Input.dispatchKeyEvent", {
      type: "keyUp",
      windowsVirtualKeyCode: KEY_CODES[key],
      key: key,
      code: key,
      text: "\r",
    });
    return { status: "success", message: "Success: Key pressed" };
  } catch (error) {
    return { status: "error", message: "Error: " + error };
  }
};

const typeText = async ({
  x,
  y,
  text,
}: {
  x: number;
  y: number;
  text: string;
}): Promise<AutomateToolResult> => {
  console.log("TYPETEXT: ", x, y, text);
  try {
    const tab = await getSessionTab();
    if (!tab || !tab.id) {
      return { status: "error", message: "Error: Tab not found" };
    }
    void Browser.tabs.sendMessage(tab.id, {
      type: "INTERACT_DOM",
      name: "DISPLAY_POINTER",
      args: { x, y, timeout: text.length * 150 + 500 },
    });
    await _click({ x, y, tabId: tab.id });
    await sleep(100);
    for await (const char of text) {
      if (char === "\n") {
        await keyPress({ key: "Enter" });
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
    return { status: "success", message: "Success: Text typed successfully" };
  } catch (error) {
    return { status: "error", message: "Error: " + error };
  }
};

const clearValue = async ({ x, y }: { x: number; y: number }): Promise<AutomateToolResult> => {
  console.log("CLEARVALUE: ", x, y);
  try {
    const tab = await getSessionTab();
    if (!tab || !tab.id) {
      return { status: "error", message: "Error: Tab not found" };
    }
    void Browser.tabs.sendMessage(tab.id, {
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
    return { status: "success", message: "Success: Value cleared successfully" };
  } catch (error) {
    return { status: "error", message: "Error: " + error };
  }
};

const getOption = async ({ x, y }: { x: number; y: number }): Promise<AutomateToolResult> => {
  console.log("GETOPTION: ", x, y);
  try {
    const tab = await getSessionTab();
    if (!tab || !tab.id) {
      return { status: "error", message: "Error: Tab not found" };
    }
    void Browser.tabs.sendMessage(tab.id, {
      type: "INTERACT_DOM",
      name: "DISPLAY_POINTER",
      args: { x, y },
    });
    await _click({ x, y, tabId: tab.id });
    const res = (await Browser.tabs.sendMessage(tab.id, {
      type: "INTERACT_DOM",
      name: "GET_OPTION",
      args: {},
    })) as { status: string; value: string };
    if (res.status === "success") {
      return { status: "success", message: "Success: " + res.value };
    }
    return { status: "error", message: "Error: " + res.value };
  } catch (error) {
    return { status: "error", message: "Error: " + error };
  }
};

const setOption = async ({
  x,
  y,
  value,
}: {
  x: number;
  y: number;
  value: string;
}): Promise<AutomateToolResult> => {
  console.log("SETOPTION: ", x, y, value);
  try {
    const tab = await getSessionTab();
    if (!tab || !tab.id) {
      return { status: "error", message: "Error: Tab not found" };
    }
    void Browser.tabs.sendMessage(tab.id, {
      type: "INTERACT_DOM",
      name: "DISPLAY_POINTER",
      args: { x, y },
    });
    await _click({ x, y, tabId: tab.id });
    const res = (await Browser.tabs.sendMessage(tab.id, {
      type: "INTERACT_DOM",
      name: "SET_OPTION",
      args: { value },
    })) as { status: string; value: string };
    if (res.status === "success") {
      return { status: "success", message: "Success: " + res.value };
    }
    return { status: "error", message: "Error: " + res.value };
  } catch (error) {
    return { status: "error", message: "Error: " + error };
  }
};

const scroll = async ({
  x,
  y,
  xDistance,
  yDistance,
}: {
  x: number;
  y: number;
  xDistance: number;
  yDistance: number;
}): Promise<AutomateToolResult> => {
  try {
    const tab = await getSessionTab();
    if (!tab || !tab.id) {
      return { status: "error", message: "Error: Tab not found" };
    }
    void Browser.tabs.sendMessage(tab.id, {
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
    return { status: "success", message: "Success: Scroll initiated" };
  } catch (error) {
    return { status: "error", message: "Error: " + error };
  }
};

const loadingState = async (): Promise<AutomateToolResult> => {
  try {
    const tab = await getSessionTab();
    if (!tab || !tab.id) {
      return { status: "error", message: "Error: Tab not found" };
    }
    const readyState = await new Promise<string>((resolve, reject) => {
      chrome.debugger.sendCommand(
        { tabId: tab.id },
        "Runtime.evaluate",
        { expression: "document.readyState" },
        (result?: { result?: { value: string } }) => {
          if (chrome.runtime.lastError) {
            reject(new Error("Failed to get the state of the page"));
          } else {
            resolve(result?.result?.value ?? "");
          }
        }
      );
    });
    if (readyState === "complete") {
      return { status: "success", message: "Success: Page is fully loaded" };
    }
    return { status: "success", message: "Success: Page is under loading" };
  } catch (error) {
    return { status: "error", message: "Error: " + error };
  }
};

const goto = async ({ url }: { url: string }): Promise<AutomateToolResult> => {
  try {
    const tab = await getSessionTab();
    if (!tab || !tab.id) {
      return { status: "error", message: "Error: Tab not found" };
    }
    await Browser.tabs.update(tab.id, { url });
    return { status: "success", message: "Success: Navigated to URL successfully" };
  } catch (error) {
    return { status: "error", message: "Error: " + error };
  }
};

const getOpenedTabs = async (): Promise<AutomateToolResult> => {
  try {
    const tabs = await Browser.tabs.query({});
    await Browser.runtime.sendMessage({ action: "SET_OPENED_TABS", tabs });
    const result = tabs.map((tab: Tabs.Tab) => ({
      id: tab.id,
      title: tab.title,
      url: tab.url,
      active: tab.active,
    }));
    return { status: "success", message: JSON.stringify(result) };
  } catch (error) {
    return { status: "error", message: "Error: " + error };
  }
};

const openTab = async ({ url }: { url: string }): Promise<AutomateToolResult> => {
  try {
    const tab = await Browser.tabs.create({ url });
    await updateOpenedTabs();
    await Browser.runtime.sendMessage({ action: "SET_TAB", tabId: tab?.id });
    return { status: "success", message: "Success: URL opened in new tab successfully" };
  } catch (error) {
    return { status: "error", message: "Error: " + error };
  }
};

const switchTab = async ({ tabId }: { tabId: number }): Promise<AutomateToolResult> => {
  try {
    const tab = await Browser.tabs.update(tabId, { active: true });
    await updateOpenedTabs();
    await Browser.runtime.sendMessage({ action: "SET_TAB", tabId: tab?.id });
    return { status: "success", message: "Success: Tab switched successfully" };
  } catch (error) {
    return { status: "error", message: "Error: " + error };
  }
};

const closeTab = async ({ tabId }: { tabId: number }): Promise<AutomateToolResult> => {
  try {
    await Browser.tabs.remove(tabId);
    return { status: "success", message: "Success: Tab closed successfully" };
  } catch (error) {
    return { status: "error", message: "Error: " + error };
  }
};

const reload = async (): Promise<AutomateToolResult> => {
  try {
    const tab = await getSessionTab();
    if (!tab || !tab.id) {
      return { status: "error", message: "Error: Tab not found" };
    }
    await Browser.tabs.reload(tab.id);
    return { status: "success", message: "Success: Reloaded the page successfully" };
  } catch (error) {
    return { status: "error", message: "Error: " + error };
  }
};

const wait = async ({ ms }: { ms: number }): Promise<AutomateToolResult> => {
  try {
    await sleep(ms);
    return { status: "success", message: `Success: Waited for ${ms} milliseconds` };
  } catch (error) {
    return { status: "error", message: "Error: " + error };
  }
};

export const availableFunctions: { [key: string]: (args: any) => Promise<AutomateToolResult> } = {
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
