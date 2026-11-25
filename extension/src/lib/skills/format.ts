import { parseDocument } from "yaml";
import { z } from "zod";
import type { StoredSkill } from "@/types";

export const MAX_SKILL_FILE_BYTES = 16 * 1024;
export const SKILL_FILE_SIZE_ERROR = "Choose a Markdown file of 16 KB or less.";
export type SkillDefinition = Pick<StoredSkill, "name" | "description" | "instructions">;

const metadataSchema = z.object({
  name: z
    .string({ error: "Enter a name in the skill frontmatter." })
    .max(64, "Use 64 characters or fewer for the skill name.")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Use lowercase letters, numbers, and single hyphens for the skill name."
    ),
  description: z
    .string({ error: "Enter a description in the skill frontmatter." })
    .trim()
    .min(1, "Enter a description in the skill frontmatter.")
    .max(1024, "Use 1,024 characters or fewer for the skill description."),
});

export function parseSkillFile(source: string): SkillDefinition {
  if (new TextEncoder().encode(source).byteLength > MAX_SKILL_FILE_BYTES) {
    throw new Error(SKILL_FILE_SIZE_ERROR);
  }

  const markdown = source.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const frontmatter = /^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/.exec(markdown);
  if (!frontmatter) throw new Error("Start the file with YAML frontmatter between two --- lines.");

  const document = parseDocument(frontmatter[1], { stringKeys: true });
  const problem = document.errors[0] ?? document.warnings[0];
  if (problem) throw new Error(`Check the YAML frontmatter. ${problem.message}`);

  let fields: unknown;
  try {
    fields = document.toJS({ maxAliasCount: 0 });
  } catch {
    throw new Error("Use plain YAML values in the skill frontmatter.");
  }
  const metadata = metadataSchema.safeParse(fields ?? {});
  if (!metadata.success) throw new Error(metadata.error.issues[0].message);

  const instructions = markdown.slice(frontmatter[0].length);
  if (!instructions.trim()) throw new Error("Add Markdown instructions after the frontmatter.");

  return { ...metadata.data, instructions };
}

export function prepareSkill(definition: SkillDefinition, previous?: StoredSkill): StoredSkill {
  const sameContent =
    previous &&
    previous.name === definition.name &&
    previous.description === definition.description &&
    previous.instructions === definition.instructions;
  return {
    ...definition,
    id: previous?.id ?? crypto.randomUUID(),
    revision: sameContent ? previous.revision : crypto.randomUUID(),
    enabled: previous?.enabled ?? true,
  };
}
