import Browser from "webextension-polyfill";
import { ACTIONS, getActiveTab } from "@/lib/helper";
import { toolError } from "@/lib/errors";

export type BrowserToolResult = {
  status: string;
  message: string;
  data?: { type: string; metadata?: Record<string, unknown>; image?: string };
};

// The SDK validates each input against its tool schema before it reaches a handler.
export type ToolHandlers = Record<
  string,
  (input: any, signal?: AbortSignal) => Promise<BrowserToolResult>
>;

const getPageInfo = async (): Promise<BrowserToolResult> => {
  try {
    const tab = await getActiveTab();
    if (!tab?.id) {
      return { status: "error", message: toolError("No active tab found.") };
    }
    const response = (await Browser.runtime.sendMessage({
      action: ACTIONS.getPageInfo,
      tabId: tab.id,
    })) as {
      status?: string;
      message?: string;
    };
    if (!response || response.status === "error") {
      return {
        status: "error",
        message: toolError(response?.message, "Failed to get page info."),
      };
    }
    return { status: "success", message: response.message as string };
  } catch (error) {
    return { status: "error", message: toolError(error) };
  }
};

const captureScreenshot = async (): Promise<BrowserToolResult> => {
  try {
    const tab = await getActiveTab();
    if (!tab?.id) {
      return { status: "error", message: toolError("No active tab found.") };
    }
    const response = (await Browser.runtime.sendMessage({
      action: ACTIONS.captureVisibleTab,
      tabId: tab.id,
    })) as {
      status?: string;
      message?: string;
      metadata?: Record<string, unknown>;
      image?: string;
    };
    if (!response || response.status === "error") {
      return {
        status: "error",
        message: toolError(response?.message, "Failed to capture screenshot."),
      };
    }
    return {
      status: "success",
      message: "Success: Screenshot captured.",
      data: {
        type: "screenshot",
        metadata: response.metadata,
        image: response.image,
      },
    };
  } catch (error) {
    return { status: "error", message: toolError(error) };
  }
};

const getPageContent = async (): Promise<BrowserToolResult> => {
  try {
    const tab = await getActiveTab();
    if (!tab?.id) {
      return { status: "error", message: toolError("No active tab found.") };
    }
    const response = (await Browser.runtime.sendMessage({
      action: ACTIONS.getPageContent,
      tabId: tab.id,
    })) as {
      status?: string;
      message?: string;
    };
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

async function requestWebContent(
  request:
    | { action: typeof ACTIONS.webSearch; query: string }
    | { action: typeof ACTIONS.webFetch; url: string },
  signal?: AbortSignal
): Promise<BrowserToolResult> {
  const id = crypto.randomUUID();
  const cancel = () => {
    void Browser.runtime.sendMessage({ action: ACTIONS.cancelWebRequest, id }).catch(() => {});
  };
  try {
    signal?.throwIfAborted();
    signal?.addEventListener("abort", cancel, { once: true });
    const response = (await Browser.runtime.sendMessage({ ...request, id })) as {
      status?: string;
      message?: string;
    };
    if (response?.status === "success" && response.message) {
      return { status: "success", message: response.message };
    }
    return {
      status: "error",
      message: toolError(response?.message, "Failed to read web content."),
    };
  } catch (error) {
    return { status: "error", message: toolError(error) };
  } finally {
    signal?.removeEventListener("abort", cancel);
  }
}

export const webSearch = ({ query }: { query: string }, signal?: AbortSignal) =>
  requestWebContent({ action: ACTIONS.webSearch, query: query.trim() }, signal);

export const webFetch = ({ url }: { url: string }, signal?: AbortSignal) =>
  requestWebContent({ action: ACTIONS.webFetch, url: url.trim() }, signal);

export const browserToolHandlers: ToolHandlers = {
  getPageInfo,
  captureScreenshot,
  getPageContent,
  webSearch,
  webFetch,
};
