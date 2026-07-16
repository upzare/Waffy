import { useEffect, useRef } from "react";

export const DropdownSteps = ({
  steps,
  isExecuting = false,
}: {
  steps: string[];
  isExecuting?: boolean;
}) => {
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const updateLineHeights = () => {
      stepRefs.current.forEach((stepElement, index) => {
        if (!stepElement || index >= steps.length - 1) return;

        const lineElement = lineRefs.current[index];
        if (!lineElement) return;

        const stepHeight = stepElement.offsetHeight;
        const lineHeight = Math.max(stepHeight - 15, 16);
        lineElement.style.setProperty("--target-height", `${lineHeight}px`);
      });
    };

    updateLineHeights();
  }, [steps]);

  return (
    <div className="border-t border-[rgba(255,255,255,0.05)] p-4">
      {steps.map((step, index) => {
        const executing = isExecuting && index === steps.length - 1;
        return (
          <div
            key={index}
            className="flex items-start relative pb-2 last:pb-0"
            ref={(e) => {
              stepRefs.current[index] = e;
            }}
          >
            <div className="flex flex-col items-center mr-3 relative h-full">
              <div className="w-5 h-5 flex items-center justify-center relative z-2 shrink-0">
                {executing ? (
                  <div className="w-3 h-3">
                    <div className="w-full h-full border border-[rgba(0,153,56,0.3)] border-t-[#00ff5e] rounded-full animate-spin"></div>
                  </div>
                ) : (
                  <div className="w-3 h-3 bg-[#4f4f4f90] rounded-full"></div>
                )}
              </div>
              {index < steps.length - 1 && (
                <div
                  className="w-0.5 bg-[#1f1f1f] relative z-1 -mb-2 animate-grow-line"
                  ref={(e) => {
                    lineRefs.current[index] = e;
                  }}
                ></div>
              )}
            </div>
            <div className="flex items-start flex-1 pt-0.5">
              <span className="text-white text-xs leading-snug wrap-break-word">{step}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
