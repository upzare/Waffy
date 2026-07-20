import type { ModelMessage } from "ai";
import type { Message, FileFormat } from "@/types";

type ContentPart =
  { type: "text"; text: string } | { type: "file"; payload: FileFormat["payload"] };

export type ToolResultData = {
  image?: string;
  metadata?: Record<string, unknown>;
}

export type ExtensionMessage =
  | { type: "prompt"; content?: ContentPart[] }
  | { type: "response"; content?: ContentPart[] }
  | { type: "action.init"; id: string; name: string; arguments?: string }
  | { type: "action.result"; id: string; name: string; output?: string; data?: ToolResultData; };

export type ScreenshotState = {
  image: string | null;
  metadata: Record<string, unknown> | null;
}

type ToolCallContent = {
  type: "tool-call";
  toolCallId: string;
  toolName: string;
  input: unknown;
};

type ToolResultContent = {
  type: "tool-result";
  toolCallId: string;
  toolName: string;
  output: unknown;
};

function filePayloadToPart(payload: FileFormat["payload"]) {
  const dataUri = `data:${payload.mimeType};base64,${payload.content}`;
  if (payload.mimeType.startsWith("image")) {
    return { type: "image" as const, image: dataUri };
  }
  return {
    type: "file" as const,
    data: dataUri,
    mediaType: payload.mimeType,
    filename: payload.name,
  };
}

function toContentParts(content: ContentPart[] | undefined): ModelMessage["content"] {
  const parts: NonNullable<Extract<ModelMessage, { role: "user" }>["content"]> = [];
  for (const part of content ?? []) {
    if (part.type === "text" && part.text) {
      parts.push({ type: "text", text: part.text });
    } else if (part.type === "file" && part.payload) {
      parts.push(filePayloadToPart(part.payload));
    }
  }
  return parts;
}

function parseToolInput(argumentsJson?: string): unknown {
  if (!argumentsJson) return {};
  try {
    return JSON.parse(argumentsJson);
  } catch {
    return {};
  }
}

function toToolCall(msg: Extract<ExtensionMessage, { type: "action.init" }>): ToolCallContent {
  return {
    type: "tool-call",
    toolCallId: msg.id,
    toolName: msg.name,
    input: parseToolInput(msg.arguments),
  };
}

function formatScreenshotMetadata(metadata: Record<string, unknown>): string {
  return `<PAGE_METADATA><URL>${metadata.url ?? ""}</URL><TITLE>${metadata.title ?? ""}</TITLE><LOADING_STATUS>${metadata.loading_status ?? ""}</LOADING_STATUS></PAGE_METADATA>`;
}

function formatToolResultText(msg: Extract<ExtensionMessage, { type: "action.result" }>): string {
  const output = msg.output ?? "";
  const metadata = msg.data?.metadata;
  const isScreenshotTool = msg.name === "fetchScreen" || msg.name === "captureScreenshot";
  if (!isScreenshotTool || !metadata) return output;

  return [output, formatScreenshotMetadata(metadata)].filter(Boolean).join("\n");
}

function toToolResult(
  msg: Extract<ExtensionMessage, { type: "action.result" }>,
  screenshotState: ScreenshotState
): ToolResultContent {
  const image = msg.data?.image;
  if (image) {
    screenshotState.image = image;
    screenshotState.metadata = msg.data?.metadata ?? null;

    return {
      type: "tool-result",
      toolCallId: msg.id,
      toolName: msg.name,
      output: {
        type: "content",
        value: [
          { type: "text", text: formatToolResultText(msg) },
          { type: "image-data", data: image, mediaType: "image/jpeg" },
        ],
      },
    };
  }

  return {
    type: "tool-result",
    toolCallId: msg.id,
    toolName: msg.name,
    output: { type: "text", value: formatToolResultText(msg) },
  };
}

function appendUserMessage(
  messages: ModelMessage[],
  msg: Extract<ExtensionMessage, { type: "prompt" }>
) {
  const contentParts = toContentParts(msg.content);
  messages.push({
    role: "user",
    content: contentParts,
  } as ModelMessage);
}

function appendAssistantMessage(
  messages: ModelMessage[],
  msg: Extract<ExtensionMessage, { type: "response" }>
) {
  const contentParts = toContentParts(msg.content);
  messages.push({
    role: "assistant",
    content: contentParts,
  } as ModelMessage);
}

function appendToolCall(
  messages: ModelMessage[],
  msg: Extract<ExtensionMessage, { type: "action.init" }>
) {
  const toolCall = toToolCall(msg);
  const last = messages.at(-1);
  if (last?.role === "assistant" && Array.isArray(last.content)) {
    last.content.push(toolCall);
    return;
  }
  messages.push({ role: "assistant", content: [toolCall] } as ModelMessage);
}

function appendToolResult(
  messages: ModelMessage[],
  msg: Extract<ExtensionMessage, { type: "action.result" }>,
  screenshotState: ScreenshotState
) {
  const toolResult = toToolResult(msg, screenshotState);
  messages.push({ role: "tool", content: [toolResult] } as ModelMessage);
}

export function keepLatestScreenshotOnly(messages: ExtensionMessage[]): void {
  let latestIndex = -1;
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.type === "action.result" && msg.data?.image) {
      latestIndex = i;
    }
  }

  for (let i = 0; i < latestIndex; i++) {
    const msg = messages[i];
    if (msg.type === "action.result" && msg.data?.image) {
      delete msg.data;
    }
  }
}

export function toCoreMessages(
  extensionMessages: ExtensionMessage[],
  screenshotState: ScreenshotState
): ModelMessage[] {
  const messages: ModelMessage[] = [];

  for (const msg of extensionMessages) {
    switch (msg.type) {
      case "prompt":
        appendUserMessage(messages, msg);
        break;
      case "response":
        appendAssistantMessage(messages, msg);
        break;
      case "action.init":
        appendToolCall(messages, msg);
        break;
      case "action.result":
        appendToolResult(messages, msg, screenshotState);
        break;
    }
  }
  return messages;
}

function toExtensionContentParts(text: string, files: FileFormat[] = []): ContentPart[] {
  return [
    { type: "text", text },
    ...files.map((file) => ({ type: "file" as const, payload: file.payload })),
  ];
}

function buildPreviousContext(conversationMessages: Message[]): {
  previousPrompt: ExtensionMessage[];
  previousTask: ExtensionMessage[];
} {
  const previousPrompt: ExtensionMessage[] = [];
  const previousTask: ExtensionMessage[] = [];
  let pendingUserFiles: FileFormat[] = [];

  for (const msg of conversationMessages) {
    if (msg.id.startsWith("user-") && msg.content.text?.prompt) {
      const files = msg.content.files ?? [];
      previousPrompt.push({
        type: "prompt",
        content: toExtensionContentParts(msg.content.text.prompt, files),
      });
      pendingUserFiles = files;
    } else if (msg.id.startsWith("assistant-")) {
      const files = msg.content.files ?? [];
      const output = msg.content.text?.output ?? "";
      const response = msg.content.text?.response ?? "";
      const task = msg.content.task ?? "";
      const taskStatus = msg.content.taskStatus ?? "";
      const execution = msg.content.text?.execution ?? [];
      const aborted = msg.content.aborted;

      if (output) {
        const taskResponse = `TASK_STATUS: ${taskStatus}\n\nAGENT_OUTPUT: ${output}`;
        previousTask.push({
          type: "prompt",
          content: toExtensionContentParts(task, pendingUserFiles),
        });
        previousTask.push({
          type: "response",
          content: toExtensionContentParts(taskResponse, files),
        });
      }

      let assistantResponse = output || response;
      if (aborted) {
        assistantResponse = `TASK_STATUS: INTERRUPTED\n\nCOMPLETED_STEPS: ${execution}\n\nAGENT_RESPONSE: ${assistantResponse}`;
      }

      previousPrompt.push({
        type: "response",
        content: toExtensionContentParts(assistantResponse, files),
      });
      pendingUserFiles = [];
    }
  }

  return { previousPrompt, previousTask };
}

export function buildBaseMessages(
  promptText: string,
  promptFiles: FileFormat[],
  conversationMessages: Message[]
): ExtensionMessage[] {
  const { previousPrompt } = buildPreviousContext(conversationMessages);
  return [
    ...previousPrompt,
    { type: "prompt", content: toExtensionContentParts(promptText, promptFiles) },
  ];
}

export function buildResearchMessages(
  promptText: string,
  promptFiles: FileFormat[],
  conversationMessages: Message[]
): ExtensionMessage[] {
  const { previousPrompt } = buildPreviousContext(conversationMessages);
  return [
    ...previousPrompt,
    { type: "prompt", content: toExtensionContentParts(promptText, promptFiles) },
  ];
}

export function buildT1Messages(
  promptText: string,
  promptFiles: FileFormat[],
  conversationMessages: Message[]
): ExtensionMessage[] {
  const { previousPrompt } = buildPreviousContext(conversationMessages);
  return [
    ...previousPrompt,
    { type: "prompt", content: toExtensionContentParts(promptText, promptFiles) },
  ];
}

export function buildT2Messages(
  task: string,
  promptFiles: FileFormat[],
  conversationMessages: Message[]
): ExtensionMessage[] {
  const { previousTask } = buildPreviousContext(conversationMessages);
  return [...previousTask, { type: "prompt", content: toExtensionContentParts(task, promptFiles) }];
}

function toValidationPromptContent(task: string, executionOutput: string): ContentPart[] {
  return [{ type: "text", text: `**Task:**\n${task}\n\n**Output:**\n${executionOutput}` }];
}

export function buildT3Messages(task: string, executionOutput: string): ExtensionMessage[] {
  return [
    {
      type: "prompt",
      content: toValidationPromptContent(task, executionOutput),
    },
  ];
}

export function buildT4Messages(task: string, executionOutput: string): ExtensionMessage[] {
  return [
    {
      type: "prompt",
      content: toValidationPromptContent(task, executionOutput),
    },
  ];
}
