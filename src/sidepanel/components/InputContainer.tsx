import { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import type { InputContainerProps } from "../../types";

const InputContainer: React.FC<InputContainerProps> = ({
    isGenerating,
    isRecording,
    textareaRef,
    fileInputRef,
    message,
    files,
    setMessage,
    setFiles,
    onSpeechRecognition,
    onSendMessage,
    onStopGeneration,
}) => {
    const [showOptionsMenu, setShowOptionsMenu] = useState(false);
    const optionsMenuRef = useRef<HTMLDivElement>(null);
    const fileInputIconRef = useRef<HTMLButtonElement>(null);
    const microphoneIconRef = useRef<HTMLButtonElement>(null);
    const sendIconRef = useRef<HTMLButtonElement>(null);

    const SUPPORTED_TYPES = ["image/jpeg", "image/png", "image/gif", "text/plain", "application/pdf"];
    const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;

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

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (optionsMenuRef.current && !optionsMenuRef.current.contains(event.target as Node)) {
                setShowOptionsMenu(false);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        }
    }, []);

    const handleKeyDown = async (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSendMessage();
        }
    }

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
    }

    const removeFile = (index: number) => {
        setFiles((prev) => prev.filter((_, i) => i !== index));
    }

    const toggleOptionsMenu = () => {
        setShowOptionsMenu(!showOptionsMenu);
    }

    return (
        <div className="input-container">
            <div className="input-box">
                <div className="input-options-container" ref={optionsMenuRef}>
                    <button className="options-button" onClick={toggleOptionsMenu} title="Options">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <circle cx="12" cy="12" r="1"></circle>
                            <circle cx="12" cy="5" r="1"></circle>
                            <circle cx="12" cy="19" r="1"></circle>
                        </svg>
                    </button>

                    {showOptionsMenu && (
                        <div className="options-menu">
                            <div className="options-menu-item">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <circle cx="12" cy="12" r="3"></circle>
                                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                                </svg>
                                <span>Settings</span>
                            </div>
                            <div className="options-menu-item">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                                </svg>
                                <span>GPT-4</span>
                            </div>
                            <div className="options-menu-item">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                    <polyline points="15 3 21 3 21 9"></polyline>
                                    <line x1="10" y1="14" x2="21" y2="3"></line>
                                </svg>
                                <span>Share</span>
                            </div>
                            <div className="options-menu-item">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="12" y1="8" x2="12" y2="12"></line>
                                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                </svg>
                                <span>Help</span>
                            </div>
                        </div>
                    )}
                </div>

                <textarea
                    ref={textareaRef}
                    className="input-textarea"
                    placeholder="Type a message..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    disabled={!!(isGenerating || isRecording)}
                />
                <div className="input-buttons">
                    {isGenerating ? (
                        <button className="action-button stop-button" onClick={onStopGeneration} title="Stop generating">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <circle cx="12" cy="12" r="10"></circle>
                                <rect x="9" y="9" width="6" height="6"></rect>
                            </svg>
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
                                ref={fileInputIconRef}
                                className="action-button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={!!(isGenerating || isRecording)}
                                title="Attach files"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                                </svg>
                            </button>
                            {message === "" ? (
                                <button
                                    ref={microphoneIconRef}
                                    className="action-button"
                                    onClick={onSpeechRecognition}
                                    title="Microphone"
                                    disabled={!!(isGenerating || isRecording)}
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                                        <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                                        <line x1="12" y1="19" x2="12" y2="23"></line>
                                        <line x1="8" y1="23" x2="16" y2="23"></line>
                                    </svg>
                                </button>
                            ) : (
                                <button
                                    ref={sendIconRef}
                                    className="action-button send-button"
                                    onClick={onSendMessage}
                                    disabled={!!(isGenerating || isRecording)}
                                    title="Send"
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <line x1="22" y1="2" x2="11" y2="13"></line>
                                        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                                    </svg>
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
            {files.length > 0 && (
                <div id="file-preview-container">
                    {files.map((file, index) => (
                        <div key={`${file.name}-${index}`} className="input-file-preview">
                            {file.type.startsWith("image/") ? (
                                <img
                                    src={URL.createObjectURL(file) || "/placeholder.svg"}
                                    className="input-file-thubmnail"
                                    alt={file.name}
                                />
                            ) : (
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                                    <polyline points="13 2 13 9 20 9"></polyline>
                                </svg>
                            )}
                            <span className="input-file-preview-name" title={file.name}>
                                {file.name}
                            </span>
                            <span className="input-remove-file" onClick={() => removeFile(index)}>
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export default InputContainer;