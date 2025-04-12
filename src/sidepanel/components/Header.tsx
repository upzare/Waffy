import { useState, useRef, useEffect } from 'react';
import { HeaderProps } from '../../types';

const Header: React.FC<HeaderProps> = ({
    models,
    currentModel,
    currentTitle,
    conversations,
    conversationID,
    isNewChat,
    onNewChat,
    onSelectConversation,
    onSelectModel,
    onItemRemove,
}) => {
    const [showConversations, setShowConversations] = useState(false);
    const [showModels, setShowModels] = useState(false);

    const conversationsRef = useRef<HTMLDivElement>(null);
    const modelsRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (conversationsRef.current && !conversationsRef.current.contains(event.target as Node)) {
                setShowConversations(false);
            }
            if (modelsRef.current && !modelsRef.current.contains(event.target as Node)) {
                setShowModels(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <header className="header">
            {!isNewChat && (
                <button
                    className="new-chat-button"
                    onClick={onNewChat}
                    title="New Chat"
                >
                    <svg className="ml-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="M256 80c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 144L48 224c-17.7 0-32 14.3-32 32s14.3 32 32 32l144 0 0 144c0 17.7 14.3 32 32 32s32-14.3 32-32l0-144 144 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-144 0 0-144z" /></svg>
                </button>
            )}
            <div
                className={`title-container ${isNewChat ? "full-width" : ""}`}
                ref={conversationsRef}
            >
                <div
                    className="current-title"
                    onClick={() => setShowConversations(!showConversations)}
                    title="Conversations"
                >
                    <div className="title-content">
                        <span className="title-text">{currentTitle}</span>
                        {showConversations ? <svg className="mc-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M233.4 105.4c12.5-12.5 32.8-12.5 45.3 0l192 192c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L256 173.3 86.6 342.6c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3l192-192z" /></svg> : <svg className="ml-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M233.4 406.6c12.5 12.5 32.8 12.5 45.3 0l192-192c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L256 338.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l192 192z" /></svg>}
                    </div>
                </div>
                {showConversations && (
                    <div className="conversations-dropdown">
                        {conversations.sort((a: any, b: any) => b.timestamp - a.timestamp).map((conv) => (
                            <div
                                key={conv.id}
                                className={`conversation-item ${conv.id === conversationID.current ? "active" : ""}`}
                            >
                                <div
                                    className="conversation-item-content"
                                    onClick={() => {
                                        onSelectConversation(conv.id);
                                        setShowConversations(false);
                                    }}
                                >
                                    <span className="conversation-item-title" title={conv.title}>{conv.title}</span>
                                </div>
                                <div className="conversation-item-delete" title="Delete Converstaion">
                                    <svg onClick={() => {
                                        setShowConversations(false);
                                        onItemRemove(conv.id)
                                    }}
                                        xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="M135.2 17.7C140.6 6.8 151.7 0 163.8 0L284.2 0c12.1 0 23.2 6.8 28.6 17.7L320 32l96 0c17.7 0 32 14.3 32 32s-14.3 32-32 32L32 96C14.3 96 0 81.7 0 64S14.3 32 32 32l96 0 7.2-14.3zM32 128l384 0 0 320c0 35.3-28.7 64-64 64L96 512c-35.3 0-64-28.7-64-64l0-320zm96 64c-8.8 0-16 7.2-16 16l0 224c0 8.8 7.2 16 16 16s16-7.2 16-16l0-224c0-8.8-7.2-16-16-16zm96 0c-8.8 0-16 7.2-16 16l0 224c0 8.8 7.2 16 16 16s16-7.2 16-16l0-224c0-8.8-7.2-16-16-16zm96 0c-8.8 0-16 7.2-16 16l0 224c0 8.8 7.2 16 16 16s16-7.2 16-16l0-224c0-8.8-7.2-16-16-16z" />
                                    </svg>
                                </div>
                            </div>
                        ))}
                        {conversations.length === 0 && (
                            <div className="no-conversations">No previous conversations</div>
                        )}
                    </div>
                )}
            </div>
            <div
                className="model-selector"
                ref={modelsRef}
            >
                <button
                    title="Select Model"
                    className="model-button"
                    onClick={() => setShowModels(!showModels)}
                >
                    <svg className="mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M176 24c0-13.3-10.7-24-24-24s-24 10.7-24 24l0 40c-35.3 0-64 28.7-64 64l-40 0c-13.3 0-24 10.7-24 24s10.7 24 24 24l40 0 0 56-40 0c-13.3 0-24 10.7-24 24s10.7 24 24 24l40 0 0 56-40 0c-13.3 0-24 10.7-24 24s10.7 24 24 24l40 0c0 35.3 28.7 64 64 64l0 40c0 13.3 10.7 24 24 24s24-10.7 24-24l0-40 56 0 0 40c0 13.3 10.7 24 24 24s24-10.7 24-24l0-40 56 0 0 40c0 13.3 10.7 24 24 24s24-10.7 24-24l0-40c35.3 0 64-28.7 64-64l40 0c13.3 0 24-10.7 24-24s-10.7-24-24-24l-40 0 0-56 40 0c13.3 0 24-10.7 24-24s-10.7-24-24-24l-40 0 0-56 40 0c13.3 0 24-10.7 24-24s-10.7-24-24-24l-40 0c0-35.3-28.7-64-64-64l0-40c0-13.3-10.7-24-24-24s-24 10.7-24 24l0 40-56 0 0-40c0-13.3-10.7-24-24-24s-24 10.7-24 24l0 40-56 0 0-40zM160 128l192 0c17.7 0 32 14.3 32 32l0 192c0 17.7-14.3 32-32 32l-192 0c-17.7 0-32-14.3-32-32l0-192c0-17.7 14.3-32 32-32zm192 32l-192 0 0 192 192 0 0-192z" /></svg>
                </button>
                {showModels && (
                    <div className="models-dropdown">
                        {models.length == 0 ? <div className="no-models">No models available to use</div> : models.map((model) => (
                            <div
                                key={model.id}
                                className={`model-item ${currentModel === model.id ? "active" : ""}`}
                                onClick={() => {
                                    onSelectModel(model.id);
                                    setShowModels(false);
                                }}
                            >
                                <div className="model-info">
                                    <span className="model-name">{model.name}</span>
                                    <span className="model-description">{model.description}</span>
                                </div>
                                {currentModel === model.id && (
                                    <svg className="mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="M438.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L160 338.7 393.4 105.4c12.5-12.5 32.8-12.5 45.3 0z" /></svg>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </header>
    );
};

export default Header;