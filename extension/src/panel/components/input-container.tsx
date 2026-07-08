import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { CircleStop, File, Paperclip, Send, X } from "lucide-react";
import { MentionRoot, MentionInput, MentionContent, MentionItem } from "@diceui/mention";
import type { InputContainerProps } from "../../types";
import { hasSlashCommand, SLASH_COMMANDS } from "../utils/slash-commands";
import styles from "css/panel/input-container.module.css";

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

  return (
    <div className={styles.inputContainer}>
      <div className={styles.inputBox}>
        <MentionRoot
          className={styles.mentionRoot}
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
              className={styles.inputTextarea}
              placeholder="Ask or type / for commands"
              value={message}
              rows={1}
              disabled={isGenerating}
            />
          </MentionInput>
          <div className={styles.mentionAnchor}>
            <MentionContent className={styles.mentionContent} avoidCollisions={false}>
              <p className={styles.mentionMenuLabel}>Commands</p>
              {SLASH_COMMANDS.map(({ value, description }) => (
                <MentionItem key={value} className={styles.mentionItem} value={value} label={value}>
                  <div className={styles.mentionItemBody}>
                    <span className={styles.mentionItemCommand}>/{value}</span>
                    <span className={styles.mentionItemDescription}>{description}</span>
                  </div>
                </MentionItem>
              ))}
            </MentionContent>
          </div>
        </MentionRoot>
        <div className={styles.inputButtons}>
          {isGenerating ? (
            <button
              type="button"
              className={`${styles.actionButton} ${styles.stopButton}`}
              onClick={onStopGeneration}
              title="Stop generating"
            >
              <CircleStop />
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
                className={styles.actionButton}
                onClick={() => fileInputRef.current?.click()}
                title="Attach files"
              >
                <Paperclip />
              </button>
              <button
                type="button"
                className={`${styles.actionButton} ${styles.sendButton}`}
                onClick={onSendMessage}
                disabled={!canSend}
                title="Send"
              >
                <Send />
              </button>
            </>
          )}
        </div>
      </div>
      {files.length > 0 && (
        <div className={styles.filePreviewContainer}>
          {files.map((file, index) => (
            <div key={`${file.name}-${index}`} className={styles.inputFilePreview}>
              {filePreviews[index] ? (
                <img
                  src={filePreviews[index]}
                  className={styles.inputFileThubmnail}
                  alt={file.name}
                />
              ) : (
                <File />
              )}
              <span className={styles.inputFilePreviewName} title={file.name}>
                {file.name}
              </span>
              <span className={styles.inputRemoveFile} onClick={() => removeFile(index)}>
                <X />
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default InputContainer;
