export const WRITING_TOOL_TITLE = "Draft & Rewrite";

export const WRITING = {
  readSelection: "WRITING_READ_SELECTION",
  releaseSelection: "WRITING_RELEASE_SELECTION",
  apply: "WRITING_APPLY",
  generate: "WRITING_GENERATE",
  cancelGeneration: "WRITING_CANCEL_GENERATION",
  askInChat: "WRITING_ASK_IN_CHAT",
} as const;

export type WritingSource = { text: string } & (
  { kind: "read-only" } | { kind: "single-line" | "multiline"; maxLength?: number }
);

export type WritingSelectionMessage =
  | { action: typeof WRITING.readSelection | typeof WRITING.releaseSelection; id: string }
  | { action: typeof WRITING.apply; id: string; text: string };

export type WritingPrompt = {
  text: string;
  instruction: string;
  singleLine: boolean;
};

export type WritingResult = { ok: true } | { ok: false; message: string };
export type WritingGenerationResult = { ok: true; text: string } | { ok: false; message: string };

export const writingFailure = (message: string): WritingResult => ({ ok: false, message });

export function writingTargetChanged(source: WritingSource) {
  return writingFailure(
    source.text
      ? "The selection changed. Select the text again."
      : "The field changed. Place the cursor in it and try again."
  );
}

export function writingReplacementError(source: WritingSource, text: string) {
  if (source.kind === "read-only") return "Text can’t be applied on page. Copy & paste it manually.";
  if (source.kind === "single-line" && /[\r\n]/.test(text)) {
    return "This field accepts a single line. Ask for single-line text.";
  }
  if (source.maxLength !== undefined && text.length > source.maxLength) {
    return `Up to ${source.maxLength} characters fit here. Ask for shorter text.`;
  }
}
