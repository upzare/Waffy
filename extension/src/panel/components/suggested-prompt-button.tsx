import { useEffect, useRef } from "react";
import type { SuggestedPromptProps } from "../../types";

const SuggestedPromptButton: React.FC<SuggestedPromptProps> = ({ text, onClick }) => {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (buttonRef.current) {
      const colors = getComputedStyle(document.documentElement)
        .getPropertyValue("--gradient-colors")
        .split(",")
        .map((color) => color.trim());

      const shuffledColors = [...colors].sort(() => Math.random() - 0.5);
      buttonRef.current.style.setProperty("--color-1", shuffledColors[0]);
      buttonRef.current.style.setProperty("--color-2", shuffledColors[1]);
      buttonRef.current.style.setProperty("--color-3", shuffledColors[2]);
      buttonRef.current.style.setProperty("--color-4", shuffledColors[3]);
      buttonRef.current.style.setProperty("--color-5", shuffledColors[4]);
      buttonRef.current.style.setProperty("--color-6", shuffledColors[5]);
    }
  }, []);

  return (
    <button
      ref={buttonRef}
      type="button"
      className="group relative flex justify-center items-center overflow-hidden h-10 cursor-pointer bg-size-[300%_300%] backdrop-blur-[1rem] rounded-[5rem] [transition:0.5s] animate-suggestions-gradient border-2 border-double border-transparent px-4 font-['Orbitron',sans-serif] hover:scale-105 [background-image:linear-gradient(#161a25,#161a25),linear-gradient(137.48deg,var(--color-1)_15%,var(--color-2)_25%,var(--color-3)_40%,var(--color-4)_60%,var(--color-5)_75%,var(--color-6)_90%)] bg-origin-border [background-clip:content-box,border-box]"
      onClick={onClick}
    >
      <strong className="z-2 tracking-wide text-white [text-shadow:0_0_1px_white]">
        {text}
      </strong>
      <div className="absolute z-[-1] w-full h-full overflow-hidden [transition:0.5s] backdrop-blur-[1rem] rounded-[5rem] group-hover:z-1 group-hover:bg-[#161a25]">
        <div className="relative bg-transparent w-[200rem] h-[200rem] before:content-[''] before:absolute before:top-0 before:left-[-50%] before:w-[170%] before:h-[500%] before:animate-anim-star before:bg-[radial-gradient(#ffffff_1px,transparent_1%)] before:bg-size-[50px_50px] before:opacity-50 after:content-[''] after:absolute after:top-[-10rem] after:left-[-100rem] after:w-full after:h-full after:animate-anim-star-rotate after:bg-[radial-gradient(#ffffff_1px,transparent_1%)] after:bg-size-[50px_50px]"></div>
      </div>
      <div className="absolute flex w-48">
        <div className="absolute w-7.5 h-7.5 rounded-full blur-[2rem] bg-[rgba(245,67,79,0.636)] animate-orbit"></div>
        <div className="absolute w-7.5 h-7.5 rounded-full blur-[2rem] bg-[rgba(99,30,41,0.704)] animate-orbit-slow"></div>
      </div>
    </button>
  );
};

export default SuggestedPromptButton;
