import { Trash2 } from "lucide-react";
import type { HistorySidebarProps } from "../../types";

const HistorySidebar: React.FC<HistorySidebarProps> = ({
    conversations,
    visible,
    onSelectConversation,
    onRemoveConversation,
    currentConversationId,
}) => {
    return (
        <div className={`history-sidebar ${visible ? "visible" : ""}`}>
            <div className="history-header">
                <h3>Conversation History</h3>
            </div>
            <div className="history-list">
                {conversations.length === 0 ? (
                    <div className="no-history">No conversation history</div>
                ) : (
                    conversations.map((conv) => (
                        <div key={conv.id} className={`history-item ${conv.id === currentConversationId ? "active" : ""}`} onClick={() => onSelectConversation(conv.id)}>
                            <div className="history-item-content">
                                <span className="history-item-title" title={conv.title}>{conv.title}</span>
                                <span className="history-item-date">{new Date(conv.timestamp).toLocaleDateString()}</span>
                            </div>
                            <button
                                className="history-item-delete"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRemoveConversation(conv.id)
                                }}
                                title="Delete conversation"
                            >
                                <Trash2 />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}

export default HistorySidebar;