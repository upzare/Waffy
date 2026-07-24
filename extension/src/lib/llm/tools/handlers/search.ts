import { webSearch } from "./common";
import type { SearchToolResult } from "../search";

export const availableFunctions: {
  [key: string]: (args: any) => Promise<SearchToolResult>;
} = {
  webSearch,
};
