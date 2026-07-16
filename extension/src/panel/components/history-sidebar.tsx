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
    <div
      className={`fixed top-0 w-72 h-screen bg-[rgba(10,10,10,0.9)] backdrop-blur-[10px] border-l border-border transition-[right] duration-300 ease-in-out z-1000 flex flex-col overflow-hidden ${visible ? "right-0" : "right-[-300px]"
        }`}
    >
      <div className="p-4 border-b border-border">
        <h3 className="m-0 text-lg text-white">Conversation History</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {conversations.length === 0 ? (
          <div className="p-4 text-center text-[rgba(255,255,255,0.5)]">No conversation history</div>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.id}
              className={`flex items-center justify-between p-3 rounded-md mb-2 transition-all duration-200 cursor-pointer ${conv.id === currentConversationId
                ? "bg-[rgba(0,200,83,0.1)] border-l-[3px] border-l-[rgba(0,200,83,0.7)]"
                : "bg-[rgba(255,255,255,0.05)] hover:bg-border"
                }`}
              onClick={() => onSelectConversation(conv.id)}
            >
              <div className="flex-1 overflow-hidden">
                <span
                  className="block text-sm whitespace-nowrap overflow-hidden text-ellipsis"
                  title={conv.title}
                >
                  {conv.title}
                </span>
                <span className="block text-xs text-[rgba(255,255,255,0.5)] uppercase">
                  {new Date(conv.timestamp).toLocaleString(undefined, {
                    month: "numeric",
                    day: "numeric",
                    year: "2-digit",
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                  })}
                </span>
              </div>
              <button
                className="bg-transparent border-none p-2 cursor-pointer opacity-60 transition-[opacity,color] duration-200 text-[rgba(255,255,255,0.7)] hover:opacity-100 hover:text-[rgba(255,70,70,0.9)]"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveConversation(conv.id);
                }}
                title="Delete conversation"
              >
                <Trash2 className="w-3.5 h-3.5 stroke-current" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default HistorySidebar;
