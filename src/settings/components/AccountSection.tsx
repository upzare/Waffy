import React from 'react';
import { User } from 'lucide-react';
import styles from 'css/settings/Settings.module.css';

interface AccountSectionProps {
    serverData: {
        account_id: string;
        name: string;
        email: string;
    };
}

const AccountSection: React.FC<AccountSectionProps> = ({ serverData }) => {
    return (
        <div className={styles.sectionContainer}>
            <div className={styles.card}>
                <div className={styles.cardTitle}><User size={18} /> Personal Information</div>
                <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Account ID</label>
                    <input type="text" className={styles.formInput} value={serverData.account_id} disabled />
                </div>
                <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Full Name</label>
                    <input type="text" className={styles.formInput} value={serverData.name} disabled />
                </div>
                <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Email Address</label>
                    <input type="email" className={styles.formInput} value={serverData.email} disabled />
                </div>
            </div>
        </div>
    );
};

export default AccountSection;
