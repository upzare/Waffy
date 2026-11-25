import { useRef, useState, type ChangeEvent } from "react";
import { Upload } from "lucide-react";
import toast from "react-hot-toast";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  MAX_SKILL_FILE_BYTES,
  parseSkillFile,
  prepareSkill,
  SKILL_FILE_SIZE_ERROR,
  type SkillDefinition,
} from "@/lib/skills/format";
import type { StoredSkill } from "@/types";
import {
  dangerButton,
  panel,
  panelSubtitle,
  primaryButton,
  secondaryButton,
  thinScroll,
} from "../styles";

type SkillDialog =
  { kind: "import"; skill: SkillDefinition } | { kind: "manage" | "remove"; skillId: string };

interface SkillsSectionProps {
  skills?: StoredSkill[];
  loadError: string;
  saving: boolean;
  onStage: (previous?: StoredSkill, draft?: StoredSkill) => void;
}

const disabled = "disabled:cursor-not-allowed disabled:opacity-40";

export default function SkillsSection({ skills, loadError, saving, onStage }: SkillsSectionProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [dialog, setDialog] = useState<SkillDialog | null>(null);
  const [readingFile, setReadingFile] = useState(false);
  const busy = saving || readingFile;
  const managedSkill =
    dialog && dialog.kind !== "import"
      ? skills?.find((skill) => skill.id === dialog.skillId)
      : undefined;
  const dialogSkill = dialog?.kind === "import" ? dialog.skill : managedSkill;
  const replacedSkill =
    dialog?.kind === "import"
      ? skills?.find((skill) => skill.name === dialog.skill.name)
      : undefined;

  const previewFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || busy) return;
    if (file.size > MAX_SKILL_FILE_BYTES) {
      toast.error(SKILL_FILE_SIZE_ERROR);
      return;
    }

    setReadingFile(true);
    try {
      const skill = parseSkillFile(await file.text());
      setDialog({ kind: "import", skill });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't read the skill file.");
    } finally {
      setReadingFile(false);
    }
  };

  return (
    <>
      <div className={panel}>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <p className={`${panelSubtitle} max-w-lg`}>
            Type <code>$</code> in chat to select a skill for one message. Import a new file with
            the same name to replace a skill.
          </p>
          <input
            ref={fileInput}
            type="file"
            accept=".md,.markdown,text/markdown"
            className="hidden"
            aria-label="Skill Markdown file"
            onChange={previewFile}
          />
          <button
            type="button"
            className={`${primaryButton} ${disabled} gap-2`}
            aria-haspopup="dialog"
            disabled={busy || !skills || !!loadError}
            onClick={() => fileInput.current?.click()}
          >
            <Upload size={15} />
            Import SKILL.md
          </button>
        </div>

        {loadError ? (
          <p role="alert" className={panelSubtitle}>
            {loadError}
          </p>
        ) : !skills ? (
          <p role="status" className={panelSubtitle}>
            Loading skills…
          </p>
        ) : skills.length === 0 ? (
          <p className={panelSubtitle}>No skills installed.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {skills.map((skill) => (
              <li
                key={skill.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/40 px-4 py-3"
              >
                <div className="min-w-36 flex-1">
                  <p className="wrap-anywhere font-mono text-sm text-white">{skill.name}</p>
                  <p className={`${panelSubtitle} mt-1 wrap-anywhere`}>{skill.description}</p>
                </div>
                <div className="ml-auto flex shrink-0 items-center gap-3">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${skill.enabled ? "bg-green-dim text-green" : "bg-white/8 text-white/65"}`}
                  >
                    <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" />
                    {skill.enabled ? "Enabled" : "Disabled"}
                  </span>
                  <button
                    type="button"
                    aria-haspopup="dialog"
                    aria-label={`Manage ${skill.name}`}
                    className={`${secondaryButton} ${disabled}`}
                    disabled={busy}
                    onClick={() => setDialog({ kind: "manage", skillId: skill.id })}
                  >
                    Manage
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog
        open={dialog !== null}
        onOpenChange={(open, details) => {
          if (open) return;
          if (busy) details.cancel();
          else setDialog(null);
        }}
      >
        {dialog && (
          <DialogContent
            className={`max-h-[calc(100dvh-2rem)] grid-cols-[minmax(0,1fr)] overflow-y-auto rounded-2xl ${thinScroll}`}
          >
            <DialogHeader>
              <DialogTitle className="mr-5 wrap-anywhere">
                {dialogSkill
                  ? `${dialog.kind === "remove" ? "Remove " : ""}${dialogSkill.name}`
                  : "Skill unavailable"}
              </DialogTitle>
              <DialogDescription className="wrap-anywhere">
                {dialogSkill
                  ? dialog.kind === "remove"
                    ? "Remove this skill when you save changes?"
                    : dialogSkill.description
                  : "This skill may have been removed in another window."}
              </DialogDescription>
            </DialogHeader>
            {dialogSkill && dialog.kind !== "remove" && (
              <>
                {dialog.kind === "import" && (
                  <p className={panelSubtitle}>
                    {replacedSkill && "Saving changes will replace this skill. "}
                    Cloud models receive these instructions when you use the skill.
                  </p>
                )}
                <pre className="max-h-[min(24rem,45vh)] overflow-auto rounded-lg border border-white/10 bg-black/40 p-3 font-mono text-xs leading-relaxed wrap-anywhere whitespace-pre-wrap">
                  {dialogSkill.instructions}
                </pre>
              </>
            )}
            {dialog.kind === "manage" && managedSkill && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5">
                <span className="text-sm font-medium">Enable this skill</span>
                <Switch
                  checked={managedSkill.enabled}
                  aria-label="Enable this skill"
                  disabled={busy}
                  onCheckedChange={(enabled) => onStage(managedSkill, { ...managedSkill, enabled })}
                />
              </div>
            )}
            <DialogFooter className={dialog.kind === "import" ? undefined : "flex-row justify-end"}>
              {dialog.kind === "remove" && managedSkill ? (
                <button
                  type="button"
                  className={`${secondaryButton} ${disabled}`}
                  disabled={busy}
                  onClick={() => setDialog({ kind: "manage", skillId: managedSkill.id })}
                >
                  Cancel
                </button>
              ) : (
                <DialogClose className={`${secondaryButton} ${disabled}`} disabled={busy}>
                  {dialog.kind === "import" ? "Cancel" : "Done"}
                </DialogClose>
              )}
              {dialog.kind === "import" && (
                <button
                  type="button"
                  className={`${primaryButton} ${disabled}`}
                  disabled={busy}
                  onClick={() => {
                    onStage(replacedSkill, prepareSkill(dialog.skill, replacedSkill));
                    setDialog(null);
                  }}
                >
                  {replacedSkill ? "Replace skill" : "Import skill"}
                </button>
              )}
              {managedSkill && (
                <button
                  type="button"
                  className={`${dangerButton} ${disabled}`}
                  disabled={busy}
                  onClick={() => {
                    if (dialog.kind === "remove") {
                      onStage(managedSkill);
                      setDialog(null);
                    } else {
                      setDialog({ kind: "remove", skillId: managedSkill.id });
                    }
                  }}
                >
                  {dialog.kind === "remove" ? "Remove skill" : "Remove"}
                </button>
              )}
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
