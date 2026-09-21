import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { CircleStop, File, Globe, Paperclip, Send, X } from "lucide-react";
import { Mention, MentionsInput, makeTriggerRegex } from "react-mentions-ts";
import type { InputContainerProps } from "../../types";
import { getSlashCommands } from "../utils/slash-commands";
import { useWindowTabs } from "../hooks/use-window-tabs";
import {
  MENTION_CHIP_COMPOSER_CLASS,
  MENTION_CHIP_MUTED_CLASS,
  MUTED_PAGE_MARKUP,
  PAGE_MARKUP,
  SLASH_MARKUP,
  type WindowPage,
} from "../utils/page-mentions";

const SUPPORTED_TYPES = ["image/jpeg", "image/png", "image/gif", "text/plain", "application/pdf"];
const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;

const INPUT_CLASS = "box-border max-h-50 min-h-12 w-full resize-none border-none bg-transparent py-3.5 pr-18 pl-2.5 caret-current outline-none text-[0.9rem] text-white placeholder:text-[0.875rem] placeholder:text-white/40 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar]:bg-[#22222299] [&::-webkit-scrollbar-thumb]:bg-white/30";

const pageTrigger = makeTriggerRegex("@", { allowSpaceInQuery: true });

function SuggestionHeader({ title }: { title: string }) {
  return <p className="p-1.5 text-xs font-medium tracking-wider text-white/35 uppercase">{title}</p>;
}

function SuggestionEmpty({ title, message }: { title: string; message: string }) {
  return (
    <>
      <SuggestionHeader title={title} />
      <p className="px-2 py-1.5 text-sm text-white/50">{message}</p>
    </>
  );
}

function CommandRow({
  value,
  description,
  focused,
}: {
  value: string;
  description?: string;
  focused: boolean;
}) {
  return (
    <div
      className={`grid grid-cols-[5.25rem_1fr] items-baseline gap-x-3 rounded px-2 py-1.5 ${focused ? "bg-white/[0.06]" : ""}`}
    >
      <span className={`text-sm font-medium tracking-tight whitespace-nowrap ${focused ? "text-green-300" : "text-white/90"}`}>
        /{value}
      </span>
      <span className={`text-xs leading-snug ${focused ? "text-white/55" : "text-white/40"}`}>
        {description}
      </span>
    </div>
  );
}

function PageRow({
  page,
  focused,
}: {
  page: { display?: string; favIconUrl?: string; hostname?: string };
  focused: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 rounded px-2 py-1.5 ${focused ? "bg-white/6" : ""}`}>
      {page.favIconUrl ? (
        <img src={page.favIconUrl} alt="" className="h-4 w-4 shrink-0 rounded-sm object-contain" />
      ) : (
        <Globe className="h-4 w-4 shrink-0 stroke-white/50" />
      )}
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm ${focused ? "text-green-300" : "text-white/90"}`}>{page.display}</p>
        {page.hostname ? <p className="truncate text-xs text-white/40">{page.hostname}</p> : null}
      </div>
    </div>
  );
}

function InputContainer({
  isGenerating,
  textareaRef,
  fileInputRef,
  message,
  files,
  inputResetKey,
  features,
  setMessage,
  setFiles,
  onSendMessage,
  onStopGeneration,
}: InputContainerProps) {
  const canSend = message.trim().length > 0 || files.length > 0;
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const [isFileDrag, setIsFileDrag] = useState(false);
  const [suggestionKind, setSuggestionKind] = useState<"command" | "page">("command");
  const [suggestionsHost, setSuggestionsHost] = useState<HTMLDivElement | null>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const slashCommands = getSlashCommands(features);
  const windowPages = useWindowTabs();

  const setTextareaRef = (el: HTMLTextAreaElement | HTMLInputElement | null) => {
    (textareaRef as React.MutableRefObject<HTMLTextAreaElement | null>).current =
      el instanceof HTMLTextAreaElement ? el : null;
  };

  useEffect(() => {
    const urls = files.map((file) =>
      file.type.startsWith("image/") ? URL.createObjectURL(file) : ""
    );
    setFilePreviews(urls);
    return () => {
      for (const url of urls) {
        if (url) URL.revokeObjectURL(url);
      }
    };
  }, [files]);

  useEffect(() => {
    if (inputResetKey === 0) return;
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    const end = el.value.length;
    el.setSelectionRange(end, end);
  }, [inputResetKey, textareaRef]);

  useEffect(() => {
    const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes("Files") ?? false;

    const onDragOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (isGenerating) {
        e.dataTransfer!.dropEffect = "none";
        return;
      }
      setIsFileDrag(true);
      const overDropZone = dropZoneRef.current?.contains(e.target as Node);
      e.dataTransfer!.dropEffect = overDropZone ? "copy" : "none";
    };

    const onDragLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      const next = e.relatedTarget as Node | null;
      if (next && document.documentElement.contains(next)) return;
      setIsFileDrag(false);
    };

    const onDrop = (e: DragEvent) => {
      setIsFileDrag(false);
      if (dropZoneRef.current?.contains(e.target as Node)) return;
      if (hasFiles(e)) e.preventDefault();
    };

    document.addEventListener("dragover", onDragOver);
    document.addEventListener("dragleave", onDragLeave);
    document.addEventListener("drop", onDrop);
    return () => {
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("dragleave", onDragLeave);
      document.removeEventListener("drop", onDrop);
    };
  }, [isGenerating]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    const listbox = (e.currentTarget.getRootNode() as Document | ShadowRoot).querySelector?.(
      '[role="listbox"]'
    );
    if (listbox && (e.key === "Enter" || e.key === "Tab")) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend && !isGenerating) onSendMessage();
    }
  };

  const addFiles = (incoming: File[]) => {
    if (isGenerating || incoming.length === 0) return;

    for (const file of incoming) {
      if (!SUPPORTED_TYPES.includes(file.type)) {
        toast.error("Unsupported File Type", { duration: 3000 });
        return;
      }
      if (file.size > MAX_UPLOAD_SIZE) {
        toast.error("File Size Exceeded", { duration: 3000 });
        return;
      }
    }

    setFiles((prev) => [...prev, ...incoming]);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const selected = Array.from(input.files ?? []);
    input.value = "";
    addFiles(selected);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFileDrag(false);
    if (isGenerating) return;
    addFiles(Array.from(e.dataTransfer.files));
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (isGenerating) return;

    const pasted: File[] = [];
    for (const item of e.clipboardData.items) {
      if (item.kind !== "file") continue;
      const file = item.getAsFile();
      if (file) pasted.push(file);
    }
    if (pasted.length === 0) return;

    addFiles(pasted);
    if (!e.clipboardData.getData("text/plain")) {
      e.preventDefault();
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const commandItems = slashCommands.map(({ value, description }) => ({
    id: value,
    display: value,
    description,
  }));

  const pageItems = windowPages.map((page: WindowPage) => ({
    id: String(page.tabId),
    display: page.label,
    url: page.url,
    favIconUrl: page.favIconUrl,
    hostname: page.hostname,
  }));

  const actionBtn = "rounded-md p-2 transition-colors duration-200 disabled:opacity-40";

  return (
    <div
      ref={dropZoneRef}
      className="z-10 mt-auto border-t px-4 py-3.5 backdrop-blur-md transition-colors duration-150 border-white/8 bg-black/70"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onPaste={handlePaste}
    >
      <div
        className={`relative flex items-center rounded-xl border bg-white/4 transition-[border-color,box-shadow] duration-150
          ${isFileDrag
            ? "border-dashed border-green-500/60 shadow-[0_0_0_3px_rgba(34,197,94,0.16)]"
            : "border-white/9"
          }`}
      >
        <div className="relative w-full">
          <div
            ref={setSuggestionsHost}
            className="absolute inset-x-0 bottom-[calc(100%+0.5rem)] z-50 *:static! *:w-full!"
          />
          <MentionsInput
            key={inputResetKey}
            value={message}
            onMentionsChange={({ value }) => setMessage(value)}
            onKeyDown={handleKeyDown}
            inputRef={setTextareaRef}
            suggestionsPlacement="above"
            anchorMode="left"
            suggestionsPortalHost={suggestionsHost}
            customSuggestionsContainer={(children) => (
              <>
                <SuggestionHeader title={suggestionKind === "page" ? "Pages" : "Commands"} />
                {children}
              </>
            )}
            placeholder="Type / for commands or @ for pages"
            className="relative w-full"
            classNames={{
              control: "relative w-full border-0 bg-transparent",
              highlighter: `${INPUT_CLASS} pointer-events-none overflow-hidden text-transparent`,
              input: `${INPUT_CLASS} field-sizing-content overflow-y-auto`,
              suggestions: "min-w-0 max-h-56 overflow-y-auto rounded-md border border-white/8 bg-[#101010]/96 p-1.5 shadow-lg backdrop-blur-md",
              suggestionsList: "divide-y-0",
              suggestionItem: "rounded p-0.5",
            }}
            rows={1}
          >
            <Mention
              trigger="/"
              markup={SLASH_MARKUP}
              displayTransform={(_, display) => `/${display ?? ""}`}
              data={(query) => {
                setSuggestionKind("command");
                const term = query.toLowerCase();
                return commandItems.filter(
                  (item) => !term || item.display.includes(term) || item.description.toLowerCase().includes(term)
                );
              }}
              appendSpaceOnAdd
              className={MENTION_CHIP_COMPOSER_CLASS}
              renderEmpty={(query) => (
                <SuggestionEmpty
                  title="Commands"
                  message={query ? "No matching commands" : "No commands available"}
                />
              )}
              renderSuggestion={(entry, _search, _highlighted, _index, focused) => (
                <CommandRow
                  value={String(entry.display ?? entry.id)}
                  description={typeof entry.description === "string" ? entry.description : undefined}
                  focused={focused}
                />
              )}
            />
            <Mention
              trigger={pageTrigger}
              markup={PAGE_MARKUP}
              displayTransform={(_, display) => `@${display ?? ""}`}
              data={(query) => {
                setSuggestionKind("page");
                const term = query.toLowerCase();
                return pageItems.filter((item) => {
                  if (!term) return true;
                  return (
                    item.display.toLowerCase().includes(term) ||
                    item.url.toLowerCase().includes(term) ||
                    item.hostname.toLowerCase().includes(term)
                  );
                });
              }}
              appendSpaceOnAdd
              className={MENTION_CHIP_COMPOSER_CLASS}
              renderEmpty={(query) => (
                <SuggestionEmpty
                  title="Pages"
                  message={query ? "No matching pages" : "No pages are open"}
                />
              )}
              renderSuggestion={(entry, _search, _highlighted, _index, focused) => (
                <PageRow page={entry} focused={focused} />
              )}
            />
            <Mention
              trigger={"\u0001"}
              markup={MUTED_PAGE_MARKUP}
              displayTransform={(_, display) => `@${display ?? ""}`}
              data={[]}
              className={MENTION_CHIP_MUTED_CLASS}
            />
          </MentionsInput>
        </div>
        <div className="absolute right-2 bottom-2 z-10 flex gap-2">
          {isGenerating ? (
            <button
              type="button"
              className={`${actionBtn} text-red-400 hover:bg-red-500/10 hover:text-red-500`}
              onClick={onStopGeneration}
              title="Stop generating"
            >
              <CircleStop className="h-4 w-4 stroke-current" />
            </button>
          ) : (
            <>
              <input
                ref={fileInputRef}
                type="file"
                hidden
                multiple
                accept={SUPPORTED_TYPES.join(",")}
                onChange={handleFileUpload}
              />
              <button
                type="button"
                className={`${actionBtn} text-white/70 hover:bg-white/10 hover:text-white`}
                onClick={() => fileInputRef.current?.click()}
                title="Attach files"
              >
                <Paperclip className="h-4 w-4 stroke-current" />
              </button>
              <button
                type="button"
                className={`${actionBtn} text-green-500/80 hover:bg-green-500/10 hover:text-green-500`}
                onClick={onSendMessage}
                disabled={!canSend}
                title="Send"
              >
                <Send className="h-4 w-4 stroke-current" />
              </button>
            </>
          )}
        </div>
      </div>
      {files.length > 0 && (
        <div className="mt-2 flex flex-col gap-2">
          {files.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 p-2"
            >
              {filePreviews[index] ? (
                <img
                  src={filePreviews[index]}
                  className="h-5 w-5 shrink-0 object-contain"
                  alt={file.name}
                />
              ) : (
                <File className="h-5 w-5 shrink-0 stroke-white" />
              )}
              <span className="flex-1 truncate text-xs" title={file.name}>
                {file.name}
              </span>
              <button
                type="button"
                className="group leading-none"
                onClick={() => removeFile(index)}
              >
                <X className="h-4 w-4 p-0.5 stroke-white/70 transition-colors group-hover:stroke-white" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default InputContainer;
