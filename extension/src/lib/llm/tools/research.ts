import { tool } from "ai";
import { z } from "zod";

export type ResearchToolResult = {
  status: string;
  message: string;
  data?: { type: string; metadata?: Record<string, unknown>; image?: string };
};

export const RESEARCH_TOOLS = {
  getPageInfo: tool({
    description:
      "Get URL, title, and loading status of the active browser tab. Use this to establish source context before researching.",
    inputSchema: z.object({}),
  }),
  captureScreenshot: tool({
    description:
      "Capture a screenshot of the visible active tab for visual research only — charts/graphs as images, layouts, UI, diagrams. Do not use for text summarization or quote extraction — prefer getPageContent.",
    inputSchema: z.object({}),
  }),
  getPageContent: tool({
    description:
      "Read the main content of the currently active browser tab as Markdown. No URL or pasted text needed — it always targets the active tab. Call this immediately to summarize or research the current page. Prefer over captureScreenshot for text tasks.",
    inputSchema: z.object({}),
  }),
  webSearch: tool({
    description:
      "Search the web. Returns titles, URLs, and snippets. Then call webFetch on the most relevant URL to read the page.",
    inputSchema: z.object({
      query: z.string().describe("Web search query"),
    }),
  }),
  webFetch: tool({
    description:
      "Fetch the contents of a URL. Use after webSearch to read a chosen result.",
    inputSchema: z.object({
      url: z.string().describe("The URL to fetch"),
    }),
  }),
};
