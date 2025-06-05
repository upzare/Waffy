import { LogOut, CreditCard, User, ExternalLink } from "lucide-react";
import styles from "css/panel/AccountMenu.module.css";

interface AccountMenuProps {
    isOpen: boolean;
    onClose: () => void;
    accountMenuRef: React.RefObject<HTMLDivElement | null>;
}

const AccountMenu: React.FC<AccountMenuProps> = ({ isOpen, onClose, accountMenuRef }) => {
    const user = {
        name: "John Doe",
        email: "john.doe@example.com",
        avatar: null,
        plan: "free",
        credits: {
            used: 350,
            total: 500,
            percentage: 70,
        },
    };

    if (!isOpen) return null;

    const handleLogout = () => {
        onClose();
    }

    const handleNavigation = (path: string) => {
        onClose();
    }

    return (
        <div className={styles.accountMenu} ref={accountMenuRef}>
            <div className={styles.accountMenuHeader}>
                <div className={styles.accountAvatarLarge}>
                    {user.avatar ? (
                        <img src={user.avatar || "/placeholder.svg"} alt={user.name} />
                    ) : (
                        <div className={styles.avatarPlaceholderLarge}>
                            <User size={24} />
                        </div>
                    )}
                </div>
                <div className={styles.accountMenuUserInfo}>
                    <div className={styles.accountMenuName}>{user.name}</div>
                    <div className={styles.accountMenuEmail}>{user.email}</div>
                </div>
            </div>

            <div className={styles.accountMenuCredits}>
                <div className={styles.creditsHeader}>
                    <span>Credits Usage</span>
                    <span className={styles.creditsCount}>
                        {user.credits.used} / {user.credits.total}
                    </span>
                </div>
                <div className={styles.creditsProgressContainer}>
                    <div 
                        className={styles.creditsProgressBar} 
                        style={{ width: `${user.credits.percentage}%` }}
                    ></div>
                </div>
                <div className={styles.creditsInfo}>
                    <div className={`${styles.planBadge} ${styles[user.plan]}`}>
                        {user.plan.charAt(0).toUpperCase() + user.plan.slice(1)} Plan
                    </div>
                    <div>{user.credits.total - user.credits.used} credits remaining this month</div>
                </div>
            </div>

            <div className={styles.accountMenuActions}>
                <button className={styles.accountMenuAction} onClick={() => handleNavigation("/settings/account")}>
                    <User size={16} />
                    <span>My Account</span>
                </button>
                <button className={styles.accountMenuAction} onClick={() => handleNavigation("/billing")}>
                    <CreditCard size={16} />
                    <span>Billing & Payments</span>
                </button>
            </div>

            <div className={styles.accountMenuFooter}>
                <button className={styles.accountMenuUpgrade} onClick={() => handleNavigation("/upgrade")}>
                    <span>Upgrade Plan</span>
                    <ExternalLink size={14} />
                </button>
                <button className={styles.accountMenuLogout} onClick={handleLogout}>
                    <span>Log Out</span>
                    <LogOut size={16} />
                </button>
            </div>
        </div>
    )
}

export default AccountMenu;