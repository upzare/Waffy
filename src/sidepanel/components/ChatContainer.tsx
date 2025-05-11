import { useEffect, useRef, useState } from "react";
import RenderResponse from "../utils/RenderResponse";
import { Copy, File, Repeat, User } from "lucide-react";
import type { ChatContainerProps } from "../../types";

const ChatContainer: React.FC<ChatContainerProps> = ({ messages }) => {
    const chatContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    return (
        <div className="chat-container" ref={chatContainerRef}>
            {messages.map(
                (msg, index) =>
                    <div key={index} className={`message ${msg.isError ? "error" : msg.isUser ? "user" : "assistant"}`}>
                        {!msg.isUser && !msg.isError && (
                            <div className="message-actions-container">
                                <div className="message-actions">
                                    <button className="message-action-button" title="Retry">
                                        <Repeat size={16} />
                                    </button>
                                    <button className="message-action-button" title="Copy to clipboard">
                                        <Copy size={16} />
                                    </button>
                                </div>
                            </div>
                        )}
                        {msg.isError ? (
                            <div className="message-content">
                                <RenderResponse content={msg.content.text} error={true} />
                            </div>
                        ) : (
                            <>
                                <div className="message-avatar">
                                    {msg.isUser ? (
                                        <User />
                                    ) : (
                                        <img src="/logo.svg" alt="Assistant Logo" />
                                    )}
                                </div>
                                <div className="message-content">
                                    {msg.isUser ? (
                                        <>
                                            {msg.content.text?.t0}
                                            {msg.content.files && msg.content.files.length > 0 && (
                                                <>
                                                    {msg.content.files.map((file: File, fileIndex: number) => (
                                                        <div
                                                            key={`${file.name}-${fileIndex}`}
                                                            className="message-file-preview"
                                                            onClick={() => window.open(URL.createObjectURL(file))}
                                                        >
                                                            {file.type.startsWith("image/") ? (
                                                                <img
                                                                    src={URL.createObjectURL(file)}
                                                                    className="message-file-thubmnail"
                                                                    alt={file.name}
                                                                />
                                                            ) : (
                                                                <File />
                                                            )}
                                                            <span className="message-file-preview-name" title={file.name}>
                                                                {file.name}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <RenderResponse content={msg.content.text} isInitial={msg.streaming?.t1} isPlanning={msg.streaming?.t2} isExecuting={msg.streaming?.t3} isSummary={msg.streaming?.t4} />
                                            {msg.content.files && msg.content.files.length > 0 && (
                                                <>
                                                    {msg.content.files.map((file: File, fileIndex: number) => (
                                                        <div
                                                            key={`${file.name}-${fileIndex}`}
                                                            className="message-file-preview"
                                                            onClick={() => window.open(URL.createObjectURL(file))}
                                                        >
                                                            {file.type.startsWith("image/") ? (
                                                                <img
                                                                    src={URL.createObjectURL(file)}
                                                                    className="message-file-thubmnail"
                                                                    alt={file.name}
                                                                />
                                                            ) : (
                                                                <File />
                                                            )}
                                                            <span className="message-file-preview-name" title={file.name}>
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