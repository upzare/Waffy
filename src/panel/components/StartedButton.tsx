import styles from "css/panel/StartedButton.module.css";

interface StartedButtonProps {
    className?: string;
    text: string;
    onClick: () => void;
}

export default function Login({ className, text, onClick }: StartedButtonProps) {
    return (
        <div className={className}>
            <main className={styles.container}>
                <button onClick={onClick}>
                    <div>
                        <span>{text}</span>
                    </div>
                </button>
            </main>
        </div>
    )
}