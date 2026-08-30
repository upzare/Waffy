import { tool } from "ai";
import { z } from "zod";

export type SearchToolResult = {
  status: string;
  message: string;
};

export const SEARCH_TOOLS = {
  webSearch: tool({
    description:
      "Search the web and return Markdown from the top result pages. Always call this first with the user's query before answering.",
    inputSchema: z.object({
      query: z.string().describe("Web search query based on the user's request"),
    }),
  }),
};
