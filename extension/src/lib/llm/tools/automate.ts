import { tool } from "ai";
import { z } from "zod";
import { BASE_TOOLS } from "./base";

const coordinate = z.number().min(0).max(1000);
const screenshotPoint = z.object({
  x: coordinate.describe("Horizontal screenshot position from 0 (left) to 1000 (right)."),
  y: coordinate.describe("Vertical screenshot position from 0 (top) to 1000 (bottom)."),
});

const keyEnum = z.enum([
  "Enter",
  "Backspace",
  "Delete",
  "Tab",
  "Escape",
  "Space",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "PageUp",
  "PageDown",
]);

export const T2_TOOLS = {
  fetchScreen: tool({
    description:
      "Capture a screenshot of the current automation tab for visual grounding and coordinate targeting. Use for clicks, typing, and verifying UI.",
    inputSchema: z.object({}),
  }),
  getPageContent: tool({
    description:
      "Read the full main content of the current automation tab as Markdown in one call. Prefer this over scrolling + repeated screenshots when you need to summarize, extract text, or understand the whole page.",
    inputSchema: z.object({}),
  }),
  click: tool({
    description: "Simulate a click on the specified coordinates.",
    inputSchema: screenshotPoint,
  }),
  drag: tool({
    description:
      "Press the left mouse button at the first coordinate, drag through every following coordinate in order, then release at the last. Use for drag and drop, sliders, resize handles, selecting text, and drawing on a canvas. Supply at least 2 points; supply many closely spaced points to trace a curve or freehand shape.",
    inputSchema: z.object({
      path: z
        .array(screenshotPoint)
        .min(2)
        .describe(
          "Ordered list of points. The press happens at the first point, the release at the last. Any number of points is allowed."
        ),
    }),
  }),
  typeText: tool({
    description: "Type text into the element at the specified coordinates.",
    inputSchema: screenshotPoint.extend({
      text: z.string().describe("The text to type"),
    }),
  }),
  clearValue: tool({
    description: "Clears the value in the input element at the specified coordinates.",
    inputSchema: screenshotPoint,
  }),
  keyPress: tool({
    description: "Send key press to the page.",
    inputSchema: z.object({
      key: keyEnum.describe("The key to press."),
    }),
  }),
  getOption: tool({
    description: "Get all available options for the select element at the specified coordinates.",
    inputSchema: screenshotPoint,
  }),
  setOption: tool({
    description: "Set the value of a select element at the specified coordinates.",
    inputSchema: screenshotPoint.extend({
      value: z.string().describe("The value to set."),
    }),
  }),
  scroll: tool({
    description: "Scrolls the page at the specified coordinates by the given scroll distances.",
    inputSchema: screenshotPoint.extend({
      xDistance: z.number().describe("The distance to scroll along the X axis (pixels)."),
      yDistance: z.number().describe("The distance to scroll along the Y axis (pixels)."),
    }),
  }),
  loadingState: tool({
    description: "Check whether the page is loading or not.",
    inputSchema: z.object({}),
  }),
  goto: tool({
    description: "Navigate to a given URL in current tab.",
    inputSchema: z.object({
      url: z.string().describe("The URL to navigate to."),
    }),
  }),
  getOpenedTabs: tool({
    description: "Get the info of all opened tabs in json format.",
    inputSchema: z.object({}),
  }),
  openTab: tool({
    description: "Opens a new tab with the specified URL.",
    inputSchema: z.object({
      url: z.string().describe("The URL to navigate to."),
    }),
  }),
  switchTab: tool({
    description: "Switches to the specified tab.",
    inputSchema: z.object({
      tabId: z.number().describe("The ID of the tab to switch to."),
    }),
  }),
  closeTab: tool({
    description: "Closes the specified tab.",
    inputSchema: z.object({
      tabId: z.number().describe("The ID of the tab to close."),
    }),
  }),
  reload: tool({
    description: "Reloads the current tab.",
    inputSchema: z.object({}),
  }),
  wait: tool({
    description: "Wait for a specified amount of time.",
    inputSchema: z.object({
      ms: z.number().nonnegative().describe("The amount of time to wait in milliseconds."),
    }),
  }),
  webSearch: tool({
    description:
      "Search the web. Returns titles, URLs, and snippets. Then call webFetch on the most relevant URL to read the page. Use mid-task when you need a fact, value, URL, or other information that is not available on the current page — without navigating the automation tab away from the task.",
    inputSchema: BASE_TOOLS.webSearch.inputSchema,
  }),
  webFetch: BASE_TOOLS.webFetch,
};

const taskStatusSchema = z.enum(["success", "failed", "suspended"]);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

export const reportStatus = tool({
  description: "Record the final outcome of the requested task.",
  inputSchema: z.object({ status: taskStatusSchema }),
  contextSchema: z
    .object({
      onTaskStatus: z
        .custom<(status: TaskStatus) => void>((value) => typeof value === "function")
        .optional(),
    })
    .default({}),
  execute: ({ status }, { context, abortSignal }) => {
    abortSignal?.throwIfAborted();
    context.onTaskStatus?.(status);
    return { status };
  },
});
