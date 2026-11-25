import type { FilePart, ModelMessage, TextPart } from "ai";
import type { FileFormat, Message, StoredSkill } from "@/types";
import { buildPageTaggedPrompt, parsePageSources } from "@/panel/utils/page-mentions";
import { storedCommandOffset } from "@/panel/utils/slash-commands";

function messageContent(text: string, files?: FileFormat[]): (TextPart | FilePart)[] {
  const content: (TextPart | FilePart)[] = [];
  if (text) content.push({ type: "text", text });
  for (const { payload } of files ?? []) {
    if (!payload) continue;
    content.push({
      type: "file",
      data: `data:${payload.mimeType};base64,${payload.content}`,
      mediaType: payload.mimeType,
      filename: payload.name,
    });
  }
  return content;
}

export function withSkillInstructions(
  messages: ModelMessage[],
  { name, instructions }: Pick<StoredSkill, "name" | "instructions">
): ModelMessage[] {
  const userMessage = messages.at(-1);
  if (userMessage?.role !== "user") throw new Error("A skill requires a user message.");
  const content =
    typeof userMessage.content === "string" ? messageContent(userMessage.content) : userMessage.content;
  return [
    ...messages.slice(0, -1),
    {
      role: "user",
      content: [...content, { type: "text", text: `Selected skill ($${name})\n\n${instructions}` }],
    },
  ];
}

export function buildConversationMessages(
  prompt: string,
  files: FileFormat[],
  conversation: Message[]
): ModelMessage[] {
  const messages: ModelMessage[] = [];
  for (const [index, message] of conversation.entries()) {
    const { text, files, pageSources, skill } = message.content;
    if (message.id.startsWith("user-")) {
      const taggedPrompt = buildPageTaggedPrompt(
        text?.prompt ?? "",
        parsePageSources(pageSources),
        storedCommandOffset(message, conversation[index + 1]),
        skill
      );
      const content = messageContent(taggedPrompt, files);
      if (content.length) messages.push({ role: "user", content });
    } else if (message.id.startsWith("assistant-")) {
      let response = text?.output || text?.response || "";
      if (message.aborted) {
        response = `TASK_STATUS: INTERRUPTED\n\nCOMPLETED_STEPS: ${text?.execution ?? []}\n\nAGENT_RESPONSE: ${response}`;
      }
      const content = messageContent(response, files);
      if (content.length) messages.push({ role: "assistant", content });
    }
  }
  messages.push({ role: "user", content: messageContent(prompt, files) });
  return messages;
}

export function buildExecutionMessages(
  task: string,
  files: FileFormat[],
  conversation: Message[]
): ModelMessage[] {
  const messages: ModelMessage[] = [];
  let pendingFiles: FileFormat[] = [];
  for (const message of conversation) {
    const { text, files, task, taskStatus } = message.content;
    if (message.id.startsWith("user-")) {
      pendingFiles = files ?? [];
    } else if (message.id.startsWith("assistant-")) {
      if (text?.output && task) {
        const status = message.aborted ? "INTERRUPTED" : (taskStatus ?? "");
        const response = `TASK_STATUS: ${status}\n\nAGENT_OUTPUT: ${text.output}`;
        messages.push(
          { role: "user", content: messageContent(task, pendingFiles) },
          { role: "assistant", content: messageContent(response, files) }
        );
      }
      pendingFiles = [];
    }
  }
  messages.push({ role: "user", content: messageContent(task, files) });
  return messages;
}

export function buildTaskOutputMessages(task: string, executionOutput: string): ModelMessage[] {
  return [
    {
      role: "user",
      content: [{ type: "text", text: `**Task:**\n${task}\n\n**Output:**\n${executionOutput}` }],
    },
  ];
}
