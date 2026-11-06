import { env, pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";
import Browser from "webextension-polyfill";

const MODEL = "Xenova/all-MiniLM-L6-v2";
const DIMENSIONS = 384;
const WASM_MJS = "ort/ort-wasm-simd-threaded.asyncify.mjs";
const WASM_BINARY = "ort/ort-wasm-simd-threaded.asyncify.wasm";
let pipelinePromise: Promise<FeatureExtractionPipeline> | null = null;

function configureRuntime(): void {
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

async function getPipeline(): Promise<FeatureExtractionPipeline> {
  if (!pipelinePromise) {
    configureRuntime();
    pipelinePromise = pipeline("feature-extraction", MODEL).catch((error) => {
      pipelinePromise = null;
      throw error;
    });
  }
  return pipelinePromise;
}

export async function embedText(text: string): Promise<number[]> {
  const extractor = await getPipeline();
  const output = await extractor([text], { pooling: "mean", normalize: true });
  const embedding = Array.from(output.data as ArrayLike<number>);

  if (embedding.length !== DIMENSIONS) {
    throw new Error(
      `Local embedding model returned ${embedding.length} values; expected ${DIMENSIONS}.`
    );
  }

  return embedding;
}
