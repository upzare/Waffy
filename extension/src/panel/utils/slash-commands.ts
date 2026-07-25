import type { FeatureFlags, MessageMode } from "@/types";
import { isModeEnabled } from "@/lib/features";

export type SlashCommand = "search" | "research" | "automate";

const SLASH_COMMANDS: { value: SlashCommand; description: string }[] = [
  { value: "search", description: "Search the web and answer" },
  { value: "research", description: "Deep research from the page" },
  { value: "automate", description: "Run browser automation" },
];

const COMMAND_PATTERN = new RegExp(
  `\\/(${SLASH_COMMANDS.map(({ value }) => value).join("|")})\\b`,
  "i"
);

const STRIP_COMMAND_PATTERN = new RegExp(COMMAND_PATTERN.source, "gi");

export const getSlashCommands = (flags: FeatureFlags) =>
  SLASH_COMMANDS.filter(({ value }) => isModeEnabled(value, flags));

export function hasSlashCommand(text: string): boolean {
  return COMMAND_PATTERN.test(text);
}

export function parseSlashCommand(mentions: string[], text: string): SlashCommand | null {
  const fromMention = SLASH_COMMANDS.find(({ value }) => mentions.includes(value));
  if (fromMention) return fromMention.value;

  const match = COMMAND_PATTERN.exec(text);
  return match ? (match[1].toLowerCase() as SlashCommand) : null;
}

export function stripSlashCommands(text: string): string {
  return text.replace(STRIP_COMMAND_PATTERN, "").replace(/\s+/g, " ").trim();
}

export function resolveMode(value?: string | null): MessageMode {
  switch (value) {
    case "search":
      return "search";
    case "research":
      return "research";
    case "automate":
      return "automate";
    default:
      return "base";
  }
}
