"use client"

import type React from "react"
import type { Settings } from "./../../types"

interface ThemeSettingsProps {
  settings: Settings
  onChange: (key: keyof Settings, value: any) => void
}

const ThemeSettings: React.FC<ThemeSettingsProps> = ({ settings, onChange }) => {
  return (
    <div className="settings-section">
      <h2>Theme Settings</h2>

      <div className="setting-item">
        <label htmlFor="theme">Theme Mode</label>
        <select id="theme">
          <option value="system">System Default</option>
          <option value="dark">Dark Mode</option>
          <option value="light">Light Mode</option>
        </select>
        <p>Choose your preferred theme mode</p>
      </div>
      
    </div>
  )
}

export default ThemeSettings