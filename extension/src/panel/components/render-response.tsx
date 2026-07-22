import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Streamdown } from "streamdown";
import { code } from "@streamdown/code";
import { DropdownSteps } from "../components/dropdown-steps";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle2,
  CircleX,
  CirclePause,
  type LucideIcon,
} from "lucide-react";

interface ResponseContent {
  prompt?: string;
  response?: string;
  execution?: string[];
  validation?: string;
  output?: string;
}

interface RenderResponseProps {
  content?: ResponseContent;
  taskStatus?: string;
  isInitial?: boolean;
  isExecuting?: boolean;
  isValidating?: boolean;
  isOutput?: boolean;
  toolActivityText?: string | null;
}

type StatusInfo = {
  icon: LucideIcon;
  label: string;
  spinning?: boolean;
};

const ACTIVITY_SCROLL_MS = 250;

const streamdownPlugins = { code };
const streamdownControls = {
  code: { copy: true, download: false },
  table: false,
  mermaid: false,
} as const;

const getExecutionStatus = (isExecuting: boolean): StatusInfo =>
  isExecuting
    ? { icon: Loader2, label: "Executing Actions", spinning: true }
    : { icon: CheckCircle2, label: "Actions Executed" };

const getValidationStatus = (isValidating: boolean, taskStatus: string): StatusInfo => {
  if (isValidating) return { icon: Loader2, label: "Validating Task", spinning: true };
  if (taskStatus === "success") return { icon: CheckCircle2, label: "Task Completed" };
  if (taskStatus === "suspended") return { icon: CirclePause, label: "Task Suspended" };
  return { icon: CircleX, label: "Task Failed" };
};

const MarkdownContent = ({
  children,
  isAnimating = false,
}: {
  children?: string;
  isAnimating?: boolean;
}) => (
  <Streamdown
    className="wrap-break-word w-full leading-[1.75] text-text-primary"
    plugins={streamdownPlugins}
    isAnimating={isAnimating}
    animated={isAnimating}
    shikiTheme={["github-dark", "github-dark"]}
    lineNumbers={false}
    controls={streamdownControls}
    linkSafety={{ enabled: false }}
  >
    {children ?? ""}
  </Streamdown>
);

const StatusPanel = ({
  className,
  expanded,
  onToggle,
  status,
  children,
}: {
  className?: string;
  expanded: boolean;
  onToggle: () => void;
  status: StatusInfo;
  children?: ReactNode;
}) => {
  const Icon = status.icon;

  return (
    <div
      className={`rounded-lg border border-border bg-[rgba(0,0,0,0.3)] overflow-hidden ${className ?? ""}`}
    >
      <button
        type="button"
        className="w-full flex justify-between items-center p-3 bg-[rgba(0,0,0,0.4)] cursor-pointer transition-[background] duration-300 ease-in-out hover:bg-[rgba(0,0,0,0.5)] border-none text-white"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2">
          <Icon
            size={16}
            className={
              status.spinning
                ? "animate-[spin_1.5s_linear_infinite] text-white"
                : "text-white"
            }
          />
          <span className="font-normal text-xs">{status.label}</span>
        </div>
        <div className="text-white transition-transform duration-200 ease-in-out">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>
      {expanded ? children : null}
    </div>
  );
};

const StreamingLoader = () => (
  <div className="relative inline-block m-1 h-6 w-6 animate-spin-loader">
    <div className="absolute h-full w-[30%] bottom-[5%] left-0 rotate-60 origin-[50%_85%] after:content-[''] after:absolute after:h-0 after:w-full after:pb-[100%] after:bg-[rgb(0,200,83)] after:rounded-full after:bottom-0 after:left-0 after:animate-wobble1 after:[animation-delay:calc(0.95s*-0.3)]" />
    <div className="absolute h-full w-[30%] bottom-[5%] right-0 rotate-[-60deg] origin-[50%_85%] after:content-[''] after:absolute after:h-0 after:w-full after:pb-[100%] after:bg-[rgb(0,200,83)] after:rounded-full after:bottom-0 after:left-0 after:animate-wobble1 after:[animation-delay:calc(0.95s*-0.15)]" />
    <div className="absolute h-full w-[30%] bottom-[-5%] left-0 translate-x-[116.666%] after:content-[''] after:absolute after:h-0 after:w-full after:pb-[100%] after:bg-[rgb(0,200,83)] after:rounded-full after:top-0 after:left-0 after:animate-wobble2" />
  </div>
);

const ToolActivityLabel = ({
  text,
  onPresenceChange,
}: {
  text: string | null;
  onPresenceChange?: (present: boolean) => void;
}) => {
  const [displayed, setDisplayed] = useState<string | null>(null);
  const [phase, setPhase] = useState<"enter" | "idle" | "exit">("idle");

  useEffect(() => {
    onPresenceChange?.(!!displayed);
  }, [displayed, onPresenceChange]);

  useEffect(() => {
    if (text === displayed) return;

    if (displayed) {
      setPhase("exit");
      const timer = window.setTimeout(() => {
        setDisplayed(text);
        setPhase(text ? "enter" : "idle");
      }, ACTIVITY_SCROLL_MS);
      return () => window.clearTimeout(timer);
    }

    if (text) {
      setDisplayed(text);
      setPhase("enter");
    }
  }, [text, displayed]);

  useEffect(() => {
    if (phase !== "enter") return;
    const timer = window.setTimeout(() => setPhase("idle"), ACTIVITY_SCROLL_MS);
    return () => window.clearTimeout(timer);
  }, [phase, displayed]);

  if (!displayed) return null;

  return (
    <div className="tool-activity-slot relative h-5 min-w-0 flex-1 overflow-hidden">
      <span
        key={displayed}
        className={`tool-activity-shimmer absolute inset-y-0 left-0 flex items-center text-xs whitespace-nowrap ${phase === "enter"
          ? "tool-activity-enter"
          : phase === "exit"
            ? "tool-activity-exit"
            : ""
          }`}
      >
        {displayed}
      </span>
    </div>
  );
};

const RenderResponse = ({
  content,
  taskStatus = "",
  isInitial = false,
  isExecuting = false,
  isValidating = false,
  isOutput = false,
  toolActivityText = null,
}: RenderResponseProps) => {
  const [isExecutingExpanded, setIsExecutingExpanded] = useState(false);
  const [isValidatingExpanded, setIsValidatingExpanded] = useState(false);
  const [activityPresent, setActivityPresent] = useState(false);

  return (
    <div className="w-full">
      <MarkdownContent isAnimating={isInitial}>{content?.response}</MarkdownContent>

      {(content?.execution?.length || isExecuting) && (
        <StatusPanel
          className="mt-4 mb-2"
          expanded={isExecutingExpanded}
          onToggle={() => setIsExecutingExpanded((open) => !open)}
          status={getExecutionStatus(isExecuting)}
        >
          <DropdownSteps steps={content?.execution || []} isExecuting={isExecuting} />
        </StatusPanel>
      )}

      {(content?.validation || isValidating) && (
        <StatusPanel
          className="mt-2 mb-4"
          expanded={isValidatingExpanded}
          onToggle={() => setIsValidatingExpanded((open) => !open)}
          status={getValidationStatus(isValidating, taskStatus)}
        >
          <div className="p-4 border-t border-[rgba(255,255,255,0.05)] animate-expand-content">
            <MarkdownContent isAnimating={isValidating}>
              {content?.validation || ""}
            </MarkdownContent>
            {isValidating && (
              <div className="flex justify-center p-2">
                <div
                  className="w-8 aspect-[2] animate-dots"
                  style={
                    {
                      "--dots":
                        "no-repeat radial-gradient(circle closest-side, rgb(0, 200, 83) 90%, transparent)",
                      background:
                        "var(--dots) 0% 50%, var(--dots) 50% 50%, var(--dots) 100% 50%",
                      backgroundSize: "calc(100% / 3) 50%",
                    } as CSSProperties
                  }
                />
              </div>
            )}
          </div>
        </StatusPanel>
      )}

      {(content?.output || isOutput) && (
        <MarkdownContent isAnimating={isOutput}>{content?.output}</MarkdownContent>
      )}

      {(isInitial || isOutput || toolActivityText || activityPresent) && (
        <div className="flex items-center gap-2 mt-1">
          <StreamingLoader />
          <ToolActivityLabel text={toolActivityText} onPresenceChange={setActivityPresent} />
        </div>
      )}
    </div>
  );
};

export default RenderResponse;
