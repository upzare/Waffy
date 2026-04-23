import { LogOut, CreditCard, User, Plus } from "lucide-react";
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
        totalSpend: 12.48,
        balance: 37.52,
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

            <div className={styles.accountMenuSpend}>
                <div className={styles.walletCard}>
                    <div className={styles.walletBalanceSection}>
                        <span className={styles.walletLabel}>Available Balance</span>
                        <div className={styles.walletBalance}>
                            <span className={styles.walletCurrency}>$</span>
                            {user.balance.toFixed(2)}
                        </div>
                    </div>
                    <div className={styles.walletDivider}></div>
                    <div className={styles.walletSpendSection}>
                        <span className={styles.walletSpendLabel}>Total Spend</span>
                        <span className={styles.walletSpendValue}>${user.totalSpend.toFixed(2)}</span>
                    </div>
                </div>
            </div>

            <div className={styles.accountMenuActions}>
                <button className={styles.accountMenuAction} onClick={() => handleNavigation("/settings/account")}>
                    <User size={16} />
                    <span>My Account</span>
                </button>
                <button className={styles.accountMenuAction} onClick={() => handleNavigation("/billing")}>
                    <CreditCard size={16} />
                    <span>Billing & Usage</span>
                </button>
            </div>

            <div className={styles.accountMenuFooter}>
                <button className={styles.accountMenuUpgrade} onClick={() => handleNavigation("/funds")}>
                    <Plus size={14} />
                    <span>Add Credits</span>
                </button>
                <button className={styles.accountMenuLogout} onClick={handleLogout}>
                    <LogOut size={16} />
                    <span>Logout</span>
                </button>
            </div>
        </div>
    )
}

export default AccountMenu;