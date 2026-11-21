import type { ModelMessage, ToolResultPart, ToolSet, TypedToolCall } from "ai";
import type { openMcpTurn } from "@/lib/mcp/turn";
import { toolError } from "@/lib/errors";
import { convertToolCoordinates, type Screenshot } from "../coords";
import { getToolActivityLabel } from "./activity";
import type { ToolHandlers } from "./handlers/common";

type ToolCall = TypedToolCall<ToolSet>;

interface ToolExecutorOptions {
  handlers?: ToolHandlers;
  automation: boolean;
  browserAI: boolean;
  mcp?: Awaited<ReturnType<typeof openMcpTurn>>;
  abortSignal: AbortSignal;
  onToolActivity?: (label: string | null) => void;
}

function toolResult({ toolCallId, toolName }: ToolCall, text: string): ToolResultPart {
  return { type: "tool-result", toolCallId, toolName, output: { type: "text", value: text } };
}

function attachScreenshot(
  transcript: ModelMessage[],
  result: ToolResultPart,
  image: string,
  text: string,
  browserAI: boolean
): () => void {
  if (browserAI) {
    // The Prompt API adapter accepts images in user messages and serializes tool results as text.
    const index = transcript.length;
    transcript.push({
      role: "user",
      content: [{ type: "file", mediaType: "image/jpeg", data: image }],
    });
    return () => {
      transcript.splice(index, 1);
    };
  }
  const textOutput = result.output;
  result.output = {
    type: "content",
    value: [
      { type: "text", text },
      { type: "file", mediaType: "image/jpeg", data: { type: "data", data: image } },
    ],
  };
  return () => {
    result.output = textOutput;
  };
}

export function createToolExecutor({
  handlers,
  automation,
  browserAI,
  mcp,
  abortSignal,
  onToolActivity,
}: ToolExecutorOptions) {
  let screenshot: (Screenshot & { removeImage: () => void }) | undefined;

  return async function executeTools(calls: ToolCall[], transcript: ModelMessage[]) {
    // Coordinates in this batch refer to the screenshot the model actually saw.
    const grounding = screenshot;
    const results: ToolResultPart[] = [];
    transcript.push({ role: "tool", content: results });
    for (const call of calls) {
      abortSignal.throwIfAborted();
      const handler = handlers?.[call.toolName];
      if (!handler) {
        const mcpOutput = await mcp?.call(call.toolName, call.input);
        abortSignal.throwIfAborted();
        if (mcpOutput === undefined) throw new Error("No handler registered for " + call.toolName);
        if (automation) onToolActivity?.(null);
        results.push(toolResult(call, mcpOutput));
        continue;
      }

      if (!automation) onToolActivity?.(getToolActivityLabel(call.toolName));

      let input = call.input;
      if (automation) {
        try {
          input = await convertToolCoordinates(input as Record<string, unknown>, grounding);
        } catch (error) {
          results.push(toolResult(call, toolError(error)));
          continue;
        }
      }
      abortSignal.throwIfAborted();
      const { message, data } = await handler(input, abortSignal);
      abortSignal.throwIfAborted();
      const metadata = data?.metadata;
      const text = metadata
        ? `${message}\n<PAGE_METADATA><URL>${metadata.url ?? ""}</URL><TITLE>${metadata.title ?? ""}</TITLE><LOADING_STATUS>${metadata.loading_status ?? ""}</LOADING_STATUS></PAGE_METADATA>`
        : message;
      const result = toolResult(call, text);
      results.push(result);
      if (data?.type !== "screenshot" || !data.image) continue;
      screenshot?.removeImage();
      const removeImage = attachScreenshot(transcript, result, data.image, text, browserAI);
      if (automation) {
        const ratio = metadata?.pixelRatio;
        screenshot = {
          image: data.image,
          pixelRatio: typeof ratio === "number" && ratio > 0 ? ratio : 1,
          removeImage,
        };
      }
    }
  };
}
