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
      "Capture a screenshot of the visible active tab for visual research — charts, layouts, images, and on-screen evidence you can describe.",
    inputSchema: z.object({}),
  }),
  getPageContent: tool({
    description:
      "Get readable text content from the active tab. Use this to extract facts, quotes, and details for research synthesis.",
    inputSchema: z.object({}),
  }),
};
