import Browser from "webextension-polyfill";
import type { Tabs } from "webextension-polyfill";

/** Internal / extension pages that content scripts and automation cannot access. */
const INACCESSIBLE_URL_PREFIXES = [
  "chrome://",
  "chrome-extension://",
  "chrome-search://",
  "chrome-devtools://",
  "devtools://",
  "brave://",
  "edge://",
  "extension://",
  "opera://",
  "vivaldi://",
  "arc://",
  "about:",
  "moz-extension://",
  "view-source:",
  "data:",
  "blob:",
] as const;

export const isInaccessiblePage = (url?: string) =>
  !url || INACCESSIBLE_URL_PREFIXES.some((prefix) => url.startsWith(prefix));

export async function getActiveTab(): Promise<Tabs.Tab | undefined> {
  const current = await Browser.tabs.query({ active: true, currentWindow: true });
  if (current[0]?.id) return current[0];

  const windows = await Browser.windows.getAll({ populate: true, windowTypes: ["normal"] });
  for (const win of windows) {
    const tab = win.tabs?.find((t) => t.active);
    if (tab?.id) return tab;
  }
  return undefined;
}
