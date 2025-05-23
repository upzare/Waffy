import type React from "react";
import { LogOut, CreditCard, User, ExternalLink } from "lucide-react";

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
        <div className="account-menu" ref={accountMenuRef}>
            <div className="account-menu-header">
                <div className="account-avatar-large">
                    {user.avatar ? (
                        <img src={user.avatar || "/placeholder.svg"} alt={user.name} />
                    ) : (
                        <div className="avatar-placeholder-large">
                            <User size={24} />
                        </div>
                    )}
                </div>
                <div className="account-menu-user-info">
                    <div className="account-menu-name">{user.name}</div>
                    <div className="account-menu-email">{user.email}</div>
                </div>
            </div>

            <div className="account-menu-credits">
                <div className="credits-header">
                    <span>Credits Usage</span>
                    <span className="credits-count">
                        {user.credits.used} / {user.credits.total}
                    </span>
                </div>
                <div className="credits-progress-container">
                    <div className="credits-progress-bar" style={{ width: `${user.credits.percentage}%` }}></div>
                </div>
                <div className="credits-info">
                    <div className={`plan-badge ${user.plan}`}>
                        {user.plan.charAt(0).toUpperCase() + user.plan.slice(1)} Plan
                    </div>
                    <div>{user.credits.total - user.credits.used} credits remaining this month</div>
                </div>
            </div>

            <div className="account-menu-actions">
                <button className="account-menu-action" onClick={() => handleNavigation("/settings/account")}>
                    <User size={16} />
                    <span>My Account</span>
                </button>
                <button className="account-menu-action" onClick={() => handleNavigation("/billing")}>
                    <CreditCard size={16} />
                    <span>Billing & Payments</span>
                </button>
            </div>

            <div className="account-menu-footer">
                <button className="account-menu-upgrade" onClick={() => handleNavigation("/upgrade")}>
                    <span>Upgrade Plan</span>
                    <ExternalLink size={14} />
                </button>
                <button className="account-menu-logout" onClick={handleLogout}>
                    <span>Log Out</span>
                    <LogOut size={16} />
                </button>
            </div>
        </div>
    )
}

export default AccountMenu;