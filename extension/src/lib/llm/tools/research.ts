import { tool } from "ai";
import { z } from "zod";
import { BASE_TOOLS } from "./base";

export const RESEARCH_TOOLS = {
  getPageInfo: tool({
    description:
      "Get URL, title, and loading status of the active browser tab. Use this to establish source context before researching.",
    inputSchema: z.object({}),
  }),
  captureScreenshot: BASE_TOOLS.captureScreenshot,
  getPageContent: BASE_TOOLS.getPageContent,
  webSearch: BASE_TOOLS.webSearch,
  webFetch: BASE_TOOLS.webFetch,
};
