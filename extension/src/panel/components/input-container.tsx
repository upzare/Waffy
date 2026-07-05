import { useEffect } from "react";
import toast from "react-hot-toast";
import { CircleStop, File, Paperclip, Send, X } from "lucide-react";
import type { InputContainerProps } from "../../types";
import styles from "css/panel/input-container.module.css";

const InputContainer: React.FC<InputContainerProps> = ({
  isGenerating,
  textareaRef,
  fileInputRef,
  message,
  files,
  setMessage,
  setFiles,
  onSendMessage,
  onStopGeneration,
}) => {
  const SUPPORTED_TYPES = ["image/jpeg", "image/png", "image/gif", "text/plain", "application/pdf"];
  const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;
  const canSend = message.trim().length > 0 || files.length > 0;

  useEffect(() => {
    if (textareaRef.current) textareaRef.current.focus();
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
      textareaRef.current.focus();
    }
  }, [message]);

  const handleKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend && !isGenerating) onSendMessage();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      if (Array.from(e.target.files).every((file) => SUPPORTED_TYPES.includes(file.type))) {
        if (Array.from(e.target.files).every((file) => file.size <= MAX_UPLOAD_SIZE)) {
          const newFiles = Array.from(e.target.files);
          setFiles((prev) => [...prev, ...newFiles]);
        } else {
          toast.error("File Size Exceeded", { duration: 3000 });
        }
      } else {
        toast.error("Unsupported File Type", { duration: 3000 });
      }
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className={styles.inputContainer}>
      <div className={styles.inputBox}>
        <textarea
          ref={textareaRef}
          className={styles.inputTextarea}
          placeholder="Tell me something..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={isGenerating}
        />
        <div className={styles.inputButtons}>
          {isGenerating ? (
            <button
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
                style={{ display: "none" }}
                multiple
                accept={SUPPORTED_TYPES.join(",")}
                onChange={handleFileUpload}
              />
              <button
                className={styles.actionButton}
                onClick={() => fileInputRef.current?.click()}
                disabled={isGenerating}
                title="Attach files"
              >
                <Paperclip />
              </button>
              <button
                className={`${styles.actionButton} ${styles.sendButton}`}
                onClick={onSendMessage}
                disabled={!canSend || isGenerating}
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
              {file.type.startsWith("image/") ? (
                <img
                  src={URL.createObjectURL(file)}
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
};

export default InputContainer;
