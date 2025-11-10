import { useEffect, useRef } from "react";
import RenderResponse from "./RenderResponse";
import { Copy, File, Repeat } from "lucide-react";
import type { ChatContainerProps, FileFormat } from "../../types";
import styles from "css/panel/ChatContainer.module.css";

const ChatContainer: React.FC<ChatContainerProps> = ({ hidden, messages, isGenerating, statusText }) => {
    const chatContainerRef = useRef<HTMLDivElement>(null);

    const handleFileClick = async (file: FileFormat) => {
        const response = await fetch(`data:${file.payload.mimeType};base64,${file.payload.content}`);
        window.open(URL.createObjectURL(await response.blob()));
    }

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    return (
        <div className={`${styles.chatContainer} ${hidden ? styles.hidden : ""}`} ref={chatContainerRef} style={{ paddingTop: hidden || isGenerating ? 0 : "1rem" }}>
            {isGenerating && (
                <div className={styles.statusBar}>
                    <div className={styles.statusIcon}></div>
                    <span className={styles.statusText}>{statusText}</span>
                </div>
            )}
            {messages.map(
                (msg, index) =>
                    <div key={index} className={`${styles.message} ${msg.isError ? styles.error : msg.isUser ? styles.user : styles.assistant}`}>
                        {!msg.isUser && !msg.isError && (
                            <div className={styles.messageActionsContainer}>
                                <div className={styles.messageActions}>
                                    <button className={styles.messageActionButton} title="Retry">
                                        <Repeat size={16} />
                                    </button>
                                    <button className={styles.messageActionButton} title="Copy to clipboard">
                                        <Copy size={16} />
                                    </button>
                                </div>
                            </div>
                        )}
                        {msg.isError ? (
                            <div className={styles.messageContent}>
                                <RenderResponse content={msg.content.text} error={true} />
                            </div>
                        ) : (
                            <div className={styles.messageContent}>
                                {msg.isUser ? (
                                    <>
                                        {msg.content.text?.prompt}
                                        {msg.content.files && msg.content.files.length > 0 && (
                                            <>
                                                {msg.content.files.map((file: FileFormat, fileIndex: number) => (
                                                    <div
                                                        key={`${file.payload.name}-${fileIndex}`}
                                                        className={styles.messageFilePreview}
                                                        onClick={() => handleFileClick(file)}
                                                    >
                                                        {file.payload.mimeType.startsWith("image/") ? (
                                                            <img
                                                                src={`data:${file.payload.mimeType};base64,${file.payload.content}`}
                                                                className={styles.messageFileThubmnail}
                                                                alt={file.payload.name}
                                                            />
                                                        ) : (
                                                            <File />
                                                        )}
                                                        <span className={styles.messageFilePreviewName} title={file.payload.name}>
                                                            {file.payload.name}
                                                        </span>
                                                    </div>
                                                ))}
                                            </>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <RenderResponse content={msg.content.text} isInitial={msg.streaming?.response} isExecuting={msg.streaming?.execution} isValidating={msg.streaming?.validation} isSummary={msg.streaming?.output} taskStatus={msg.content?.taskStatus} />
                                        {msg.content.files && msg.content.files.length > 0 && (
                                            <>
                                                {msg.content.files.map((file: FileFormat, fileIndex: number) => (
                                                    <div
                                                        key={`${file.payload.name}-${fileIndex}`}
                                                        className={styles.messageFilePreview}
                                                        onClick={() => handleFileClick(file)}
                                                    >
                                                        {file.payload.mimeType.startsWith("image/") ? (
                                                            <img
                                                                src={`data:${file.payload.mimeType};base64,${file.payload.content}`}
                                                                className={styles.messageFileThubmnail}
                                                                alt={file.payload.name}
                                                            />
                                                        ) : (
                                                            <File />
                                                        )}
                                                        <span className={styles.messageFilePreviewName} title={file.payload.name}>
                                                            {file.payload.name}
                                                        </span>
                                                    </div>
                                                ))}
                                            </>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
            )}
        </div>
    )
}

export default ChatContainer;