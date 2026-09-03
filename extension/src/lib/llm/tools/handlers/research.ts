import { captureScreenshot, getPageContent, getPageInfo, webFetch, webSearch } from "./common";
import type { ResearchToolResult } from "../research";

export const availableFunctions: { [key: string]: (args: any) => Promise<ResearchToolResult> } = {
  getPageInfo,
  captureScreenshot,
  getPageContent,
  webSearch,
  webFetch,
};
