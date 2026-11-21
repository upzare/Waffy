import type { ModelConfig, Settings } from "@/types";
import { renameOutputStage } from "./rename-output-stage";

export type StoredSettings = Partial<Omit<Settings, "models">> & {
  models?: Record<string, ModelConfig | undefined>;
};

// A migration returns its input when the stored settings are already current.
const settingsMigrations: readonly ((settings: StoredSettings) => StoredSettings)[] = [
  renameOutputStage,
];

export function applySettingsMigrations(settings: StoredSettings): StoredSettings {
  return settingsMigrations.reduce((current, migrate) => migrate(current), settings);
}
