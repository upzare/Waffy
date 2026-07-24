export const USER_INTERRUPTED_MESSAGE = "User interrupted while processing.";
export const DEFAULT_ERROR_MESSAGE = "Something went wrong. Please try again.";

/** Normalize unknown errors to a plain message without an "Error:" prefix. */
export function errorMessage(error: unknown, fallback = DEFAULT_ERROR_MESSAGE): string {
  let raw: string;
  if (error instanceof Error) {
    raw = error.message;
  } else if (typeof error === "string") {
    raw = error;
  } else if (error != null) {
    raw = String(error);
  } else {
    raw = fallback;
  }
  raw = raw.replace(/^Error:\s*/i, "").trim();
  return raw || fallback;
}

/** Tool-result error string with a single "Error: " prefix. */
export function toolError(error: unknown, fallback?: string): string {
  return "Error: " + errorMessage(error, fallback);
}
