import { useState } from "react";
import type { ModeSelectionProps } from "../../types";
import styles from "css/panel/ModeSelection.module.css";

const ModeSelection = ({ className, modes, current_mode, onModeChange }: ModeSelectionProps) => {
    const [activeOption, setActiveOption] = useState<string>(current_mode);

    const handleModeClick = (mode: string) => {
        setActiveOption(mode);
        onModeChange?.(mode);
    };

    return (
        <div className={`${styles.container} ${className || ""}`}>
            {modes.map((mode) => (
                <button
                    key={mode}
                    onClick={() => handleModeClick(mode)}
                    className={`${styles.button} ${activeOption === mode ? styles.active : styles.inactive}`}
                >
                    {mode.toUpperCase()}
                </button>
            ))}
        </div>
    )
}

export default ModeSelection;