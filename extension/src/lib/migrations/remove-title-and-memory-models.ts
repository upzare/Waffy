import type { StoredSettings } from ".";

export function removeTitleAndMemoryModels(settings: StoredSettings): StoredSettings {
  const { models } = settings;
  if (!models || (!Object.hasOwn(models, "title") && !Object.hasOwn(models, "memory"))) {
    return settings;
  }

  const { title, memory, ...remainingModels } = models;
  return { ...settings, models: remainingModels };
}
