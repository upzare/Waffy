import Browser from "webextension-polyfill";
import { getActiveTab } from "@/helper";
import { toolError } from "@/lib/errors";
import type { BaseToolResult } from "../base";

export const getPageInfo = async (): Promise<BaseToolResult> => {
  try {
    const tab = await getActiveTab();
    if (!tab?.id) {
      return { status: "error", message: toolError("No active tab found.") };
    }
    const response = (await Browser.runtime.sendMessage({
      action: "GET_PAGE_INFO",
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

export const captureScreenshot = async (): Promise<BaseToolResult> => {
  try {
    const tab = await getActiveTab();
    if (!tab?.id) {
      return { status: "error", message: toolError("No active tab found.") };
    }
    const response = (await Browser.runtime.sendMessage({
      action: "CAPTURE_VISIBLE_TAB",
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

export const getPageContent = async (): Promise<BaseToolResult> => {
  try {
    const tab = await getActiveTab();
    if (!tab?.id) {
      return { status: "error", message: toolError("No active tab found.") };
    }
    const response = (await Browser.runtime.sendMessage({
      action: "GET_PAGE_CONTENT",
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

export const webSearch = async ({ query }: { query: string }): Promise<BaseToolResult> => {
  try {
    const response = (await Browser.runtime.sendMessage({
      action: "FETCH_GOOGLE_AI_MODE",
      query: query.trim(),
    })) as { status?: string; message?: string };

    if (response?.status === "success" && response.message) {
      return { status: "success", message: response.message };
    }

    return {
      status: "error",
      message: toolError(response?.message, "Failed to fetch Google AI Mode results."),
    };
  } catch (error) {
    return { status: "error", message: toolError(error) };
  }
};
