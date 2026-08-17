import { streamText } from "ai";
import { toCoreMessages, type ExtensionMessage } from "./messages";
import { convertToolCoordinates } from "./coords";
import { generateStepLabel } from "./generate";
import { getStageConfig, resolveModel } from "./model";
import { MODES, resolvePrompt, resolveTools, type StreamMode } from "./modes";
import { DEFAULT_ERROR_MESSAGE, USER_INTERRUPTED_MESSAGE } from "@/lib/errors";
import { getFeatureFlags } from "@/lib/features";
import type { AppSettings, ToolCall } from "@/types";

export type { StreamMode } from "./modes";

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

export function normalizeStreamError(error: unknown, abortSignal?: AbortSignal): string {
  if (abortSignal?.aborted) return USER_INTERRUPTED_MESSAGE;
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
  const config = MODES[mode];
  const responseId = crypto.randomUUID();

  yield {
    type: "response.started",
    id: responseId,
    mode,
    startedAt: Date.now(),
  };

  const stageConfig = getStageConfig(settings.settings.models, mode);
  const model = await resolveModel(stageConfig, settings.apiKeys, settings.settings.customApi);
  const flags = getFeatureFlags(settings.settings);
  const system = resolvePrompt(mode, flags);
  const tools = resolveTools(mode, flags);

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
      tools: Object.keys(tools).length > 0 ? tools : undefined,
      abortSignal,
    });

    for await (const part of result.fullStream) {
      if (part.type === "text-delta") {
        textResponse += part.text;
        if (config.extra?.streamAsReasoning) {
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
          config.extra?.convertCoordinates &&
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

      if (config.extra?.generateSteps && session && textResponse) {
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
