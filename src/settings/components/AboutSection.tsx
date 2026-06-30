import React from 'react';
import { ExternalLink, Globe } from 'lucide-react';
import styles from 'css/settings/About.module.css';

interface AboutSectionProps {
    logoUrl: string;
}

const LINKS = [
    { href: 'https://waffy.io', label: 'Official Website', icon: Globe },
    { href: 'https://waffy.io/terms', label: 'Terms of Service', icon: ExternalLink },
    { href: 'https://waffy.io/privacy', label: 'Privacy Policy', icon: ExternalLink },
    { href: 'https://x.com/WaffyHQ', label: 'Follow on Twitter', icon: ExternalLink },
];

const AboutSection: React.FC<AboutSectionProps> = ({ logoUrl }) => {
    return (
        <>
            <div className={styles.aboutHero}>
                <div className={styles.aboutLogoWrap}>
                    <img src={logoUrl} alt="Waffy Logo" className={styles.aboutLogo} />
                </div>
                <h2 className={styles.aboutTitle}>Waffy</h2>
                <p className={styles.aboutTagline}>Your AI Copilot for Web</p>
                <span className={styles.aboutVersionBadge}>Version 1.0.0</span>
            </div>

            <div className={styles.aboutLinksGrid}>
                {LINKS.map(({ href, label, icon: Icon }) => (
                    <a
                        key={href}
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className={styles.aboutLinkCard}
                    >
                        <Icon size={16} />
                        <span>{label}</span>
                        <ExternalLink size={14} className={styles.aboutLinkArrow} />
                    </a>
                ))}
            </div>

            <p className={styles.aboutCopyright}>
                © {new Date().getFullYear()} Waffy AI. All rights reserved.
            </p>
        </>
    );
};

export default AboutSection;
