import { stepCountIs, streamText, type ModelMessage, type StopCondition, type ToolSet } from "ai";
import { createBrowserAISessionHooks } from "./browser-ai";
import { generateStepLabel } from "./generate";
import { getStageConfig, resolveModel } from "./model";
import { MODES, resolveBuiltInTools, STAGE_TOOL_ACCESS, type StreamMode } from "./modes";
import {
  MCP_INSTRUCTIONS,
  MEMORY_INSTRUCTIONS,
  EXECUTION_MEMORY_INSTRUCTIONS,
  SKILL_INSTRUCTIONS,
} from "./prompts";
import { withSkillInstructions } from "./messages";
import { createToolExecutor } from "./tools/execute";
import { MEMORY_TOOLS } from "./tools/memory";
import { getFeatureFlags } from "@/lib/features";
import { getMcpProviders, openMcpTurn } from "@/lib/mcp/turn";
import { aiObservability } from "@/lib/posthog";
import type { AppSettings, StoredSkill } from "@/types";

interface StreamResponseOptions {
  mode: StreamMode;
  messages: ModelMessage[];
  settings: AppSettings;
  abortSignal: AbortSignal;
  skill?: StoredSkill;
  toolsContext?: Record<string, object>;
  onToolActivity?: (label: string | null) => void;
  onMcpUnavailable?: (message: string) => void;
}

export type StageEvent =
  | { type: "text.stream"; text: string }
  | { type: "execution.step"; label: string }
  | { type: "tools.pending" }
  | { type: "response.completed"; finalText: string };

const MAX_SDK_TOOL_STEPS = 10;
const hasResponseText: StopCondition<ToolSet> = ({ steps }) => Boolean(steps.at(-1)?.text.trim());

export async function* streamResponse({
  mode,
  messages,
  settings,
  abortSignal,
  skill,
  toolsContext,
  onToolActivity,
  onMcpUnavailable,
}: StreamResponseOptions): AsyncGenerator<StageEvent> {
  abortSignal.throwIfAborted();
  const config = MODES[mode];
  const access = STAGE_TOOL_ACCESS[mode];
  const flags = getFeatureFlags(settings.settings);
  const builtInTools = resolveBuiltInTools(config, flags);
  const memoryEnabled = access.memory && flags.featureMemory;
  const automation = mode === "t2";
  const stageConfig = getStageConfig(settings.settings.models, mode);
  const model = await resolveModel(stageConfig, settings.apiKeys, settings.settings.customApi);
  const browserSessions =
    stageConfig.provider === "browser-ai" ? createBrowserAISessionHooks() : undefined;
  const mcp = access.mcp
    ? await openMcpTurn(abortSignal, {
      onUnavailable: onMcpUnavailable,
      onToolStart: onToolActivity,
    })
    : undefined;

  try {
    const memoryInstructions = automation ? EXECUTION_MEMORY_INSTRUCTIONS : MEMORY_INSTRUCTIONS;
    const instructions = [
      config.prompt(flags, Boolean(mcp)),
      ...(skill ? [SKILL_INSTRUCTIONS] : []),
      ...(mcp ? [MCP_INSTRUCTIONS] : []),
      ...(memoryEnabled ? [memoryInstructions] : []),
    ].join("\n\n");
    const tools: ToolSet = {
      ...builtInTools,
      ...(memoryEnabled && MEMORY_TOOLS),
      ...(mcp && { get_mcp_providers: getMcpProviders, ...mcp.tools }),
    };
    const toolStepLimit = mcp || memoryEnabled ? MAX_SDK_TOOL_STEPS : 1;
    const stepLimit = stepCountIs(toolStepLimit + 1);
    const executeTools = createToolExecutor({
      handlers: config.handlers,
      automation,
      browserAI: stageConfig.provider === "browser-ai",
      mcp,
      abortSignal,
      onToolActivity,
    });
    const transcript = skill ? withSkillInstructions(messages, skill) : [...messages];
    let previousReasoning = "";
    let hasStreamedText = false;

    while (true) {
      abortSignal.throwIfAborted();
      const result = streamText({
        model,
        instructions,
        tools: Object.keys(tools).length ? tools : undefined,
        stopWhen: mcp || memoryEnabled ? stepLimit : [hasResponseText, stepLimit],
        messages: transcript,
        abortSignal,
        prepareStep: ({ stepNumber }) => ({
          ...browserSessions?.prepareStep(),
          toolsContext,
          // Let the model answer from the last SDK tool result at the step limit.
          activeTools: stepNumber === toolStepLimit ? [] : undefined,
        }),
        onStepEnd: browserSessions?.close,
      });

      let firstDelta = true;
      for await (const part of result.stream) {
        if (part.type === "error") throw part.error;
        if (part.type === "start-step") firstDelta = true;
        if (part.type !== "text-delta" || !part.text) continue;
        if (firstDelta) onToolActivity?.(null);
        yield {
          type: "text.stream",
          text: firstDelta && hasStreamedText ? "\n\n" + part.text : part.text,
        };
        firstDelta = false;
        hasStreamedText = true;
      }
      abortSignal.throwIfAborted();

      const finalStep = await result.finalStep;
      void aiObservability({
        modelId: finalStep.model.modelId,
        provider: finalStep.model.provider,
        usage: await result.usage,
      });
      if (finalStep.finishReason === "length")
        throw new Error("The model reached its output limit before finishing the response.");
      if (finalStep.finishReason === "content-filter")
        throw new Error("The provider stopped the response with its content filter.");

      // The SDK handles tools with an execute function. Dispatch the remaining valid calls here.
      const pendingCalls = finalStep.toolCalls.filter(
        (call) =>
          !call.invalid &&
          !call.providerExecuted &&
          Object.hasOwn(tools, call.toolName) &&
          !tools[call.toolName].execute
      );
      if (!pendingCalls.length) {
        if (!finalStep.text.trim()) throw new Error("The model finished without a response.");
        yield { type: "response.completed", finalText: finalStep.text };
        return;
      }

      const browserCalls =
        automation && finalStep.text
          ? pendingCalls.filter(({ toolName }) => Object.hasOwn(builtInTools, toolName))
          : [];
      if (browserCalls.length) {
        const label = await generateStepLabel(
          previousReasoning,
          finalStep.text,
          browserCalls,
          settings,
          abortSignal
        ).catch(() => undefined);
        abortSignal.throwIfAborted();
        if (label !== undefined) previousReasoning = finalStep.text;
        if (label) yield { type: "execution.step", label };
      }
      abortSignal.throwIfAborted();
      yield { type: "tools.pending" };

      if (mcp?.tools) mcp.rememberDiscoveredTools(await result.toolResults);
      transcript.push(...(await result.responseMessages));
      await executeTools(pendingCalls, transcript);
    }
  } finally {
    browserSessions?.close();
    await mcp?.close();
  }
}
