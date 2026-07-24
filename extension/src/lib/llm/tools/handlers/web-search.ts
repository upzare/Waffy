import Browser from "webextension-polyfill";
import { toolError } from "@/lib/errors";

export type WebSearchToolResult = {
  status: string;
  message: string;
};

export const webSearch = async ({ query }: { query: string }): Promise<WebSearchToolResult> => {
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
