import { tool } from "ai";
import { z } from "zod";

export type BaseToolResult = {
  status: string;
  message: string;
  data?: { type: string; metadata?: Record<string, unknown>; image?: string };
};

export const BASE_TOOLS = {
  getPageInfo: tool({
    description: "Get URL, title, and loading status of the active browser tab.",
    inputSchema: z.object({}),
  }),
  captureScreenshot: tool({
    description:
      "Capture a screenshot image of the visible active tab for visual context only (layout, UI, charts as images, or when the user asks you to look at / describe the screen). Do not use for summarization or text Q&A — prefer getPageContent instead.",
    inputSchema: z.object({}),
  }),
  getPageContent: tool({
    description:
      "Read the main content of the currently active browser tab as Markdown. No URL or pasted text needed — it always targets the active tab. Call this immediately to summarize, explain, extract, or answer questions about the current page. Prefer over captureScreenshot for text tasks.",
    inputSchema: z.object({}),
  }),
  webSearch: tool({
    description:
      "Search the web via Google AI Mode. Returns the AI-generated answer as Markdown. Use for current events, facts not on the current page, or when the user asks to search.",
    inputSchema: z.object({
      query: z.string().describe("Google search query"),
    }),
  }),
  automate: tool({
    description:
      "Hand off to browser automation when the user wants clicks, typing, navigation, form filling, or multi-step browser actions.",
    inputSchema: z.object({
      task: z
        .string()
        .describe(
          "Clear, unambiguous task plan for the automation pipeline, including necessary details from the user request."
        ),
    }),
  }),
};
