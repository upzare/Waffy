import type { HeaderProps } from "../../types";

const Header: React.FC<HeaderProps> = ({ currentTitle, isNewChat, onNewChat }) => {
    return (
        <header className="header">
            <div className="header-left">
                {isNewChat ? (
                    <a href="https://waffy.io" target="_blank" rel="noreferrer">
                        <img src="/logo.svg" alt="Waffy Logo" className="header-logo-img" />
                    </a>
                ) : (
                    <button className="new-chat-button" onClick={onNewChat} title="New Chat">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                    </button>
                )}
            </div>

            {!isNewChat && (
                <div className="header-center">
                    <div className="header-title">{currentTitle}</div>
                </div>
            )}

            <div className="header-right">
                <button className="account-button" title="Account">
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
                </button>
            </div>
        </header >
    )
}

export default Header;