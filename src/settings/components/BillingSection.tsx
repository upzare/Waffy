import React from 'react';
import { Zap, Download } from 'lucide-react';
import styles from 'css/settings/Settings.module.css';

interface Invoice {
    id: string;
    date: string;
    amount: string;
    status: string;
}

interface BillingSectionProps {
    serverData: {
        available_balance: number;
        total_spend: number;
    };
    invoices: Invoice[];
}

const BillingSection: React.FC<BillingSectionProps> = ({ serverData, invoices }) => {
    return (
        <div className={styles.sectionContainer}>
            <div className={styles.planCard}>
                <div className={styles.planInfo}>
                    <div className={styles.cardTitle}>Pay As You Go</div>
                    <p>You are currently using credits for actions.</p>
                </div>
                <button className={styles.upgradeButton}>
                    <Zap size={16} />
                    Add Credits
                </button>
            </div>

            <div className={styles.card}>
                <div className={styles.cardTitle}>Wallet Balance</div>
                <div className={styles.statGrid}>
                    <div className={styles.statItem}>
                        <span className={styles.statLabel}>Available Balance</span>
                        <span className={styles.statValue}>${serverData.available_balance}</span>
                    </div>
                    <div className={styles.statItem}>
                        <span className={styles.statLabel}>Total Spend</span>
                        <span className={styles.statValue}>${serverData.total_spend}</span>
                    </div>
                </div>
            </div>

            <div className={styles.card}>
                <div className={styles.cardTitle}>Invoices</div>
                <div className={styles.invoiceList}>
                    {invoices.map((inv) => (
                        <div key={inv.id} className={styles.invoiceItem}>
                            <div className={styles.invoiceInfo}>
                                <span className={styles.invoiceNumber}>{inv.id}</span>
                                <span className={styles.invoiceDate}>{inv.date}</span>
                            </div>
                            <div className={styles.invoiceDetails}>
                                <span className={styles.invoiceAmount}>{inv.amount}</span>
                                <span className={styles.invoiceStatus}>{inv.status}</span>
                                <button className={styles.invoiceDownload}><Download size={14} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default BillingSection;
