import { isHttpUrl } from "@/helper";
import { errorMessage } from "../errors";
import { closeOwnedTabs, openTab, snapshotPage } from "./fetch";

const RESULT_LIMIT = 10;

type SearchResult = { url: string; title: string; snippet: string };

const decodeHtml = (value: string) =>
  value
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

/** DuckDuckGo Lite wraps every result in a redirect carrying the real destination. */
const extractSearchResults = (html: string, limit = RESULT_LIMIT): SearchResult[] => {
  const results: SearchResult[] = [];
  const seen = new Set<string>();
  const linkRe =
    /<a[^>]+href="\/\/duckduckgo\.com\/l\/\?uddg=([^&"'<\s]+)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkRe)) {
    let destination: string;
    try {
      destination = decodeURIComponent(match[1]);
    } catch {
      continue;
    }

    if (!isHttpUrl(destination) || seen.has(destination)) continue;

    const title = decodeHtml(match[2]);
    if (!title) continue;

    const after = html.slice((match.index ?? 0) + match[0].length);
    const snippetMatch = after.match(/class=['"]result-snippet['"][^>]*>([\s\S]*?)<\/td>/i);

    seen.add(destination);
    results.push({
      url: destination,
      title,
      snippet: snippetMatch ? decodeHtml(snippetMatch[1]) : "",
    });
    if (results.length >= limit) break;
  }

  return results;
};

export const fetchWebSearch = async (query: string) => {
  const trimmed = query.trim();
  if (!trimmed) return { status: "error", message: "Search query is required." };

  try {
    const tab = await openTab(
      `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(trimmed)}`
    );
    if (!tab) return { status: "error", message: "Failed to open the search page." };

    const snapshot = await snapshotPage(tab.tabId);
    if (!snapshot) return { status: "error", message: "Failed to read the search page." };

    const results = extractSearchResults(snapshot.html);
    if (results.length === 0) return { status: "error", message: "No search results found." };

    const body = results
      .map(
        (result, i) =>
          `index: ${i + 1}\ntitle: ${result.title}\nurl: ${result.url}\ndescription: ${result.snippet}`
      )
      .join("\n\n");

    return { status: "success" as const, message: `Query: ${trimmed}\n\n${body}` };
  } catch (e) {
    return { status: "error", message: errorMessage(e) };
  } finally {
    await closeOwnedTabs();
  }
};
