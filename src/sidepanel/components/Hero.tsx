import SuggestedPrompt from "./SuggestedPrompt";
import type { HeroProps } from "../../types";
import { Files, Globe, Images, MessageSquare } from "lucide-react";

const Hero: React.FC<HeroProps> = ({ homeSection, onPromptClick }) => {
    const suggestedPrompts = [
        "Help me debug my CSS",
        "Explain how JavaScript work",
        "Generate a React component",
    ];

    return (
        <div className="hero-section" ref={homeSection}>
            <div className="hero-content">
                <h1 className="hero-title">What can I do for you?</h1>

                <div className="capabilities-container">
                    <div className="capability-item">
                        <div className="capability-icon">
                            <Globe />
                        </div>
                        <div className="capability-label">Browse</div>
                    </div>

                    <div className="capability-item">
                        <div className="capability-icon">
                            <MessageSquare />
                        </div>
                        <div className="capability-label">Chat</div>
                    </div>

                    <div className="capability-item">
                        <div className="capability-icon">
                            <Files />
                        </div>
                        <div className="capability-label">Files</div>
                    </div>

                    <div className="capability-item">
                        <div className="capability-icon">
                            <Images />
                        </div>
                        <div className="capability-label">Images</div>
                    </div>
                </div>
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