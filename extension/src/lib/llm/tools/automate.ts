import { tool } from "ai";
import { z } from "zod";

export type AutomateToolResult = {
  status: string;
  message: string;
  data?: { type: string; metadata?: Record<string, unknown>; image?: string };
};

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

export const T1_TOOLS = {
  proceed: tool({
    description: "Proceed to execution model.",
    inputSchema: z.object({
      task: z.string().describe("Generated task."),
    }),
  }),
};

export const T2_TOOLS = {
  fetchScreen: tool({
    description: "Get the current page screenshot.",
    inputSchema: z.object({}),
  }),
  click: tool({
    description: "Simulate a click on the specified coordinates.",
    inputSchema: z.object({
      x: z.number().describe("The x coordinate of the element to click."),
      y: z.number().describe("The y coordinate of the element to click."),
    }),
  }),
  typeText: tool({
    description: "Type text into the element at the specified coordinates.",
    inputSchema: z.object({
      x: z.number().describe("The x coordinate of the input element."),
      y: z.number().describe("The y coordinate of the input element."),
      text: z.string().describe("The text to type"),
    }),
  }),
  clearValue: tool({
    description: "Clears the value in the input element at the specified coordinates.",
    inputSchema: z.object({
      x: z.number().describe("The x coordinate of the input element."),
      y: z.number().describe("The y coordinate of the input element."),
    }),
  }),
  keyPress: tool({
    description: "Send key press to the page.",
    inputSchema: z.object({
      key: keyEnum.describe("The key to press."),
    }),
  }),
  getOption: tool({
    description: "Get all available options for the select element at the specified coordinates.",
    inputSchema: z.object({
      x: z.number().describe("The x coordinate of the select element."),
      y: z.number().describe("The y coordinate of the select element."),
    }),
  }),
  setOption: tool({
    description: "Set the value of a select element at the specified coordinates.",
    inputSchema: z.object({
      x: z.number().describe("The x coordinate of the select element."),
      y: z.number().describe("The y coordinate of the select element."),
      value: z.string().describe("The value to set."),
    }),
  }),
  scroll: tool({
    description: "Scrolls the page at the specified coordinates by the given scroll distances.",
    inputSchema: z.object({
      x: z.number().describe("The x coordinate of the scroll point."),
      y: z.number().describe("The y coordinate of the scroll point."),
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
      ms: z.number().describe("The amount of time to wait in milliseconds."),
    }),
  }),
};

export const T3_TOOLS = {
  success: tool({
    description: "Call when validation is successful.",
    inputSchema: z.object({}),
  }),
  failed: tool({
    description: "Call when validation fails.",
    inputSchema: z.object({}),
  }),
  suspended: tool({
    description: "Call when the task is suspended.",
    inputSchema: z.object({}),
  }),
};
