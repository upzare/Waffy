import type React from "react"
import { Github, ExternalLink } from "lucide-react"

const AboutSettings: React.FC = () => {
  return (
    <div className="settings-section">
      <h2>About Waffy</h2>

      <div className="about-content">
        <p>
          <strong>Version:</strong> 1.0.0
        </p>
        <p>Waffy is an AI-powered web assistant that helps you with web development, research, and content creation.</p>
        <p>
          Built with modern web technologies to provide a seamless experience across different browsers and platforms.
        </p>

        <div className="about-links">
          <a href="https://github.com/waffy" target="_blank" rel="noopener noreferrer" className="link-button">
            <Github size={16} />
            <span>GitHub</span>
          </a>
          <a href="https://waffy.ai" target="_blank" rel="noopener noreferrer" className="link-button">
            <ExternalLink size={16} />
            <span>Website</span>
          </a>
        </div>

        <h3>Credits</h3>
        <p>Developed by the Waffy team with ❤️</p>

        <h3>License</h3>
        <p>MIT License © 2023 Waffy</p>
      </div>
    </div>
  )
}

export default AboutSettings