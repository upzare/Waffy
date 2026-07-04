import SuggestedPromptButton from "./suggested-prompt-button";
import { BookOpen, Bot, Globe, MessageSquare } from "lucide-react";
import type { HeroProps } from "../../types";
import styles from "css/panel/hero.module.css";

const Hero: React.FC<HeroProps> = ({ hidden, pinnedPrompts, onPromptClick }) => {
    const suggestedPrompts = pinnedPrompts.filter((prompt) => prompt.trim().length > 0);

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
                            <BookOpen />
                        </div>
                        <div className={styles.capabilityLabel}>Research</div>
                    </div>

                    <div className={styles.capabilityItem}>
                        <div className={styles.capabilityIcon}>
                            <Bot />
                        </div>
                        <div className={styles.capabilityLabel}>Automate</div>
                    </div>

                    <div className={styles.capabilityItem}>
                        <div className={styles.capabilityIcon}>
                            <MessageSquare />
                        </div>
                        <div className={styles.capabilityLabel}>Chat</div>
                    </div>
                </div>
            </div>

            {suggestedPrompts.length > 0 && (
                <div className={styles.suggestedPromptsContainer}>
                    <h2 className={styles.suggestedPromptsTitle}>Try asking</h2>
                    <div className={styles.suggestedPrompts}>
                        {suggestedPrompts.map((prompt, index) => (
                            <SuggestedPromptButton key={index} text={prompt} onClick={() => onPromptClick(prompt)} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

export default Hero;