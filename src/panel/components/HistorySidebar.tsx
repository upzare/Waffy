import { Trash2 } from "lucide-react";
import type { HistorySidebarProps } from "../../types";
import styles from "css/panel/HistorySidebar.module.css";

const HistorySidebar: React.FC<HistorySidebarProps> = ({
    conversations,
    visible,
    onSelectConversation,
    onRemoveConversation,
    currentConversationId,
}) => {
    return (
        <div className={`${styles.historySidebar} ${visible ? styles.visible : ""}`}>
            <div className={styles.historyHeader}>
                <h3>Conversation History</h3>
            </div>
            <div className={styles.historyList}>
                {conversations.length === 0 ? (
                    <div className={styles.noHistory}>No conversation history</div>
                ) : (
                    conversations.map((conv) => (
                        <div 
                            key={conv.id} 
                            className={`${styles.historyItem} ${conv.id === currentConversationId ? styles.active : ""}`} 
                            onClick={() => onSelectConversation(conv.id)}
                        >
                            <div className={styles.historyItemContent}>
                                <span className={styles.historyItemTitle} title={conv.title}>{conv.title}</span>
                                <span className={styles.historyItemDate}>{new Date(conv.timestamp).toLocaleDateString()}</span>
                            </div>
                            <button
                                className={styles.historyItemDelete}
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