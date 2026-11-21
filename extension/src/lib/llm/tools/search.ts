import { tool } from "ai";
import { BASE_TOOLS } from "./base";

export const SEARCH_TOOLS = {
  webSearch: tool({
    description:
      "Search the web. Returns titles, URLs, and snippets. For public web lookups, use this before webFetch and read the most relevant URL before answering.",
    inputSchema: BASE_TOOLS.webSearch.inputSchema,
  }),
  webFetch: BASE_TOOLS.webFetch,
};
