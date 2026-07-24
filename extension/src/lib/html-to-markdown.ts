import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom/worker";
import TurndownService from "turndown";

export type HtmlToMarkdownResult = {
  title: string;
  markdown: string;
};

const turndown = new TurndownService();

// Keep text only — drop media (incl. base64 data URIs).
turndown.addRule("stripMedia", {
  filter: (node) => {
    const tag = node.nodeName.toLowerCase();
    return ["img", "picture", "svg", "video", "audio", "source", "canvas"].includes(tag);
  },
  replacement: () => "",
});

// Extract main page content with Readability and convert to Markdown.
export function htmlToMarkdown(
  html: string,
  pageUrl: string,
  fallbackTitle = ""
): HtmlToMarkdownResult {
  const { document } = parseHTML(html);

  if (pageUrl) {
    const head = document.head ?? document.documentElement;
    const base = document.createElement("base");
    base.setAttribute("href", pageUrl);
    head?.insertBefore(base, head.firstChild);
  }

  const documentClone = document.cloneNode(true) as typeof document;
  const article = new Readability(documentClone as unknown as Document, {
    // Keep the extracted content as a node so Turndown doesn't need a re-parse.
    serializer: (node) => node,
  }).parse();

  const contentNode =
    (article?.content as HTMLElement | null | undefined) ?? (document.body as HTMLElement | null);
  const title = (article?.title || fallbackTitle || "").trim();
  const markdown = contentNode ? turndown.turndown(contentNode).trim() : "";

  console.log("markdown:", markdown);

  return { title, markdown };
}
