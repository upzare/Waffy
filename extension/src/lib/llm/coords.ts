export interface Screenshot {
  image: string;
  pixelRatio: number;
  dimensions?: Promise<{ width: number; height: number }>;
}

function getImageDimensions(base64: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = () => reject(new Error("Failed to decode screenshot"));
    img.src = `data:image/jpeg;base64,${base64}`;
  });
}

export async function convertToolCoordinates(
  toolArgs: Record<string, unknown>,
  screenshot?: Screenshot
): Promise<Record<string, unknown>> {
  const hasPoint = toolArgs.x !== undefined && toolArgs.y !== undefined;
  const hasPath = Array.isArray(toolArgs.path);
  if (!hasPoint && !hasPath) return toolArgs;
  if (!screenshot) throw new Error("Call fetchScreen before targeting coordinates.");

  screenshot.dimensions ??= getImageDimensions(screenshot.image);
  const { width, height } = await screenshot.dimensions;
  const viewportWidth = width / screenshot.pixelRatio;
  const viewportHeight = height / screenshot.pixelRatio;
  const toPixel = (value: number, size: number) =>
    Math.min(Math.round((value * size) / 1000), Math.ceil(size) - 1);
  const converted = { ...toolArgs };

  if (hasPoint) {
    converted.x = toPixel(toolArgs.x as number, viewportWidth);
    converted.y = toPixel(toolArgs.y as number, viewportHeight);
  }

  if (hasPath) {
    converted.path = (toolArgs.path as Array<{ x: number; y: number }>).map((point) => ({
      x: toPixel(point.x, viewportWidth),
      y: toPixel(point.y, viewportHeight),
    }));
  }
  return converted;
}
