export const MIN_CAPTURE_SIZE = 8;

export type PanelSide = "left" | "right";

export type CaptureRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CaptureViewport = {
  width: number;
  height: number;
};

export type CaptureState = {
  visible: boolean;
  side: PanelSide;
};

export const isPanelSide = (value: unknown): value is PanelSide =>
  value === "left" || value === "right";

export const isCaptureRect = (value: unknown): value is CaptureRect => {
  if (!value || typeof value !== "object") return false;
  const rect = value as CaptureRect;
  return [rect.x, rect.y, rect.width, rect.height].every(
    (part) => typeof part === "number" && Number.isFinite(part)
  );
};

export const isCaptureViewport = (value: unknown): value is CaptureViewport => {
  if (!value || typeof value !== "object") return false;
  const viewport = value as CaptureViewport;
  return (
    typeof viewport.width === "number" &&
    typeof viewport.height === "number" &&
    Number.isFinite(viewport.width) &&
    Number.isFinite(viewport.height) &&
    viewport.width > 0 &&
    viewport.height > 0
  );
};
