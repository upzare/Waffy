import SuggestedPrompt from "./SuggestedPrompt";
import type { HeroProps } from "../../types";

const Hero: React.FC<HeroProps> = ({ homeSection, onPromptClick }) => {
    const suggestedPrompts = [
        "Help me debug my CSS",
        "Explain how JavaScript work",
        "Generate a React component",
    ];

    return (
        <div className="welcome-section" ref={homeSection}>
            <div className="hero-content">
                <div className="hero-logo-container">
                    <img src="/logo.svg" alt="Waffy Logo" className="hero-logo" />
                    <div className="hero-logo-glow"></div>
                </div>

                {/* <h1 className="hero-title">WAFFY</h1>
        <p className="hero-subtitle">AI-Powered Web Assistant</p>

        <div className="hero-description">
          Your intelligent companion for web development, research, and content creation
        </div> */}

                {/* <div className="capabilities-container">
          <div className="capability-item">
            <div className="capability-icon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
            </div>
            <div className="capability-label">Chat</div>
          </div>

          <div className="capability-item">
            <div className="capability-icon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="2" y1="12" x2="22" y2="12"></line>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
              </svg>
            </div>
            <div className="capability-label">Web</div>
          </div>

          <div className="capability-item">
            <div className="capability-icon">
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
            </div>
            <div className="capability-label">Files</div>
          </div>

          <div className="capability-item">
            <div className="capability-icon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
            </div>
            <div className="capability-label">Images</div>
          </div>
        </div> */}
            </div>

            <div className="suggested-prompts-container">
                <h2 className="suggested-prompts-title">Try asking</h2>
                <div className="suggested-prompts">
                    {suggestedPrompts.map((prompt, index) => (
                        <SuggestedPrompt key={index} text={prompt} onClick={() => onPromptClick(prompt)} />
                    ))}
                </div>
            </div>
        </div>
    )
}

export default Hero;