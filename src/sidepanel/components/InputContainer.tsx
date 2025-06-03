import { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { CircleStop, EllipsisVertical, File, Info, Mic, Paperclip, Send, Settings, Share, X } from "lucide-react";
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

    const handleSettings = () => {
        chrome.runtime.openOptionsPage();
    }

    return (
        <div className="input-container">
            <div className="input-box">
                <div className="input-options-container" ref={optionsMenuRef}>
                    <button className="options-button" onClick={toggleOptionsMenu} title="Options">
                        <EllipsisVertical />
                    </button>

                    {showOptionsMenu && (
                        <div className="options-menu">
                            <div className="options-menu-item" onClick={() => handleSettings()}>
                                <Settings />
                                <span>Settings</span>
                            </div>
                            <div className="options-menu-item">
                                <Share />
                                <span>Share</span>
                            </div>
                            <div className="options-menu-item">
                                <Info />
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
                                ref={fileInputIconRef}
                                className="action-button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={!!(isGenerating || isRecording)}
                                title="Attach files"
                            >
                                <Paperclip />
                            </button>
                            {message === "" ? (
                                <button
                                    ref={microphoneIconRef}
                                    className="action-button"
                                    onClick={onSpeechRecognition}
                                    title="Microphone"
                                    disabled={!!(isGenerating || isRecording)}
                                >
                                    <Mic />
                                </button>
                            ) : (
                                <button
                                    ref={sendIconRef}
                                    className="action-button send-button"
                                    onClick={onSendMessage}
                                    disabled={!!(isGenerating || isRecording)}
                                    title="Send"
                                >
                                    <Send />
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
                                    src={URL.createObjectURL(file)}
                                    className="input-file-thubmnail"
                                    alt={file.name}
                                />
                            ) : (
                                <File />
                            )}
                            <span className="input-file-preview-name" title={file.name}>
                                {file.name}
                            </span>
                            <span className="input-remove-file" onClick={() => removeFile(index)}>
                                <X />
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export default InputContainer;