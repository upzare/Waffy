export const isInaccessiblePage = (url?: string) =>
  !url || url.startsWith("chrome://") || url.startsWith("chrome-extension://");
