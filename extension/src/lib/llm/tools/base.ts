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
      "Capture a screenshot of the visible active tab. Call it to look at or describe the screen.",
    inputSchema: z.object({}),
  }),
  getPageContent: tool({
    description:
      "Read the main content of the currently active browser tab as Markdown. No URL or pasted text needed — it always targets the active tab. Call this immediately to summarize, explain, extract, or answer questions about the current page.",
    inputSchema: z.object({}),
  }),
  webSearch: tool({
    description:
      "Search the web. Returns titles, URLs, and snippets. Then call webFetch on the most relevant URL to read the page.",
    inputSchema: z.object({
      query: z.string().describe("Short keyword search query"),
    }),
  }),
  webFetch: tool({
    description:
      "Fetch the contents of a URL. Use after webSearch to read a chosen result.",
    inputSchema: z.object({
      url: z.string().describe("The URL to fetch"),
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
