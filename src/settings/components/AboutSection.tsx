import React from 'react';
import { ExternalLink } from 'lucide-react';
import styles from 'css/settings/Settings.module.css';

interface AboutSectionProps {
    logoUrl: string;
}

const AboutSection: React.FC<AboutSectionProps> = ({ logoUrl }) => {
    return (
        <div className={styles.sectionContainer}>
            <div className={`${styles.card} ${styles.aboutCard}`}>
                <img src={logoUrl} alt="Waffy Logo" className={styles.aboutLogo} />
                <h1 className={styles.aboutTitle}>Waffy</h1>
                <p className={styles.aboutVersion}>Version 1.0.0</p>

                <div className={styles.aboutLinks}>
                    <a href="https://waffy.app" target="_blank" rel="noreferrer" className={`${styles.cancelButton} ${styles.aboutLink}`}>
                        Official Website <ExternalLink size={14} />
                    </a>
                    <a href="https://waffy.app/terms" target="_blank" rel="noreferrer" className={`${styles.cancelButton} ${styles.aboutLink}`}>
                        Terms of Service <ExternalLink size={14} />
                    </a>
                    <a href="https://waffy.app/privacy" target="_blank" rel="noreferrer" className={`${styles.cancelButton} ${styles.aboutLink}`}>
                        Privacy Policy <ExternalLink size={14} />
                    </a>
                    <a href="https://twitter.com/waffyhq" target="_blank" rel="noreferrer" className={`${styles.cancelButton} ${styles.aboutLink}`}>
                        Follow us on Twitter <ExternalLink size={14} />
                    </a>
                </div>

                <p className={styles.aboutCopyright}>
                    © {new Date().getFullYear()} Waffy HQ. All rights reserved.
                </p>
            </div>
        </div>
    );
};

export default AboutSection;
