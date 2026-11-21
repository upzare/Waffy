import type { StoredSettings } from ".";

export function renameOutputStage(settings: StoredSettings): StoredSettings {
  if (!settings.models || !Object.hasOwn(settings.models, "t4")) return settings;

  const { t4: outputModel, ...models } = settings.models;
  if (outputModel) models.t3 = outputModel;
  return { ...settings, models };
}
