import type { FeatureFlags, Message, MessageMode } from "@/types";
import { isModeEnabled } from "@/lib/features";

export type SlashCommand = Exclude<MessageMode, "base">;
type PromptCommand = { value: SlashCommand; start: number; end: number };

const SLASH_COMMANDS: { value: SlashCommand; description: string }[] = [
  { value: "search", description: "Search the web and answer" },
  { value: "research", description: "Deep research from the page" },
  { value: "automate", description: "Run browser automation" },
];

const COMMAND_PATTERN = new RegExp(
  `^/(${SLASH_COMMANDS.map(({ value }) => value).join("|")})`,
  "i"
);

export const getSlashCommands = (flags: FeatureFlags) =>
  SLASH_COMMANDS.filter(({ value }) => isModeEnabled(value, flags));

export function findSlashCommand(prompt: string, offset?: number): PromptCommand | undefined {
  const start = offset ?? prompt.length - prompt.trimStart().length;
  if (!Number.isInteger(start) || start < 0 || start >= prompt.length) return;
  const match = COMMAND_PATTERN.exec(prompt.slice(start));
  if (!match) return;
  const end = start + match[0].length;
  if (offset === undefined && end < prompt.length && !/\s/.test(prompt[end])) return;
  return { value: match[1].toLowerCase() as SlashCommand, start, end };
}

export function storedCommandOffset(message: Message, reply?: Message): number | undefined {
  const { commandOffset, text } = message.content;
  if (commandOffset !== undefined || !reply?.mode || reply.mode === "base") return commandOffset;
  // Older conversations only stored the selected mode on the assistant reply.
  for (const token of (text?.prompt ?? "").matchAll(/\S+/g)) {
    if (token[0].toLowerCase() === `/${reply.mode}`) return token.index;
  }
}
