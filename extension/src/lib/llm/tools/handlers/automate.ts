import Browser from "webextension-polyfill";
import type { Tabs } from "webextension-polyfill";
import { ACTIONS, DOM_ACTIONS, isInaccessiblePage } from "@/lib/helper";
import { webFetch, webSearch, type BrowserToolResult, type ToolHandlers } from "./common";
import { toolError } from "@/lib/errors";
import { sleep } from "@/lib/utils";

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

type KeyName = keyof typeof KEY_CODES;

type Point = { x: number; y: number };

/** Spacing between synthesized move events, so drop targets and canvases see a continuous stroke. */
const DRAG_STEP_PX = 12;
const DRAG_STEP_DELAY_MS = 12;
const DRAG_HOLD_MS = 80;

const interpolatePath = (path: Point[]): Point[] => {
  const points: Point[] = [];
  for (let i = 1; i < path.length; i++) {
    const from = path[i - 1];
    const to = path[i];
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    const steps = Math.max(1, Math.ceil(distance / DRAG_STEP_PX));
    for (let step = 1; step <= steps; step++) {
      const t = step / steps;
      points.push({
        x: Math.round(from.x + (to.x - from.x) * t),
        y: Math.round(from.y + (to.y - from.y) * t),
      });
    }
  }
  return points;
};

const getSessionTab = async () =>
  (await Browser.runtime.sendMessage({ action: ACTIONS.getTab })) as Tabs.Tab | undefined;

const clickAt = async (tabId: number, { x, y }: Point, signal?: AbortSignal) => {
  signal?.throwIfAborted();
  await chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", {
    type: "mousePressed",
    x,
    y,
    button: "left",
    clickCount: 1,
  });
  await sleep(50);
  await chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x,
    y,
    button: "left",
    clickCount: 1,
  });
};

function displayPointer(tabId: number, point: Point, timeout?: number) {
  void Browser.tabs
    .sendMessage(tabId, {
      type: ACTIONS.interactDom,
      name: DOM_ACTIONS.displayPointer,
      args: { ...point, timeout },
    })
    .catch(() => {});
}

async function selectAutomationTab(tabId: number) {
  const result = (await Browser.runtime.sendMessage({ action: ACTIONS.setTab, tabId })) as {
    status: string;
    value?: string;
  };
  if (result?.status !== "success") throw new Error(result?.value ?? "Could not select the tab.");
}

const fetchScreen = async (): Promise<BrowserToolResult> => {
  try {
    const tab = await getSessionTab();
    if (!tab || !tab.id) {
      return { status: "error", message: toolError("Tab not found") };
    }
    if (isInaccessiblePage(tab.url)) {
      return {
        status: "error",
        message: toolError(
          `Cannot capture screen on "${tab.url}". Browser internal pages cannot be accessed or automated.`
        ),
      };
    }
    const devicePixelRatio = await Browser.tabs
      .sendMessage(tab.id, { type: ACTIONS.getDevicePixelRatio })
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
    return { status: "error", message: toolError(error) };
  }
};

const getPageContent = async (): Promise<BrowserToolResult> => {
  try {
    const tab = await getSessionTab();
    if (!tab?.id) {
      return { status: "error", message: toolError("Tab not found") };
    }
    if (isInaccessiblePage(tab.url)) {
      return {
        status: "error",
        message: toolError(
          `Cannot read "${tab.url}". Browser internal pages cannot be accessed or automated.`
        ),
      };
    }
    const response = (await Browser.runtime.sendMessage({
      action: ACTIONS.getPageContent,
      tabId: tab.id,
    })) as { status?: string; message?: string };
    if (!response || response.status === "error") {
      return {
        status: "error",
        message: toolError(response?.message, "Failed to get page content."),
      };
    }
    return { status: "success", message: response.message as string };
  } catch (error) {
    return { status: "error", message: toolError(error) };
  }
};

const findNewTabFromClick = async (sourceTabId: number, tabIdsBefore: Set<number | undefined>) => {
  const tabsAfter = await Browser.tabs.query({});
  const newTabs = tabsAfter.filter((t) => t.id && !tabIdsBefore.has(t.id));
  if (newTabs.length === 1) return newTabs[0];
  return newTabs.find((t) => t.openerTabId === sourceTabId);
};

const click = async (point: Point, signal?: AbortSignal): Promise<BrowserToolResult> => {
  try {
    const tab = await getSessionTab();
    if (!tab || !tab.id) {
      return { status: "error", message: toolError("Tab not found") };
    }
    const sourceTabId = tab.id;
    const tabsBefore = await Browser.tabs.query({});
    const tabIdsBefore = new Set(tabsBefore.map((t) => t.id));

    displayPointer(tab.id, point);
    await clickAt(tab.id, point, signal);

    await sleep(500, signal);
    const newTab = await findNewTabFromClick(sourceTabId, tabIdsBefore);

    if (newTab?.id) {
      await selectAutomationTab(newTab.id);
      await Browser.tabs.update(newTab.id, { active: true });
      return {
        status: "success",
        message: `Success: Click initiated. A new tab was opened (Tab ID: ${newTab.id}). Switched to the new tab.`,
      };
    }
    return { status: "success", message: "Success: Click initiated" };
  } catch (error) {
    return { status: "error", message: toolError(error) };
  }
};

const drag = async (
  { path }: { path: Point[] },
  signal?: AbortSignal
): Promise<BrowserToolResult> => {
  try {
    if (!Array.isArray(path) || path.length < 2) {
      return { status: "error", message: toolError("Drag requires at least 2 points") };
    }
    const tab = await getSessionTab();
    if (!tab || !tab.id) {
      return { status: "error", message: toolError("Tab not found") };
    }
    const points = interpolatePath(path);
    const start = path[0];
    let position = start;

    Browser.tabs
      .sendMessage(tab.id, {
        type: ACTIONS.interactDom,
        name: DOM_ACTIONS.animatePointer,
        args: {
          path: points,
          duration: DRAG_HOLD_MS + points.length * DRAG_STEP_DELAY_MS,
        },
      })
      .catch(() => {});

    signal?.throwIfAborted();
    await chrome.debugger.sendCommand({ tabId: tab.id }, "Input.dispatchMouseEvent", {
      type: "mousePressed",
      x: start.x,
      y: start.y,
      button: "left",
      buttons: 1,
      clickCount: 1,
    });
    try {
      await sleep(DRAG_HOLD_MS, signal);
      for (const point of points) {
        await chrome.debugger.sendCommand({ tabId: tab.id }, "Input.dispatchMouseEvent", {
          type: "mouseMoved",
          ...point,
          button: "left",
          buttons: 1,
        });
        position = point;
        await sleep(DRAG_STEP_DELAY_MS, signal);
      }
    } finally {
      await chrome.debugger.sendCommand({ tabId: tab.id }, "Input.dispatchMouseEvent", {
        type: "mouseReleased",
        ...position,
        button: "left",
        buttons: 0,
        clickCount: 1,
      });
    }
    return { status: "success", message: "Success: Drag initiated" };
  } catch (error) {
    return { status: "error", message: toolError(error) };
  }
};

async function dispatchKey(tabId: number, key: KeyName, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const event = {
    key: key === "Space" ? " " : key,
    code: key,
    windowsVirtualKeyCode: KEY_CODES[key],
  };
  const text = key === "Enter" ? "\r" : key === "Space" ? " " : undefined;
  await chrome.debugger.sendCommand({ tabId }, "Input.dispatchKeyEvent", {
    ...event,
    type: text ? "keyDown" : "rawKeyDown",
    text,
  });
  await sleep(50);
  await chrome.debugger.sendCommand({ tabId }, "Input.dispatchKeyEvent", {
    ...event,
    type: "keyUp",
  });
}

const keyPress = async (
  { key }: { key: KeyName },
  signal?: AbortSignal
): Promise<BrowserToolResult> => {
  try {
    const tab = await getSessionTab();
    if (!tab || !tab.id) {
      return { status: "error", message: toolError("Tab not found") };
    }
    await dispatchKey(tab.id, key, signal);
    return { status: "success", message: "Success: Key pressed" };
  } catch (error) {
    return { status: "error", message: toolError(error) };
  }
};

const typeText = async (
  { text, ...point }: Point & { text: string },
  signal?: AbortSignal
): Promise<BrowserToolResult> => {
  try {
    const tab = await getSessionTab();
    if (!tab || !tab.id) {
      return { status: "error", message: toolError("Tab not found") };
    }
    displayPointer(tab.id, point, text.length * 150 + 500);
    await clickAt(tab.id, point, signal);
    await sleep(100, signal);
    for (const char of text) {
      signal?.throwIfAborted();
      if (char === "\n") {
        await dispatchKey(tab.id, "Enter", signal);
        continue;
      }
      await chrome.debugger.sendCommand({ tabId: tab.id }, "Input.dispatchKeyEvent", {
        type: "keyDown",
        key: char,
        text: char,
      });
      await sleep(25);
      await chrome.debugger.sendCommand({ tabId: tab.id }, "Input.dispatchKeyEvent", {
        type: "keyUp",
        key: char,
      });
      await sleep(10, signal);
    }
    return { status: "success", message: "Success: Text typed successfully" };
  } catch (error) {
    return { status: "error", message: toolError(error) };
  }
};

const clearValue = async (point: Point, signal?: AbortSignal): Promise<BrowserToolResult> => {
  try {
    const tab = await getSessionTab();
    if (!tab || !tab.id) {
      return { status: "error", message: toolError("Tab not found") };
    }
    displayPointer(tab.id, point);
    await clickAt(tab.id, point, signal);
    await sleep(100, signal);
    await chrome.debugger.sendCommand({ tabId: tab.id }, "Input.dispatchKeyEvent", {
      type: "char",
      commands: ["SelectAll"],
    });
    await sleep(100, signal);
    await dispatchKey(tab.id, "Backspace", signal);
    return { status: "success", message: "Success: Value cleared successfully" };
  } catch (error) {
    return { status: "error", message: toolError(error) };
  }
};

const getOption = async (point: Point, signal?: AbortSignal): Promise<BrowserToolResult> => {
  try {
    const tab = await getSessionTab();
    if (!tab || !tab.id) {
      return { status: "error", message: toolError("Tab not found") };
    }
    displayPointer(tab.id, point);
    await clickAt(tab.id, point, signal);
    signal?.throwIfAborted();
    const res = (await Browser.tabs.sendMessage(tab.id, {
      type: ACTIONS.interactDom,
      name: DOM_ACTIONS.getOption,
      args: {},
    })) as { status: string; value: string };
    if (res.status === "success") {
      return { status: "success", message: "Success: " + res.value };
    }
    return { status: "error", message: toolError(res.value) };
  } catch (error) {
    return { status: "error", message: toolError(error) };
  }
};

const setOption = async (
  { value, ...point }: Point & { value: string },
  signal?: AbortSignal
): Promise<BrowserToolResult> => {
  try {
    const tab = await getSessionTab();
    if (!tab || !tab.id) {
      return { status: "error", message: toolError("Tab not found") };
    }
    displayPointer(tab.id, point);
    await clickAt(tab.id, point, signal);
    signal?.throwIfAborted();
    const res = (await Browser.tabs.sendMessage(tab.id, {
      type: ACTIONS.interactDom,
      name: DOM_ACTIONS.setOption,
      args: { value },
    })) as { status: string; value: string };
    if (res.status === "success") {
      return { status: "success", message: "Success: " + res.value };
    }
    return { status: "error", message: toolError(res.value) };
  } catch (error) {
    return { status: "error", message: toolError(error) };
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
}): Promise<BrowserToolResult> => {
  try {
    const tab = await getSessionTab();
    if (!tab || !tab.id) {
      return { status: "error", message: toolError("Tab not found") };
    }
    displayPointer(tab.id, { x, y });
    await chrome.debugger.sendCommand({ tabId: tab.id }, "Input.synthesizeScrollGesture", {
      x,
      y,
      xDistance: -xDistance,
      yDistance: -yDistance,
    });
    return { status: "success", message: "Success: Scroll initiated" };
  } catch (error) {
    return { status: "error", message: toolError(error) };
  }
};

const loadingState = async (): Promise<BrowserToolResult> => {
  try {
    const tab = await getSessionTab();
    if (!tab || !tab.id) {
      return { status: "error", message: toolError("Tab not found") };
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
    return { status: "error", message: toolError(error) };
  }
};

const goto = async ({ url }: { url: string }): Promise<BrowserToolResult> => {
  try {
    const tab = await getSessionTab();
    if (!tab || !tab.id) {
      return { status: "error", message: toolError("Tab not found") };
    }
    await Browser.tabs.update(tab.id, { url });
    return { status: "success", message: "Success: Navigated to URL successfully" };
  } catch (error) {
    return { status: "error", message: toolError(error) };
  }
};

const getOpenedTabs = async (): Promise<BrowserToolResult> => {
  try {
    const tabs = await Browser.tabs.query({});
    const result = tabs.map((tab: Tabs.Tab) => ({
      id: tab.id,
      title: tab.title,
      url: tab.url,
      active: tab.active,
    }));
    return { status: "success", message: JSON.stringify(result) };
  } catch (error) {
    return { status: "error", message: toolError(error) };
  }
};

const openTab = async ({ url }: { url: string }): Promise<BrowserToolResult> => {
  try {
    const tab = await Browser.tabs.create({ url });
    if (tab.id == null) throw new Error("Tab not found");
    await selectAutomationTab(tab.id);
    return { status: "success", message: "Success: URL opened in new tab successfully" };
  } catch (error) {
    return { status: "error", message: toolError(error) };
  }
};

const switchTab = async ({ tabId }: { tabId: number }): Promise<BrowserToolResult> => {
  try {
    await Browser.tabs.update(tabId, { active: true });
    await selectAutomationTab(tabId);
    return { status: "success", message: "Success: Tab switched successfully" };
  } catch (error) {
    return { status: "error", message: toolError(error) };
  }
};

const closeTab = async ({ tabId }: { tabId: number }): Promise<BrowserToolResult> => {
  try {
    await Browser.tabs.remove(tabId);
    return { status: "success", message: "Success: Tab closed successfully" };
  } catch (error) {
    return { status: "error", message: toolError(error) };
  }
};

const reload = async (): Promise<BrowserToolResult> => {
  try {
    const tab = await getSessionTab();
    if (!tab || !tab.id) {
      return { status: "error", message: toolError("Tab not found") };
    }
    await Browser.tabs.reload(tab.id);
    return { status: "success", message: "Success: Reloaded the page successfully" };
  } catch (error) {
    return { status: "error", message: toolError(error) };
  }
};

const wait = async ({ ms }: { ms: number }, signal?: AbortSignal): Promise<BrowserToolResult> => {
  try {
    await sleep(ms, signal);
    return { status: "success", message: `Success: Waited for ${ms} milliseconds` };
  } catch (error) {
    return { status: "error", message: toolError(error) };
  }
};

export const automationToolHandlers: ToolHandlers = {
  fetchScreen,
  getPageContent,
  click,
  drag,
  typeText,
  clearValue,
  keyPress,
  getOption,
  setOption,
  scroll,
  loadingState,
  goto,
  getOpenedTabs,
  openTab,
  switchTab,
  closeTab,
  reload,
  wait,
  webSearch,
  webFetch,
};
