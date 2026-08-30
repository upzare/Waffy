export async function getImageDimensions(
  base64: string
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = () => reject(new Error("Failed to decode screenshot"));
    img.src = `data:image/jpeg;base64,${base64}`;
  });
}

export async function convertToolCoordinates(
  toolArgs: Record<string, unknown>,
  screenshot: string | null,
  devicePixelRatio = 1
): Promise<Record<string, unknown>> {
  const hasPoint = toolArgs.x !== undefined && toolArgs.y !== undefined;
  const hasPath = Array.isArray(toolArgs.path);
  if (!screenshot || (!hasPoint && !hasPath)) {
    return toolArgs;
  }

  try {
    const { width, height } = await getImageDimensions(screenshot);
    const scaleX = width / devicePixelRatio / 1000;
    const scaleY = height / devicePixelRatio / 1000;
    const converted = { ...toolArgs };

    if (hasPoint) {
      converted.x = Math.round((toolArgs.x as number) * scaleX);
      converted.y = Math.round((toolArgs.y as number) * scaleY);
    }

    if (hasPath) {
      converted.path = (toolArgs.path as Array<{ x: number; y: number }>).map((point) => ({
        ...point,
        x: Math.round(point.x * scaleX),
        y: Math.round(point.y * scaleY),
      }));
    }

    return converted;
  } catch {
    return toolArgs;
  }
}
