import type { SkillMention } from "@/types";

export const SKILL_MARKUP = "$[__display__](skill:__id__)";
export const SKILL_MARKUP_PATTERN =
  /\$\[([a-z0-9-]{1,64})\]\(skill:([a-f0-9-]{36}):([a-f0-9-]{36})\)/g;

export function findTypedSkill(
  prompt: string,
  command?: { start: number; end: number }
): Pick<SkillMention, "name" | "offset"> | undefined {
  const start = prompt.length - prompt.trimStart().length;
  const afterMode = command?.start === start ? command.end : start;
  const match = /^(\s*)\$([a-z0-9-]{1,64})(?=\s|$)/.exec(prompt.slice(afterMode));
  if (match) return { name: match[2], offset: afterMode + match[1].length };
}

export function skillMentionSpan(prompt: string, skill?: SkillMention) {
  if (!skill || !Number.isInteger(skill.offset) || skill.offset < 0) return;
  const token = `$${skill.name}`;
  if (prompt.startsWith(token, skill.offset)) {
    return { start: skill.offset, end: skill.offset + token.length };
  }
}
