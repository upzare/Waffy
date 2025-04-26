import type { SuggestedPromptProps } from "../../types";

const SuggestedPrompt: React.FC<SuggestedPromptProps> = ({ text, onClick }) => {
  return (
    <button className="suggested-prompt" onClick={onClick}>
      <div className="suggested-prompt-glow"></div>
      <span className="suggested-prompt-text">{text}</span>
    </button>
  )
}

export default SuggestedPrompt;