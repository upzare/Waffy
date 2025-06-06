import { useEffect, useRef } from 'react';
import type { SuggestedPromptProps } from "../../types";
import styles from "css/panel/SuggestedPromptButton.module.css"

const SuggestedPromptButton: React.FC<SuggestedPromptProps> = ({ text, onClick }) => {
    const buttonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (buttonRef.current) {
            const colors = getComputedStyle(document.documentElement)
                .getPropertyValue('--gradient-colors')
                .split(',')
                .map(color => color.trim());

            const shuffledColors = [...colors].sort(() => Math.random() - 0.5);
            buttonRef.current.style.setProperty('--color-1', shuffledColors[0]);
            buttonRef.current.style.setProperty('--color-2', shuffledColors[1]);
            buttonRef.current.style.setProperty('--color-3', shuffledColors[2]);
            buttonRef.current.style.setProperty('--color-4', shuffledColors[3]);
            buttonRef.current.style.setProperty('--color-5', shuffledColors[4]);
            buttonRef.current.style.setProperty('--color-6', shuffledColors[5]);
        }
    }, []);

    return (
        <button ref={buttonRef} type="button" className={styles.suggestedPromptButton} onClick={onClick}>
            <strong className={styles.suggestedPromptText}>{text}</strong>
            <div className={styles.suggestedPromptBg}>
                <div className={styles.suggestedPromptBgStars}></div>
            </div>
            <div className={styles.suggestedPromptGlow}>
                <div className={styles.suggestedPromptCircle}></div>
                <div className={styles.suggestedPromptCircle}></div>
            </div>
        </button>
    );
}

export default SuggestedPromptButton;