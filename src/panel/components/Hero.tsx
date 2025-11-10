import SuggestedPromptButton from "./SuggestedPromptButton";
import { Files, Globe, Images, MessageSquare } from "lucide-react";
import type { HeroProps } from "../../types";
import styles from "css/panel/Hero.module.css";

const Hero: React.FC<HeroProps> = ({ hidden, onPromptClick }) => {
    const suggestedPrompts = [
        "What is in my screen",
        "Look for latest news on AI",
        "Summarize this page contents"
    ];

    return (
        <div className={`${styles.heroSection} ${hidden ? styles.hidden : ""}`}>
            <div className={styles.heroContent}>
                <h1 className={styles.heroTitle}>What can I do for you?</h1>

                <div className={styles.capabilitiesContainer}>
                    <div className={styles.capabilityItem}>
                        <div className={styles.capabilityIcon}>
                            <Globe />
                        </div>
                        <div className={styles.capabilityLabel}>Browse</div>
                    </div>

                    <div className={styles.capabilityItem}>
                        <div className={styles.capabilityIcon}>
                            <MessageSquare />
                        </div>
                        <div className={styles.capabilityLabel}>Chat</div>
                    </div>

                    <div className={styles.capabilityItem}>
                        <div className={styles.capabilityIcon}>
                            <Files />
                        </div>
                        <div className={styles.capabilityLabel}>Files</div>
                    </div>

                    <div className={styles.capabilityItem}>
                        <div className={styles.capabilityIcon}>
                            <Images />
                        </div>
                        <div className={styles.capabilityLabel}>Images</div>
                    </div>
                </div>
            </div>

            <div className={styles.suggestedPromptsContainer}>
                <h2 className={styles.suggestedPromptsTitle}>Try asking</h2>
                <div className={styles.suggestedPrompts}>
                    {suggestedPrompts.map((prompt, index) => (
                        <SuggestedPromptButton key={index} text={prompt} onClick={() => onPromptClick(prompt)} />
                    ))}
                </div>
            </div>
        </div>
    )
}

export default Hero;