import React, { useEffect, useRef, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
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
import { deleteMemory, observeMemories, resetMemories } from "@/lib/memory/storage";
import { summarizeMemory } from "@/lib/memory/facts";
import type { Settings } from "@/types";
import {
  dangerButton,
  iconButton,
  panel,
  panelSubtitle,
  panelTitle,
  secondaryButton,
} from "../styles";

interface MemorySectionProps {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
}

interface SavedFact {
  id: string;
  content: string;
  createdAt: Date;
}

const MemorySection: React.FC<MemorySectionProps> = ({ settings, setSettings }) => {
  const [facts, setFacts] = useState<SavedFact[]>([]);
  const [loading, setLoading] = useState(true);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summary, setSummary] = useState("");
  const [summarizing, setSummarizing] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const summaryRequest = useRef(0);

  useEffect(() => {
    let active = true;
    const subscription = observeMemories().subscribe({
      next: (rows) => {
        if (!active) return;
        setFacts(
          rows.map((row) => ({
            id: row.id,
            content: row.content,
            createdAt: row.createdAt,
          }))
        );
        setLoading(false);
      },
      error: (error) => {
        console.error("Failed to load memories", error);
        if (!active) return;
        setLoading(false);
        toast.error("Couldn't load saved memory");
      },
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleDelete = async (id: string) => {
    if (!settings.featureMemory) return;
    try {
      await deleteMemory(id);
    } catch (error) {
      console.error("Failed to delete memory", error);
      toast.error("Couldn't delete that fact");
    }
  };

  const closeSummary = () => {
    summaryRequest.current += 1;
    setSummaryOpen(false);
    setSummarizing(false);
  };

  const handleReset = async () => {
    if (!settings.featureMemory) return;
    setResetting(true);
    try {
      await resetMemories();
      setResetOpen(false);
      toast.success("Memory reset");
    } catch (error) {
      console.error("Failed to reset memory", error);
      toast.error("Couldn't reset memory");
    } finally {
      setResetting(false);
    }
  };

  const handleSummarize = async () => {
    if (!settings.featureMemory) return;
    const request = ++summaryRequest.current;
    setSummaryOpen(true);
    setSummarizing(true);
    setSummary("");
    try {
      const text = await summarizeMemory(facts.map((fact) => fact.content));
      if (request !== summaryRequest.current) return;
      setSummary(text || "Nothing to summarize yet.");
    } catch (error) {
      if (request !== summaryRequest.current) return;
      console.error("Failed to summarize memory", error);
      setSummaryOpen(false);
      toast.error(error instanceof Error ? error.message : "Couldn't summarize memory");
    } finally {
      if (request === summaryRequest.current) setSummarizing(false);
    }
  };

  return (
    <>
      <div className={panel}>
        <div className="mb-4">
          <h3 className={panelTitle}>Personalized memory</h3>
          <p className={panelSubtitle}>
            Waffy saves useful facts from your chats on this device and uses them in later
            conversations. Embeddings are computed locally and stored in IndexedDB.
          </p>
        </div>

        <div className="rounded-sm border border-border bg-black/20 px-3.5">
          <label className="flex cursor-pointer items-center justify-between gap-3 py-2.5">
            <span className="text-sm font-medium text-text-primary">Use personalized memory</span>
            <Switch
              size="sm"
              checked={settings.featureMemory}
              onCheckedChange={(checked) =>
                setSettings((prev) => ({ ...prev, featureMemory: checked }))
              }
            />
          </label>
        </div>
      </div>

      <div className={panel}>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className={panelTitle}>Saved facts</h3>
            <p className={panelSubtitle}>
              These are the facts in memory and it will be used to personalize the assistant's responses.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              className={`${secondaryButton} disabled:cursor-not-allowed disabled:opacity-40`}
              onClick={() => void handleSummarize()}
              disabled={!settings.featureMemory || summarizing || loading || facts.length === 0}
            >
              Summarize
            </button>
            <button
              type="button"
              className={`${dangerButton} disabled:cursor-not-allowed disabled:opacity-40`}
              onClick={() => setResetOpen(true)}
              disabled={!settings.featureMemory || loading || resetting || facts.length === 0}
            >
              Reset memory
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-text-muted">Loading saved facts…</p>
        ) : facts.length === 0 ? (
          <p className="text-sm text-text-muted">
            Nothing remembered yet. Facts appear after you chat with memory turned on.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {facts.map((fact) => (
              <li
                key={fact.id}
                className="flex items-start gap-3 rounded-sm border border-border bg-black/20 px-3.5 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-relaxed text-text-primary">{fact.content}</p>
                  <p className="mt-1 text-xs text-text-muted">
                    {fact.createdAt.toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <button
                  type="button"
                  className={`${iconButton} disabled:cursor-not-allowed disabled:opacity-40`}
                  title="Delete fact"
                  onClick={() => void handleDelete(fact.id)}
                  disabled={!settings.featureMemory}
                >
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={summaryOpen} onOpenChange={(open) => { if (!open) closeSummary(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Memory summary</DialogTitle>
            <DialogDescription className="sr-only">
              A summary of the facts saved in memory.
            </DialogDescription>
          </DialogHeader>
          {summarizing ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Summarizing…
            </div>
          ) : (
            <div className="max-h-[min(24rem,60vh)] overflow-y-auto text-sm leading-relaxed whitespace-pre-wrap text-text-secondary">
              {summary}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={resetOpen}
        onOpenChange={(open) => {
          if (!open && !resetting) setResetOpen(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset memory</DialogTitle>
            <DialogDescription>
              This deletes every saved fact. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose
              className={`${secondaryButton} disabled:cursor-not-allowed disabled:opacity-40`}
              disabled={resetting}
            >
              No
            </DialogClose>
            <button
              type="button"
              className={`${dangerButton} disabled:cursor-not-allowed disabled:opacity-40`}
              onClick={() => void handleReset()}
              disabled={resetting}
            >
              {resetting ? "Resetting…" : "Yes"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MemorySection;
