import styles from "css/panel/AuthenticationModal.module.css";

export default function AuthenticationModal({ hidden, onClose, onCancel }: { hidden: boolean, onClose: () => void, onCancel: () => void }) {
    return (
        <div className={`${styles.modalOverlay} ${hidden ? styles.hidden : ""}`} onClick={onClose}>
            <div className={`${styles.modal}  ${hidden ? styles.hidden : ""}`} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalContent}>
                    {/* <div className={styles.modalIcon}>
                                {isLoading ? <Loader2 size={32} className={styles.loadingSpinner} /> : <LogIn size={32} />}
                            </div> */}

                    {/* <h2 className={styles.modalTitle}>{isLoading ? "Authentication" : "Welcome back!"}</h2> */}

                    <h2 className={styles.modalTitle}>Authentication</h2>

                    {/* <ol className={styles.modalText}>
                            <li>Go to <a href="https://waffy.io/account/extension">waffy.io/accounts.</a></li>
                            <li>Click on the Extension tab.</li>
                            <li>Click on the "Add Extension" button.</li>
                            <li>Confirm the request.</li>
                            <li>You're all set!</li>
                        </ol> */}

                    <p className={styles.modalText}>
                        Please wait while we authenticate your account on Waffy. You will be redirected to a verification page.
                    </p>

                    <div className={styles.loader} />

                    <button className={styles.cancelButton} onClick={onCancel}>Cancel</button>
                </div>
            </div>
        </div>
    )
}