export const isInaccessiblePage = (url?: string) =>
  !url || url.startsWith("chrome://") || url.startsWith("chrome-extension://");

export async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const current = await chrome.tabs.query({ active: true, currentWindow: true });
  if (current[0]?.id) return current[0];

  const windows = await chrome.windows.getAll({ populate: true, windowTypes: ["normal"] });
  for (const win of windows) {
    const tab = win.tabs?.find((t) => t.active);
    if (tab?.id) return tab;
  }
  return undefined;
}
