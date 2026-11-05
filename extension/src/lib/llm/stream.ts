import { stepCountIs, streamText } from "ai";
import { toCoreMessages, type ExtensionMessage } from "./messages";
import { convertToolCoordinates } from "./coords";
import { generateStepLabel } from "./generate";
import { getStageConfig, resolveModel } from "./model";
import { MODES, resolvePrompt, resolveTools, type StreamMode } from "./modes";
import { DEFAULT_ERROR_MESSAGE, USER_INTERRUPTED_MESSAGE } from "@/lib/errors";
import { getFeatureFlags } from "@/lib/features";
import { MEMORY_TOOLS } from "@/lib/llm/tools/memory";
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

const MEMORY_MODES = new Set<StreamMode>(["base", "search", "research", "t1"]);
const MEMORY_INSTRUCTIONS = `**MEMORY**
On every user message, check SAVE, then RECALL, then answer. Do this yourself. The user will not say "remember" or "recall". Never mention these tools. A sentence in your reply does not save or look anything up.

SAVE — call \`rememberFact\` before answering when the message states a lasting fact about the user.
- Call it for name, job, location, language, a like or preference, or an ongoing project.
- Phrases that require a call: "I'm", "I am", "my name", "call me", "I live", "I work", "I prefer", "I like", "I always", "I use", "I'm building".
- One call per fact. \`fact\` is one sentence starting with "The user". Save a correction as the new sentence.
- Do not save a question, a one-off task, this page, your own reply, a password, or payment data.

RECALL — call \`recallMemories\` once before answering when the reply should use who the user is, what they prefer, or what they are working on.
- Call it for their name, preferences, project, "what do you know about me", "my", "for me", "as usual", "the way I like", or "continue".
- \`query\` is 2–6 words, such as "user name" or "current project". Call it even if this chat already states the fact.
- Do not use it instead of a page or web tool. Skip it only for a public fact, math, news, or this page when the user is not part of the question.

After a memory result, answer the user. Do not call a memory tool again.`;

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
  const prompt = resolvePrompt(mode, flags);
  const memoryEnabled = settings.settings.featureMemory && MEMORY_MODES.has(mode);
  const system = memoryEnabled ? `${prompt}\n\n${MEMORY_INSTRUCTIONS}` : prompt;
  const tools = {
    ...resolveTools(mode, flags),
    ...(memoryEnabled ? MEMORY_TOOLS : {}),
  };

  const screenshotState = {
    image: session?.screenshot ?? null,
    metadata: session?.screenshotMetadata ?? null,
  };

  let textResponse = "";

  try {
    const result = streamText({
      model,
      instructions: system,
      messages: toCoreMessages(messages, screenshotState),
      tools: Object.keys(tools).length > 0 ? tools : undefined,
      abortSignal,
      ...(memoryEnabled ? { stopWhen: stepCountIs(10) } : {}),
    });

    for await (const part of result.stream) {
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

    const completedToolCalls = (await result.toolCalls).filter(
      (toolCall) => !Object.hasOwn(MEMORY_TOOLS, toolCall.toolName)
    );
    if (completedToolCalls.length > 0) {
      const convertedCalls: Array<{ toolCallId: string; toolName: string; input: unknown }> = [];

      for (const tc of completedToolCalls) {
        let input = tc.input as Record<string, unknown>;
        if (config.extra?.convertCoordinates && screenshotState.image) {
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
