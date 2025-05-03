import { useEffect, useRef } from "react";
import RenderResponse from "../utils/RenderResponse";
import { File, User } from "lucide-react";
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
                    !msg.isTool && (
                        <div key={index} className={`message ${msg.isError ? "error" : msg.isUser ? "user" : "assistant"}`}>
                            {!msg.isError && (
                                <div className="message-avatar">
                                    {msg.isUser ? (
                                        <User />
                                    ) : (
                                        <img src="/logo.svg" alt="Assistant Logo" />
                                    )}
                                </div>
                            )}
                            <div className="message-content">
                                {msg.isUser ? (
                                    <>
                                        {msg.content.text}
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
                                        <RenderResponse content={msg.content.text} />
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
                                        {msg.isStreaming && (
                                            <div className="loading-indicator">
                                                <span></span>
                                                <span></span>
                                                <span></span>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    )
            )}
        </div>
    )
}

export default ChatContainer;