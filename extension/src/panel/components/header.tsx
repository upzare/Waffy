import { Plus, Settings } from "lucide-react";
import type { HeaderProps } from "../../types";
import styles from "css/panel/header.module.css";

const Header: React.FC<HeaderProps> = ({ currentConversationId, currentTitle, onNewChat }) => {
  const openSettings = () => {
    chrome.runtime.openOptionsPage();
  };

  return (
    <header className={styles.header}>
      <div className={styles.headerLeft}>
        {!!!currentConversationId ? (
          <img src="/assets/logo.svg" alt="Waffy Logo" className={styles.headerLogoImg} />
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
        <button className={styles.accountButton} title="Settings" onClick={openSettings}>
          <Settings />
        </button>
      </div>
    </header>
  );
};

export default Header;
