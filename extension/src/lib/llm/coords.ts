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
  if (!screenshot || toolArgs.x === undefined || toolArgs.y === undefined) {
    return toolArgs;
  }

  try {
    const { width, height } = await getImageDimensions(screenshot);
    const screenshotWidth = width / devicePixelRatio;
    const screenshotHeight = height / devicePixelRatio;
    return {
      ...toolArgs,
      x: Math.round(((toolArgs.x as number) / 1000) * screenshotWidth),
      y: Math.round(((toolArgs.y as number) / 1000) * screenshotHeight),
    };
  } catch {
    return toolArgs;
  }
}
