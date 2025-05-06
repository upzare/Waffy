import { Plus, User } from "lucide-react";
import type { HeaderProps } from "../../types";

const Header: React.FC<HeaderProps> = ({ currentConversationId, currentTitle, onNewChat }) => {
    return (
        <header className="header">
            <div className="header-left">
                {!!!currentConversationId ? (
                    <a href="https://waffy.io" target="_blank" rel="noreferrer">
                        <img src="/logo.svg" alt="Waffy Logo" className="header-logo-img" />
                    </a>
                ) : (
                    <button className="new-chat-button" onClick={onNewChat} title="New Chat">
                        <Plus />
                    </button>
                )}
            </div>

            {!!currentConversationId && (
                <div className="header-center">
                    <div className="header-title">{currentTitle}</div>
                </div>
            )}

            <div className="header-right">
                <button className="account-button" title="Account">
                    <User />
                </button>
            </div>
        </header >
    )
}

export default Header;