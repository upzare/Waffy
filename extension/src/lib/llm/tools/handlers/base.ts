import { captureScreenshot, getPageContent, getPageInfo, webSearch } from "./common";
import type { BaseToolResult } from "../base";

export const availableFunctions: { [key: string]: (args: any) => Promise<BaseToolResult> } = {
  getPageInfo,
  captureScreenshot,
  getPageContent,
  webSearch,
};
