import React from "react";
import { Pin, Plus, X } from "lucide-react";
import { iconBox, iconButton, panel, panelSubtitle, panelTitle } from "../styles";

interface GeneralSectionProps {
  pinnedPrompts: string[];
  setPinnedPrompts: (value: string[]) => void;
}

const MIN_PINNED_PROMPTS = 2;
const MAX_PINNED_PROMPTS = 4;

const GeneralSection: React.FC<GeneralSectionProps> = ({ pinnedPrompts, setPinnedPrompts }) => {
  const updatePrompt = (index: number, value: string) => {
    setPinnedPrompts(pinnedPrompts.map((prompt, i) => (i === index ? value : prompt)));
  };

  const removePrompt = (index: number) => {
    if (pinnedPrompts.length <= MIN_PINNED_PROMPTS) return;
    setPinnedPrompts(pinnedPrompts.filter((_, i) => i !== index));
  };

  const addPrompt = () => {
    if (pinnedPrompts.length >= MAX_PINNED_PROMPTS) return;
    setPinnedPrompts([...pinnedPrompts, ""]);
  };

  return (
    <div className={panel}>
      <div className="mb-4">
        <h3 className={panelTitle}>Pinned Prompts</h3>
        <p className={panelSubtitle}>Customize the quick prompts shown on the home screen.</p>
      </div>

      <div className="mb-3 flex flex-col gap-2">
        {pinnedPrompts.map((prompt, index) => (
          <div key={index} className="flex items-center gap-2 sm:gap-2.5">
            <div className={`${iconBox} hidden sm:flex`}>
              <Pin size={15} />
            </div>
            <input
              type="text"
              className="min-w-0 flex-1 rounded-sm border border-border bg-black/25 px-3 py-2.5 text-sm text-text-primary transition-colors duration-150 placeholder:text-text-muted focus:border-green-border focus:bg-black/35 focus:outline-none"
              value={prompt}
              placeholder={`Prompt ${index + 1}`}
              onChange={(e) => updatePrompt(index, e.target.value)}
              spellCheck={false}
            />
            <button
              type="button"
              className={iconButton}
              onClick={() => removePrompt(index)}
              disabled={pinnedPrompts.length <= MIN_PINNED_PROMPTS}
              title="Remove prompt"
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="inline-flex items-center gap-1.5 rounded-sm border border-dashed border-border-strong bg-white/4 px-3.5 py-2 text-sm font-medium text-text-secondary transition-colors duration-150 hover:enabled:border-green-border hover:enabled:bg-white/6 hover:enabled:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
        onClick={addPrompt}
        disabled={pinnedPrompts.length >= MAX_PINNED_PROMPTS}
      >
        <Plus size={15} />
        Add prompt
      </button>
    </div>
  );
};

export default GeneralSection;
