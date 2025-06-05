import { useEffect, useRef, useState } from "react";
import AccountMenu from "./AccountMenu";
import { Plus, User } from "lucide-react";
import type { HeaderProps } from "../../types";
import styles from "css/panel/Header.module.css";

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
        <header className={styles.header}>
            <div className={styles.headerLeft}>
                {!!!currentConversationId ? (
                    <a href="https://waffy.io" target="_blank" rel="noreferrer">
                        <img src="/assets/logo.svg" alt="Waffy Logo" className={styles.headerLogoImg} />
                    </a>
                ) : (
                    <button className={styles.newChatButton} onClick={onNewChat} title="New Chat">
                        <Plus />
                    </button>
                )}
            </div>

            {!!currentConversationId && (
                <div className={styles.headerCenter}>
                    <div className={styles.headerTitle}>{currentTitle}</div>
                </div>
            )}

            <div className={styles.headerRight}>
                <button
                    className={styles.accountButton}
                    title="Account"
                    onClick={() => setIsAccountMenuOpen(true)}
                >
                    <User />
                </button>
            </div>
            <AccountMenu isOpen={isAccountMenuOpen} onClose={() => setIsAccountMenuOpen(false)} accountMenuRef={accountMenuRef} />
        </header>
    )
}

export default Header;