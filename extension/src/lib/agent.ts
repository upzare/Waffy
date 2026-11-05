import { getAppSettings } from "./client";
import { runStream, StreamEvent, StreamMode, StreamSession } from "./llm/stream";
import { generateTitle } from "./llm/generate";
import type { ExtensionMessage } from "./llm/messages";

export async function createTitle(prompt: string) {
  try {
    const { settings, apiKeys } = await getAppSettings();
    return await generateTitle(prompt, { settings, apiKeys });
  } catch {
    throw "Title Generation Error";
  }
}

export async function* AI(
  messages: ExtensionMessage[],
  mode: StreamMode,
  abortController: AbortController | null,
  session?: StreamSession
): AsyncGenerator<StreamEvent> {
  const { settings, apiKeys } = await getAppSettings();

  yield* runStream({
    mode,
    messages,
    settings: { settings, apiKeys },
    abortSignal: abortController?.signal,
    session,
  });
}
