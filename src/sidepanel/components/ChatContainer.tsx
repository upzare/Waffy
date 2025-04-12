import { useEffect, useRef } from 'react';
import { ChatContainerProps } from '../../types';
import RenderResponse from '../utils/RenderResponse';

const ChatContainer: React.FC<ChatContainerProps> = ({
    messages
}) => {
    const chatContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    return (
        <div className="chat-container" ref={chatContainerRef}>
            {messages.map((msg, index) => (
                !msg.isTool &&
                <div key={index} className={`message ${msg.isError ? "error" : msg.isUser ? "user" : "assistant"}`}>
                    {!msg.isError &&
                        <div className="message-avatar">
                            {msg.isUser ? (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="M224 256A128 128 0 1 0 224 0a128 128 0 1 0 0 256zm-45.7 48C79.8 304 0 383.8 0 482.3C0 498.7 13.3 512 29.7 512l388.6 0c16.4 0 29.7-13.3 29.7-29.7C448 383.8 368.2 304 269.7 304l-91.4 0z" /></svg>) : (<img src="logo.svg" alt="Assistant Logo" />)}
                        </div>}
                    <div className="message-content">
                        {msg.isUser ? (
                            <>
                                {msg.content.text}
                                {msg.content.files && msg.content.files.length > 0 && (
                                    <>
                                        {msg.content.files.map((file) => (
                                                <div key={`${file.name}-${index}`} className="message-file-preview" onClick={() => window.open(URL.createObjectURL(file))}>
                                                    {file.type.startsWith("image/") ? (
                                                        <img
                                                            src={URL.createObjectURL(file)}
                                                            className="message-file-thubmnail"
                                                            alt={file.name}
                                                        />
                                                    ) : (
                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><path d="M0 64C0 28.7 28.7 0 64 0L224 0l0 128c0 17.7 14.3 32 32 32l128 0 0 288c0 35.3-28.7 64-64 64L64 512c-35.3 0-64-28.7-64-64L0 64zm384 64l-128 0L256 0 384 128z" /></svg>
                                                    )}
                                                    <span className="message-file-preview-name" title={file.name}>{file.name}</span>
                                                </div>
                                            )
                                        )}
                                    </>
                                )}
                            </>
                        ) : (
                            <>
                                <RenderResponse content={msg.content.text} />
                                {msg.content.files && msg.content.files.length > 0 && (
                                    <>
                                        {msg.content.files.map((file) => (
                                                <div key={`${file.name}-${index}`} className="message-file-preview" onClick={() => window.open(URL.createObjectURL(file))}>
                                                    {file.type.startsWith("image/") ? (
                                                        <img
                                                            src={URL.createObjectURL(file)}
                                                            className="message-file-thubmnail"
                                                            alt={file.name}
                                                        />
                                                    ) : (
                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><path d="M0 64C0 28.7 28.7 0 64 0L224 0l0 128c0 17.7 14.3 32 32 32l128 0 0 288c0 35.3-28.7 64-64 64L64 512c-35.3 0-64-28.7-64-64L0 64zm384 64l-128 0L256 0 384 128z" /></svg>
                                                    )}
                                                    <span className="message-file-preview-name" title={file.name}>{file.name}</span>
                                                </div>
                                            )
                                        )}
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
            ))}
        </div>
    )
}

export default ChatContainer;