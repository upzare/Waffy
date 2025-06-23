import { useEffect, useRef } from "react";
import RenderResponse from "../utils/RenderResponse";
import { Copy, File, Repeat, User } from "lucide-react";
import type { ChatContainerProps } from "../../types";
import styles from "css/panel/ChatContainer.module.css";

const ChatContainer: React.FC<ChatContainerProps> = ({ messages }) => {
    const chatContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    return (
        <div className={styles.chatContainer} ref={chatContainerRef}>
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
                            <>
                                <div className={styles.messageAvatar}>
                                    {msg.isUser ? (
                                        <User />
                                    ) : (
                                        <img src="/assets/logo.svg" alt="Assistant Logo" />
                                    )}
                                </div>
                                <div className={styles.messageContent}>
                                    {msg.isUser ? (
                                        <>
                                            {msg.content.text?.t0}
                                            {msg.content.files && msg.content.files.length > 0 && (
                                                <>
                                                    {msg.content.files.map((file: File, fileIndex: number) => (
                                                        <div
                                                            key={`${file.name}-${fileIndex}`}
                                                            className={styles.messageFilePreview}
                                                            onClick={() => window.open(URL.createObjectURL(file))}
                                                        >
                                                            {file.type.startsWith("image/") ? (
                                                                <img
                                                                    src={URL.createObjectURL(file)}
                                                                    className={styles.messageFileThubmnail}
                                                                    alt={file.name}
                                                                />
                                                            ) : (
                                                                <File />
                                                            )}
                                                            <span className={styles.messageFilePreviewName} title={file.name}>
                                                                {file.name}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <RenderResponse content={msg.content.text} isInitial={msg.streaming?.t1} isExecuting={msg.streaming?.t2} isValidating={msg.streaming?.t3} isSummary={msg.streaming?.t4} taskOK={msg.content?.taskOK} />
                                            {msg.content.files && msg.content.files.length > 0 && (
                                                <>
                                                    {msg.content.files.map((file: File, fileIndex: number) => (
                                                        <div
                                                            key={`${file.name}-${fileIndex}`}
                                                            className={styles.messageFilePreview}
                                                            onClick={() => window.open(URL.createObjectURL(file))}
                                                        >
                                                            {file.type.startsWith("image/") ? (
                                                                <img
                                                                    src={URL.createObjectURL(file)}
                                                                    className={styles.messageFileThubmnail}
                                                                    alt={file.name}
                                                                />
                                                            ) : (
                                                                <File />
                                                            )}
                                                            <span className={styles.messageFilePreviewName} title={file.name}>
                                                                {file.name}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </>
                                            )}
                                        </>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
            )}
        </div>
    )
}

export default ChatContainer;