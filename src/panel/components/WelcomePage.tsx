import { useState } from "react";
import { Zap, Bot, Globe } from "lucide-react";
import StartedButton from "./StartedButton";
import AuthenticationModal from "./AuthenticationModal";
import styles from "css/panel/WelcomePage.module.css";

export default function WelcomePage() {
    const [showModal, setShowModal] = useState(false);

    const handleGetStarted = () => {
        setShowModal(true);
        // chrome.tabs.create({ url: "https://waffy.io/login" });
        // const coo = chrome.cookies.get({ url: "https://www.google.com/", name: "AEC" });
        // console.log(coo);
    }

    const handleClose = () => {
        setShowModal(false);
    }

    return (
        <div className={styles.container}>
            <div className={styles.logoContainer}>
                <img src="/assets/logo.svg" alt="Waffy Logo" className={styles.logo} />
            </div>

            <h1 className={styles.title}>Waffy</h1>
            <p className={styles.subTitle}>Automation for Web Browser</p>

            <StartedButton className={styles.getStartedButton} text="Get Started" onClick={handleGetStarted} />

            <div className={styles.features}>
                <div className={styles.feature}>
                    <div className={styles.featureIcon}>
                        <Zap size={24} />
                    </div>
                    <div className={styles.featureText}>
                        <h3>Powerful Models</h3>
                        <p>Advanced language model to assist with any task</p>
                    </div>
                </div>

                <div className={styles.feature}>
                    <div className={styles.featureIcon}>
                        <Globe size={24} />
                    </div>
                    <div className={styles.featureText}>
                        <h3>Web Integration</h3>
                        <p>Works seamlessly across all your favorite websites</p>
                    </div>
                </div>


                <div className={styles.feature}>
                    <div className={styles.featureIcon}>
                        <Bot size={24} />
                    </div>
                    <div className={styles.featureText}>
                        <h3>Task Automation</h3>
                        <p>Streamlines your workflow for maximum efficiency</p>
                    </div>
                </div>
            </div>

            <AuthenticationModal hidden={!showModal} onClose={handleClose} onCancel={handleClose} />
        </div>
    )
}