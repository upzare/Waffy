import Browser from "webextension-polyfill";
import { getActiveTab } from "@/helper";
import { webSearch } from "./web-search";
import type { BaseToolResult } from "../base";

const getPageInfo = async (): Promise<BaseToolResult> => {
  try {
    const tab = await getActiveTab();
    if (!tab?.id) {
      return { status: "error", message: "Error: No active tab found." };
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
        message: "Error: " + (response?.message ?? "Failed to get page info."),
      };
    }
    return { status: "success", message: response.message as string };
  } catch (error) {
    return { status: "error", message: "Error: " + error };
  }
};

const captureScreenshot = async (): Promise<BaseToolResult> => {
  try {
    const tab = await getActiveTab();
    if (!tab?.id) {
      return { status: "error", message: "Error: No active tab found." };
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
        message: "Error: " + (response?.message ?? "Failed to capture screenshot."),
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
    return { status: "error", message: "Error: " + error };
  }
};

const getPageContent = async (): Promise<BaseToolResult> => {
  try {
    const tab = await getActiveTab();
    if (!tab?.id) {
      return { status: "error", message: "Error: No active tab found." };
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
        message: "Error: " + (response?.message ?? "Failed to get page content."),
      };
    }
    return { status: "success", message: response.message as string };
  } catch (error) {
    return { status: "error", message: "Error: " + error };
  }
};

export const availableFunctions: { [key: string]: (args: any) => Promise<BaseToolResult> } = {
  getPageInfo: getPageInfo,
  captureScreenshot: captureScreenshot,
  getPageContent: getPageContent,
  webSearch: webSearch,
};
