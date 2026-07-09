export type SlashCommand = "automate" | "chat";

export const SLASH_COMMANDS: { value: SlashCommand; description: string }[] = [
  { value: "automate", description: "Run browser automation" },
  { value: "chat", description: "Chat about anything on web" },
];

const COMMAND_PATTERN = new RegExp(
  `\\/(${SLASH_COMMANDS.map(({ value }) => value).join("|")})\\b`,
  "i"
);

const STRIP_COMMAND_PATTERN = new RegExp(COMMAND_PATTERN.source, "gi");

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
