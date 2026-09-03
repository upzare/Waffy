import { tool } from "ai";
import { z } from "zod";

export type SearchToolResult = {
  status: string;
  message: string;
};

export const SEARCH_TOOLS = {
  webSearch: tool({
    description:
      "Search the web. Returns titles, URLs, and snippets. Always call this first with the user's query, then call webFetch on the most relevant URL before answering.",
    inputSchema: z.object({
      query: z.string().describe("Web search query based on the user's request"),
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
