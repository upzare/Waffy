import type { ChatToolResult } from "../chat";

const getPageInfo = async () => {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: "GET_PAGE_INFO" }, (response) => {
      if (!response || response.status === "error") {
        reject(response?.message ?? "Failed to get page info.");
        return;
      }
      resolve(response.message);
    });
  })
    .then((res) => {
      return { status: "success", message: res as string };
    })
    .catch((error) => {
      return { status: "error", message: "Error: " + error };
    });
};

const captureScreenshot = async () => {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: "CAPTURE_VISIBLE_TAB" }, (response) => {
      if (!response || response.status === "error") {
        reject(response?.message ?? "Failed to capture screenshot.");
        return;
      }
      resolve({
        type: "screenshot",
        metadata: response.metadata,
        image: response.image,
      });
    });
  })
    .then((data) => {
      const screenshot = data as {
        type: string;
        metadata?: Record<string, unknown>;
        image?: string;
      };
      return {
        status: "success",
        message: "Success: Screenshot captured.",
        data: screenshot,
      };
    })
    .catch((error) => {
      return { status: "error", message: "Error: " + error };
    });
};

const getPageContent = async () => {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: "GET_PAGE_CONTENT" }, (response) => {
      if (!response || response.status === "error") {
        reject(response?.message ?? "Failed to get page content.");
        return;
      }
      resolve(response.message);
    });
  })
    .then((res) => {
      return { status: "success", message: res as string };
    })
    .catch((error) => {
      return { status: "error", message: "Error: " + error };
    });
};

export const availableFunctions: { [key: string]: (args: any) => Promise<ChatToolResult> } = {
  getPageInfo: getPageInfo,
  captureScreenshot: captureScreenshot,
  getPageContent: getPageContent,
};
