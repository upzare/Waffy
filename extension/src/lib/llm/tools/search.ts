import { tool } from "ai";
import { z } from "zod";

export type SearchToolResult = {
  status: string;
  message: string;
};

export const SEARCH_TOOLS = {
  webSearch: tool({
    description:
      "Search the web via Google AI Mode. Returns the AI-generated answer as Markdown. Always call this first with the user's query before answering.",
    inputSchema: z.object({
      query: z.string().describe("Google search query based on the user's request"),
    }),
  }),
};
