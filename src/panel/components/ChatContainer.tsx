import { useEffect, useRef } from "react";
import RenderResponse from "./RenderResponse";
import { Copy, File, Repeat, X } from "lucide-react";
import type { ChatContainerProps, FileFormat } from "../../types";
import styles from "css/panel/ChatContainer.module.css";

const ChatContainer: React.FC<ChatContainerProps> = ({ hidden, messages, streaming, isGenerating, statusText, errorText, setErrorText }) => {
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
        <>
            {isGenerating && !hidden && (
                <div className={styles.statusBar}>
                    <div className={styles.statusIcon}></div>
                    <span className={styles.statusText}>{statusText}</span>
                </div>
            )}
            {errorText && !hidden && (
                <div className={styles.errorBar}>
                    <span className={styles.errorText}>{errorText}</span>
                    <button className={styles.errorCloseButton} onClick={() => setErrorText("")} title="Dismiss">
                        <X size={16} />
                    </button>
                </div>
            )}
            <div className={`${styles.chatContainer} ${hidden ? styles.hidden : ""}`} ref={chatContainerRef} style={{ paddingTop: hidden ? 0 : "1rem" }}>
                {messages.map(
                    (msg, index) => {
                        const isUser = msg.id.startsWith('user-');
                        const isLatest = index === messages.length - 1;
                        return (
                            <div key={index} className={`${styles.message} ${isUser ? styles.user : styles.assistant}`}>
                                {!isUser && (
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
                                <div className={styles.messageContent}>
                                    {isUser ? (
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
                                            <RenderResponse content={msg.content.text} isInitial={isLatest && streaming.response} isExecuting={isLatest && streaming.execution} isValidating={isLatest && streaming.validation} isSummary={isLatest && streaming.output} taskStatus={msg.content?.taskStatus} />
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
                            </div>
                        );
                    }
                )}
            </div>
        </>
    )
}

export default ChatContainer;