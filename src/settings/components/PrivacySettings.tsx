"use client"

import type React from "react"
import type { Settings } from "./../../types"

interface PrivacySettingsProps {
  settings: Settings
  onChange: (key: keyof Settings, value: any) => void
}

const PrivacySettings: React.FC<PrivacySettingsProps> = ({ settings, onChange }) => {
  return (
    <div className="settings-section">
      <h2>Privacy Settings</h2>

      <div className="setting-item">
        <label className="checkbox-label">
          <input
            type="checkbox"
          />
          Save conversation history
        </label>
        <p>Store your chat history locally for future reference</p>
      </div>

      <div className="setting-item">
        <h3>Data Collection</h3>
        <p>Waffy collects minimal data to improve your experience. You can control what data is collected below.</p>

        <div className="radio-group">
          <label className="radio-label">
            <input
              type="radio"
              name="dataCollection"
              value="full"
            />
            Full
          </label>
          <label className="radio-label">
            <input
              type="radio"
              name="dataCollection"
              value="minimal"
            />
            Minimal
          </label>
          <label className="radio-label">
            <input
              type="radio"
              name="dataCollection"
              value="none"
            />
            None
          </label>
        </div>
      </div>

      <div className="setting-item">
        <button className="link-button">Clear All Data</button>
        <p>This will permanently delete all your saved conversations and settings</p>
      </div>
    </div>
  )
}

export default PrivacySettings