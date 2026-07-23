import { streamText } from "ai";
import { PROMPTS } from "./prompts";
import { toCoreMessages, type ExtensionMessage } from "./messages";
import { convertToolCoordinates } from "./coords";
import { generateStepLabel } from "./generate";
import { getStageConfig, resolveModel } from "./model";
import { BASE_TOOLS } from "@/lib/llm/tools/base";
import { SEARCH_TOOLS } from "@/lib/llm/tools/search";
import { RESEARCH_TOOLS } from "@/lib/llm/tools/research";
import { T1_TOOLS, T2_TOOLS, T3_TOOLS } from "@/lib/llm/tools/automate";
import type { AppSettings, ToolCall } from "@/types";

export type StreamMode = "base" | "search" | "research" | "t1" | "t2" | "t3" | "t4";

const TOOLS: Record<
  string,
  | typeof BASE_TOOLS
  | typeof SEARCH_TOOLS
  | typeof RESEARCH_TOOLS
  | typeof T1_TOOLS
  | typeof T2_TOOLS
  | typeof T3_TOOLS
  | Record<string, never>
> = {
  base: BASE_TOOLS,
  search: SEARCH_TOOLS,
  research: RESEARCH_TOOLS,
  t1: T1_TOOLS,
  t2: T2_TOOLS,
  t3: T3_TOOLS,
  t4: {},
};

export interface StreamSession {
  screenshot: string | null;
  screenshotMetadata: Record<string, unknown> | null;
  previousReasoning: string;
}

export interface StreamOptions {
  mode: StreamMode;
  messages: ExtensionMessage[];
  settings: AppSettings;
  abortSignal?: AbortSignal;
  session?: StreamSession;
}

export interface ResponseStartedEvent {
  type: "response.started";
  id: string;
  mode: StreamMode;
  startedAt: number;
}

export interface ResponseCompletedEvent {
  type: "response.completed";
  id: string;
  mode: StreamMode;
  completedAt: number;
}

export interface ResponseErrorEvent {
  type: "response.error";
  id?: string;
  error: string;
}

export interface TextStreamEvent {
  type: "text.stream";
  id: string;
  text: string;
}

export interface ReasoningDeltaEvent {
  type: "reasoning.delta";
  id: string;
  text: string;
}

export interface ActionCallEvent {
  type: "action.call";
  id: string;
  action: Record<string, ToolCall>;
  step?: string;
}

export type StreamEvent =
  | ResponseStartedEvent
  | ResponseCompletedEvent
  | ResponseErrorEvent
  | TextStreamEvent
  | ReasoningDeltaEvent
  | ActionCallEvent;

const DEFAULT_ERROR_MESSAGE = "Something went wrong. Please try again.";

export function normalizeStreamError(error: unknown, abortSignal?: AbortSignal): string {
  if (abortSignal?.aborted) return "User interrupted while processing.";
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return DEFAULT_ERROR_MESSAGE;
}

function toolCallToRecord(
  toolCalls: Array<{ toolCallId: string; toolName: string; input: unknown }>
): Record<string, ToolCall> {
  const record: Record<string, ToolCall> = {};
  toolCalls.forEach((tc, index) => {
    record[String(index)] = {
      id: tc.toolCallId,
      name: tc.toolName,
      arguments: JSON.stringify(tc.input ?? {}),
    };
  });
  return record;
}

export async function* runStream(options: StreamOptions): AsyncGenerator<StreamEvent> {
  const { mode, messages, settings, abortSignal, session } = options;
  const responseId = crypto.randomUUID();

  yield {
    type: "response.started",
    id: responseId,
    mode,
    startedAt: Date.now(),
  };

  const stageConfig = getStageConfig(settings.settings.models, mode);
  const model = await resolveModel(stageConfig, settings.apiKeys);
  const system = PROMPTS[mode] ?? "";
  const tools = TOOLS[mode] ?? {};

  const screenshotState = {
    image: session?.screenshot ?? null,
    metadata: session?.screenshotMetadata ?? null,
  };

  let textResponse = "";

  try {
    const result = streamText({
      model,
      system,
      messages: toCoreMessages(messages, screenshotState),
      tools:
        Object.keys(tools).length > 0
          ? (tools as Parameters<typeof streamText>[0]["tools"])
          : undefined,
      abortSignal,
    });

    for await (const part of result.fullStream) {
      if (part.type === "text-delta") {
        textResponse += part.text;
        if (mode === "t2") {
          yield { type: "reasoning.delta", id: responseId, text: part.text };
        } else {
          yield { type: "text.stream", id: responseId, text: part.text };
        }
      }

      if (part.type === "error") {
        throw part.error;
      }
    }

    const completedToolCalls = await result.toolCalls;
    if (completedToolCalls.length > 0) {
      const convertedCalls: Array<{ toolCallId: string; toolName: string; input: unknown }> = [];

      for (const tc of completedToolCalls) {
        let input = tc.input as Record<string, unknown>;
        if (
          mode === "t2" &&
          screenshotState.image &&
          input.x !== undefined &&
          input.y !== undefined
        ) {
          const pixelRatio = (screenshotState.metadata?.pixelRatio as number) ?? 1;
          input = await convertToolCoordinates(input, screenshotState.image, pixelRatio);
        }
        convertedCalls.push({
          toolCallId: tc.toolCallId,
          toolName: tc.toolName,
          input,
        });
      }

      const action = toolCallToRecord(convertedCalls);
      let step: string | undefined;

      if (mode === "t2" && session && textResponse) {
        try {
          step = await generateStepLabel(session.previousReasoning, textResponse, action, settings);
          session.previousReasoning = textResponse;
        } catch {
          step = undefined;
        }
      }

      if (session) {
        session.screenshot = screenshotState.image;
        session.screenshotMetadata = screenshotState.metadata;
      }

      yield {
        type: "action.call",
        id: responseId,
        action,
        ...(step ? { step } : {}),
      };
    }

    yield {
      type: "response.completed",
      id: responseId,
      mode,
      completedAt: Date.now(),
    };
  } catch (error) {
    throw normalizeStreamError(error, abortSignal);
  }
}
