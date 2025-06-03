"use client"

import type React from "react"
import type { Settings } from "./../../types"
import { LogOut, User, Shield, Edit2 } from "lucide-react"

interface GeneralSettingsProps {
  settings: Settings
  onChange: (key: keyof Settings, value: any) => void
}

const GeneralSettings: React.FC<GeneralSettingsProps> = ({ settings, onChange }) => {
  // Mock function for logout - in a real app, this would handle actual logout logic
  const handleLogout = () => {
  }

  return (
    <div className="settings-section">
      <h2>General Settings</h2>

      {/* Account Section */}
      <div className="account-section">
        <h3>Account</h3>

        {settings.account?.isLoggedIn ? (
          <>
            <div className="account-info">
              <div className="account-avatar">
                {settings.account.avatar ? (
                  <img src={settings.account.avatar || "/placeholder.svg"} alt="Profile" />
                ) : (
                  <div className="avatar-placeholder">
                    <User size={24} />
                  </div>
                )}
              </div>
              <div className="account-details">
                <div className="account-name">{settings.account.name || "User"}</div>
                <div className="account-email">{settings.account.email || "user@example.com"}</div>
                <div className="account-plan">
                  <span className={`plan-badge ${settings.account.plan || "free"}`}>
                    {settings.account.plan
                      ? settings.account.plan.charAt(0).toUpperCase() + settings.account.plan.slice(1)
                      : "Free"}{" "}
                    Plan
                  </span>
                </div>
              </div>
            </div>

            <div className="account-actions">
              <button className="account-button edit-profile">
                <Edit2 size={16} />
                <span>Edit Profile</span>
              </button>
              <button className="account-button upgrade-plan">
                <Shield size={16} />
                <span>Upgrade Plan</span>
              </button>
              <button className="account-button logout" onClick={handleLogout}>
                <LogOut size={16} />
                <span>Log Out</span>
              </button>
            </div>
          </>
        ) : (
          <div className="login-prompt">
            <p>You are not logged in. Log in to sync your settings and access premium features.</p>
            <div className="login-buttons">
              <button className="login-button">Log In</button>
              <button className="signup-button">Sign Up</button>
            </div>
          </div>
        )}
      </div>

      <div className="setting-item">
        <label htmlFor="api_key">API Key</label>
        <input
          type="text"
          id="api_key"
          value={settings.waffyAPI}
          onChange={(e) => onChange("waffyAPI", e.target.value)}
          placeholder="Enter your API key"
        />
        <p>Your unique API key for API access</p>
      </div>

      <div className="setting-item">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={settings.enableKeyboardShortcuts}
            onChange={(e) => onChange("enableKeyboardShortcuts", e.target.checked)}
          />
          Enable keyboard shortcuts
        </label>
        <p>Use keyboard shortcuts for common actions</p>
      </div>

      <div className="setting-item">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={settings.enableNotifications}
            onChange={(e) => onChange("enableNotifications", e.target.checked)}
          />
          Enable notifications
        </label>
        <p>Show notifications for important events</p>
      </div>
    </div>
  )
}

export default GeneralSettings