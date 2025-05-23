import { useEffect, useRef, useState } from "react";
import AccountMenu from "./AccountMenu";
import { Plus, User } from "lucide-react";
import type { HeaderProps } from "../../types";

const Header: React.FC<HeaderProps> = ({ currentConversationId, currentTitle, onNewChat }) => {
    const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
    const accountMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
                setIsAccountMenuOpen(false);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        }
    }, []);

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
                <button
                    className="account-button"
                    title="Account"
                    onClick={() => setIsAccountMenuOpen(true)}
                >
                    <User />
                </button>
            </div>
            <AccountMenu isOpen={isAccountMenuOpen} onClose={() => setIsAccountMenuOpen(false)} accountMenuRef={accountMenuRef} />
        </header >
    )
}

export default Header;