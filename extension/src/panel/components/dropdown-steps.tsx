import { useEffect, useRef } from "react";
import styles from "css/panel/dropdown-steps.module.css";

export const DropdownSteps = ({ steps, isExecuting = false }: { steps: string[], isExecuting?: boolean }) => {
    const stepRefs = useRef<(HTMLDivElement | null)[]>([]);
    const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

    useEffect(() => {
        const updateLineHeights = () => {
            stepRefs.current.forEach((stepElement, index) => {
                if (!stepElement || index >= steps.length - 1) return;

                const lineElement = lineRefs.current[index];
                if (!lineElement) return;

                const stepHeight = stepElement.offsetHeight;
                const lineHeight = Math.max(stepHeight - 15, 16);
                lineElement.style.setProperty("--target-height", `${lineHeight}px`);
            });
        };

        updateLineHeights();
    }, [steps]);

    return (
        <div className={styles.stepsContainer}>
            {steps.map((step, index) => {
                const executing = isExecuting && index === steps.length - 1;
                return (
                    <div
                        key={index}
                        className={styles.stepItem}
                        ref={(e) => { stepRefs.current[index] = e }}
                    >
                        <div className={styles.stepIndicatorContainer}>
                            <div className={styles.stepIndicator}>
                                {executing ? (
                                    <div className={styles.loader}>
                                        <div className={styles.loaderSpinner}></div>
                                    </div>
                                ) : (
                                    <div className={styles.dot}></div>
                                )}
                            </div>
                            {index < steps.length - 1 && (
                                <div
                                    className={`${styles.connectingLine} ${styles.animateGrow}`}
                                    ref={(e) => { lineRefs.current[index] = e }}
                                ></div>
                            )}
                        </div>
                        <div className={styles.stepContent}>
                            <span className={styles.stepTitle}>{step}</span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}