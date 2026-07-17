import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { CircleStop, File, Paperclip, Send, X } from "lucide-react";
import { MentionRoot, MentionInput, MentionContent, MentionItem } from "@diceui/mention";
import type { InputContainerProps } from "../../types";
import { hasSlashCommand, SLASH_COMMANDS } from "../utils/slash-commands";

const SUPPORTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "text/plain",
  "application/pdf",
];
const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;

function InputContainer({
  isGenerating,
  textareaRef,
  fileInputRef,
  message,
  mentions,
  files,
  setMessage,
  setMentions,
  setFiles,
  onSendMessage,
  onStopGeneration,
}: InputContainerProps) {
  const canSend = message.trim().length > 0 || files.length > 0;
  const [mentionOpen, setMentionOpen] = useState(false);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);

  // Remount MentionRoot after programmatic clears — its internal highlight
  const [mentionRootKey, setMentionRootKey] = useState(0);
  const hadInputContentRef = useRef(false);

  const setTextareaRef = (el: HTMLTextAreaElement | null) => {
    (textareaRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
  };

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [message, textareaRef]);

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
    if (mentions.length > 0 && !hasSlashCommand(message)) {
      setMentions([]);
    }
  }, [message, mentions]);

  useEffect(() => {
    const hasContent = message.length > 0 || mentions.length > 0;
    // Only bump key when transitioning from content to completely empty
    // AND both message and mentions are empty (indicates a send/clear action)
    if (hadInputContentRef.current && !hasContent && message === "" && mentions.length === 0) {
      setMentionRootKey((key) => key + 1);
      setMentionOpen(false);
    }
    hadInputContentRef.current = hasContent;
  }, [message, mentions]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (mentionOpen && (e.key === "Enter" || e.key === "Tab")) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend && !isGenerating) onSendMessage();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const selected = Array.from(input.files ?? []);
    input.value = "";

    for (const file of selected) {
      if (!SUPPORTED_TYPES.includes(file.type)) {
        toast.error("Unsupported File Type", { duration: 3000 });
        return;
      }
      if (file.size > MAX_UPLOAD_SIZE) {
        toast.error("File Size Exceeded", { duration: 3000 });
        return;
      }
    }

    if (selected.length > 0) {
      setFiles((prev) => [...prev, ...selected]);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const actionBtn =
    "rounded-md p-2 transition-colors duration-200 disabled:opacity-40";

  return (
    <div className="z-10 mt-auto border-t border-white/8 bg-black/70 px-4 py-3.5 backdrop-blur-md">
      <div className="relative flex items-center rounded-xl border border-white/9 bg-white/4">
        <MentionRoot
          key={mentionRootKey}
          className="relative w-full [&_[data-tag]]:rounded-sm [&_[data-tag]]:bg-[rgba(0,200,83,0.18)] [&_[data-tag]]:text-transparent [&_[data-tag]:empty]:bg-transparent [&_[data-tag]]:[box-decoration-break:clone] [&_[data-tag]]:[-webkit-box-decoration-break:clone]"
          trigger="/"
          modal
          open={mentionOpen}
          onOpenChange={setMentionOpen}
          value={mentions}
          onValueChange={setMentions}
          inputValue={message}
          onInputValueChange={setMessage}
          disabled={isGenerating}
        >
          <MentionInput asChild onKeyDown={handleKeyDown}>
            <textarea
              ref={setTextareaRef}
              className="box-border max-h-50 min-h-12 w-full resize-none border-none bg-transparent py-3.5 pr-18 pl-2.5 text-white caret-current outline-none text-sm placeholder:text-white/40 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar]:bg-[#22222299] [&::-webkit-scrollbar-thumb]:bg-white/30"
              placeholder="Ask or type / for commands"
              value={message}
              rows={1}
              disabled={isGenerating}
            />
          </MentionInput>
          <div className="pointer-events-none absolute inset-x-0 top-auto bottom-[calc(100%+0.5rem)] z-50 [&>*]:pointer-events-auto">
            <MentionContent
              className="!static !inset-auto !w-full !transform-none box-border max-h-56 overflow-y-auto rounded-md border border-white/8 bg-[#101010]/96 p-1.5 shadow-lg backdrop-blur-md data-[state=closed]:hidden"
              avoidCollisions={false}
            >
              <p className="p-2 text-xs font-medium tracking-wider text-white/35 uppercase">
                Commands
              </p>
              {SLASH_COMMANDS.map(({ value, description }) => (
                <MentionItem
                  key={value}
                  className="group cursor-pointer rounded py-1 transition-colors duration-150 data-[highlighted]:bg-white/[0.06]"
                  value={value}
                  label={value}
                >
                  <div className="grid grid-cols-[5.25rem_1fr] items-baseline gap-x-3 px-2 py-1.5">
                    <span className="text-sm font-medium tracking-tight whitespace-nowrap text-white/90 group-data-[highlighted]:text-green-300">
                      /{value}
                    </span>
                    <span className="text-xs leading-snug text-white/40 group-data-[highlighted]:text-white/55">
                      {description}
                    </span>
                  </div>
                </MentionItem>
              ))}
            </MentionContent>
          </div>
        </MentionRoot>
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
