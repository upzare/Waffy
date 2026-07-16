import SuggestedPromptButton from "./suggested-prompt-button";
import { BookOpen, Bot, Globe, MessageSquare } from "lucide-react";
import type { HeroProps } from "../../types";

const Hero: React.FC<HeroProps> = ({ hidden, pinnedPrompts, onPromptClick }) => {
  const suggestedPrompts = pinnedPrompts.filter((prompt) => prompt.trim().length > 0);

  return (
    <div
      className={`relative z-10 flex flex-col items-center justify-start overflow-auto bg-transparent transition-all duration-500 ease-out ${hidden ? "m-0 max-h-0 max-w-0 p-0 opacity-0" : "py-[4vh]"
        }`}
    >
      <div className="max-w-full px-4 text-center">
        <h1 className="text-3xl font-extrabold">What can I do for you?</h1>

        <div className="mt-4 flex flex-wrap justify-center gap-6">
          <div className="group flex flex-col items-center gap-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm transition-all duration-300 ease-in-out group-hover:-translate-y-0.5 group-hover:bg-white/10">
              <Globe className="h-6 w-6 stroke-white" />
            </div>
            <div className="text-sm text-white/70">Browse</div>
          </div>

          <div className="group flex flex-col items-center gap-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm transition-all duration-300 ease-in-out group-hover:-translate-y-0.5 group-hover:bg-white/10">
              <BookOpen className="h-6 w-6 stroke-white" />
            </div>
            <div className="text-sm text-white/70">Research</div>
          </div>

          <div className="group flex flex-col items-center gap-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm transition-all duration-300 ease-in-out group-hover:-translate-y-0.5 group-hover:bg-white/10">
              <Bot className="h-6 w-6 stroke-white" />
            </div>
            <div className="text-sm text-white/70">Automate</div>
          </div>

          <div className="group flex flex-col items-center gap-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm transition-all duration-300 ease-in-out group-hover:-translate-y-0.5 group-hover:bg-white/10">
              <MessageSquare className="h-6 w-6 stroke-white" />
            </div>
            <div className="text-sm text-white/70">Chat</div>
          </div>
        </div>
      </div>

      {suggestedPrompts.length > 0 && (
        <div className="mt-8 w-full max-w-full px-4">
          <h2 className="mb-6 text-center text-xl font-medium text-white/80">
            Try asking
          </h2>
          <div className="flex flex-col items-center justify-center gap-4">
            {suggestedPrompts.map((prompt, index) => (
              <SuggestedPromptButton
                key={index}
                text={prompt}
                onClick={() => onPromptClick(prompt)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Hero;
