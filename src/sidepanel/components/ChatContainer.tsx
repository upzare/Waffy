import { useEffect, useRef } from "react";
import RenderResponse from "../utils/RenderResponse";
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
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
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
                                src={URL.createObjectURL(file) || "/placeholder.svg"}
                                className="message-file-thubmnail"
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
                                src={URL.createObjectURL(file) || "/placeholder.svg"}
                                className="message-file-thubmnail"
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