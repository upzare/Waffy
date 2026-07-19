export const DropdownSteps = ({
  steps,
  isExecuting = false,
}: {
  steps: string[];
  isExecuting?: boolean;
}) => {
  return (
    <div className="border-t border-[rgba(255,255,255,0.05)] p-4">
      {steps.map((step, index) => {
        const executing = isExecuting && index === steps.length - 1;
        return (
          <div key={index} className="flex relative pb-4 last:pb-0">
            <div className="relative w-5 shrink-0 mr-3">
              <div className="relative z-2 mx-auto mt-0.5 w-3 h-3 flex items-center justify-center">
                {executing ? (
                  <div className="w-full h-full border border-[rgba(0,153,56,0.3)] border-t-[#00ff5e] rounded-full animate-spin"></div>
                ) : (
                  <div className="w-full h-full bg-[#4f4f4f90] rounded-full"></div>
                )}
              </div>
              {index < steps.length - 1 && (
                <div className="absolute left-[calc(50%-1px)] top-[14px] bottom-[-16px] w-0.5 bg-[#1f1f1f] origin-top animate-grow-line z-1"></div>
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
