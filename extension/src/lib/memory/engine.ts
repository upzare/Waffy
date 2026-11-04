import { env } from "@huggingface/transformers";
import { TurboMemory } from "turbomem";
import Browser from "webextension-polyfill";
import { getAppSettings } from "@/lib/client";
import { extractFacts, userMessageFromPrompt } from "./facts";
import { IndexedDbStorage } from "./storage";

const SEARCH_LIMIT = 8;
const WASM_MJS = "ort/ort-wasm-simd-threaded.asyncify.mjs";
const WASM_BINARY = "ort/ort-wasm-simd-threaded.asyncify.wasm";

let memoryPromise: Promise<TurboMemory> | null = null;

function configureLocalEmbeddings(): void {
  const onnx = env.backends.onnx as {
    wasm?: { numThreads?: number; proxy?: boolean; wasmPaths?: { mjs: string; wasm: string } };
  };
  const wasm = onnx.wasm;
  if (!wasm) {
    throw new Error("Local embedding runtime is unavailable in this page.");
  }
  wasm.numThreads = 1;
  wasm.proxy = false;
  wasm.wasmPaths = {
    mjs: Browser.runtime.getURL(WASM_MJS),
    wasm: Browser.runtime.getURL(WASM_BINARY),
  };
}

async function getMemory(): Promise<TurboMemory> {
  if (!memoryPromise) {
    memoryPromise = (async () => {
      configureLocalEmbeddings();
      const memory = new TurboMemory({
        embeddings: "local",
        storage: new IndexedDbStorage(),
        // TurboMemory requires this config, but Waffy extracts facts with the selected Memory Model.
        extraction: { provider: "openai", model: "unused", apiKey: "unused" },
        deduplication: { enabled: true, threshold: 0.92, strategy: "replace" },
      });
      await memory.init();
      return memory;
    })().catch((error) => {
      memoryPromise = null;
      throw error;
    });
  }
  return memoryPromise;
}

export async function recallMemory(promptText: string): Promise<string> {
  const { settings } = await getAppSettings();
  if (!settings.featureMemory) return "";

  const query = userMessageFromPrompt(promptText);
  if (!query) return "";

  const memory = await getMemory();
  const results = await memory.search(query, { limit: SEARCH_LIMIT });
  if (results.length === 0) return "";
  return `**MEMORY**\n${results.map(({ memory }) => `- ${memory.content}`).join("\n")}`;
}

export async function rememberMemory(promptText: string, assistantText: string): Promise<void> {
  const { settings } = await getAppSettings();
  if (!settings.featureMemory) return;

  const user = userMessageFromPrompt(promptText);
  const assistant = assistantText.trim();
  if (!user || !assistant) return;

  const facts = await extractFacts(user, assistant);
  if (facts.length === 0) return;

  const memory = await getMemory();
  await memory.addFacts(facts, {});
}
