import { captureScreenshot, getPageContent, getPageInfo, webFetch, webSearch } from "./common";
import type { BaseToolResult } from "../base";

export const availableFunctions: { [key: string]: (args: any) => Promise<BaseToolResult> } = {
  getPageInfo,
  captureScreenshot,
  getPageContent,
  webSearch,
  webFetch,
};
