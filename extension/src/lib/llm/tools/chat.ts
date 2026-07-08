import { tool } from "ai";
import { z } from "zod";

export type ChatToolResult = {
  status: string;
  message: string;
  data?: { type: string; metadata?: Record<string, unknown>; image?: string };
};

export const CHAT_TOOLS = {
  getPageInfo: tool({
    description: "Get URL, title, and loading status of the active browser tab.",
    inputSchema: z.object({}),
  }),
  captureScreenshot: tool({
    description:
      "Capture a screenshot image of the visible active tab. You can see and describe the returned image. Use this whenever the user asks what is on screen, to describe the page visually, or when visual context helps.",
    inputSchema: z.object({}),
  }),
  getPageContent: tool({
    description: "Get readable text content from the active tab for summarization and analysis.",
    inputSchema: z.object({}),
  }),
};
