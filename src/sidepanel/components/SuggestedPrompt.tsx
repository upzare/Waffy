import { useEffect, useRef } from 'react';
import type { SuggestedPromptProps } from "../../types";

const SuggestedPrompt: React.FC<SuggestedPromptProps> = ({ text, onClick }) => {
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
        }
    }, []);

    return (
        <button ref={buttonRef} type="button" className="suggested-prompt-button" onClick={onClick}>
            <strong className="suggested-prompt-text">{text}</strong>
            <div className="suggested-prompt-bg">
                <div className="suggested-prompt-bg-stars"></div>
            </div>
            <div className="suggested-prompt-glow">
                <div className="suggested-prompt-circle"></div>
                <div className="suggested-prompt-circle"></div>
            </div>
        </button>
    );
}

export default SuggestedPrompt;