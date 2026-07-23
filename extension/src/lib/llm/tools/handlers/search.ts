import { webSearch } from "./web-search";
import type { SearchToolResult } from "../search";

export const availableFunctions: {
  [key: string]: (args: any) => Promise<SearchToolResult>;
} = {
  webSearch: webSearch,
};
