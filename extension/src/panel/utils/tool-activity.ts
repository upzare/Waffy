export function getToolActivityLabel(toolName: string, args?: Record<string, unknown>): string {
  switch (toolName) {
    case "webSearch":
      return "Searching the web...";
    case "webFetch":
      return "Reading web page...";
    case "getPageContent":
      return "Reading page content...";
    case "captureScreenshot":
      return "Capturing page screenshot...";
    case "getPageInfo":
      return "Checking page information...";
    default:
      return "Working...";
  }
}
