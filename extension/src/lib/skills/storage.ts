import { liveQuery } from "dexie";
import { db } from "@/lib/db";
import type { SkillMention, StoredSkill } from "@/types";

export interface SkillChange {
  original?: StoredSkill;
  draft?: StoredSkill;
}

export function observeSkills() {
  return liveQuery(() => db.skills.orderBy("name").toArray());
}

export function findSkillByName(name: string): Promise<StoredSkill | undefined> {
  return db.skills.where("name").equals(name).first();
}

export async function readSelectedSkill({
  id,
  revision,
  name,
}: SkillMention): Promise<StoredSkill> {
  const skill = await db.skills.get(id);
  if (!skill?.enabled || skill.revision !== revision || skill.name !== name) {
    throw new Error(
      `$${name} changed or is unavailable. Edit the message and select a skill again.`
    );
  }
  return skill;
}

function sameSkillRevision(a?: StoredSkill, b?: StoredSkill) {
  return a?.id === b?.id && a?.revision === b?.revision;
}

function sameSkillFile(a?: StoredSkill, b?: StoredSkill) {
  return (
    a?.originalFile?.name === b?.originalFile?.name &&
    a?.originalFile?.base64 === b?.originalFile?.base64
  );
}

export function matchesSkill(a?: StoredSkill, b?: StoredSkill) {
  return sameSkillRevision(a, b) && a?.enabled === b?.enabled && sameSkillFile(a, b);
}

export function rebaseSkillChange(change: SkillChange, saved?: StoredSkill): SkillChange {
  const { original, draft } = change;
  if (!original || !draft || !saved || !sameSkillRevision(original, saved)) return change;
  return {
    original: saved,
    draft: {
      ...draft,
      enabled: draft.enabled === original.enabled ? saved.enabled : draft.enabled,
      originalFile: sameSkillFile(draft, original) ? saved.originalFile : draft.originalFile,
    },
  };
}

export function applySkillChanges(changes: ReadonlyMap<string, SkillChange>) {
  return db.transaction("rw", db.skills, async () => {
    for (const [name, change] of changes) {
      const current = await findSkillByName(name);
      const { original, draft } = rebaseSkillChange(change, current);
      if (matchesSkill(current, draft)) continue;
      if (!sameSkillRevision(current, original)) {
        throw new Error(
          `$${name} changed in another window. Cancel the pending changes and try again.`
        );
      }
      if (current && current.id !== draft?.id) await db.skills.delete(current.id);
      if (draft) await db.skills.put(draft);
    }
    return db.skills.orderBy("name").toArray();
  });
}
