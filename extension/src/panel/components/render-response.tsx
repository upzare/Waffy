import React, { useState, isValidElement } from "react";
import Markdown from "react-markdown";
import type { Components } from "react-markdown";
import { DropdownSteps } from "../components/dropdown-steps";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { funky } from "react-syntax-highlighter/dist/esm/styles/prism";
import {
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle2,
  CircleX,
  CirclePause,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

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
  error?: boolean;
}

interface CodeElementProps {
  className?: string;
  children?: React.ReactNode;
}

type CodeComponentProps = React.ComponentProps<"code"> & { inline?: boolean };

const syntaxHighlighterStyle = funky as { [key: string]: React.CSSProperties };

const CodeBlock: NonNullable<Components["code"]> = ({ className = "code", children, ...props }) => {
  const { inline } = props as CodeComponentProps;
  const match = /language-(\w+)/.exec(className || "");

  return !inline && match ? (
    <SyntaxHighlighter
      style={syntaxHighlighterStyle}
      language={match[1]}
      PreTag="div"
      className="overflow-x-auto"
    >
      {String(children).replace(/\n$/, "")}
    </SyntaxHighlighter>
  ) : (
    <code className={className} {...props}>
      {children}
    </code>
  );
};

const OverflowDiv: NonNullable<Components["div"]> = (props) => (
  <div className="w-full">{props.children}</div>
);

const RenderResponse: React.FC<RenderResponseProps> = ({
  content,
  taskStatus = "",
  isInitial = false,
  isExecuting = false,
  isValidating = false,
  isOutput = false,
  error = false,
}) => {
  const [CopyIcon, setCopyIcon] = useState<LucideIcon>(Copy);
  const [isExecutingExpanded, setIsExecutingExpanded] = useState(false);
  const [isValidatingExpanded, setIsValidatingExpanded] = useState(false);

  const handleClick = (code: React.ReactNode) => {
    navigator.clipboard.writeText(String(code));
    setCopyIcon(Check);
    setTimeout(() => {
      setCopyIcon(Copy);
    }, 2000);
  };

  const Pre: NonNullable<Components["pre"]> = ({ children }) => {
    if (!isValidElement<CodeElementProps>(children)) {
      return (
        <pre className="my-3 rounded-lg border border-white bg-black">
          <div className="font-mono text-sm px-2 overflow-x-auto whitespace-pre-wrap mb-[-0.4rem]">
            {children}
          </div>
        </pre>
      );
    }

    const match = /language-(\w+)/.exec(children.props.className || "");
    const language = match ? match[1].toUpperCase() : "TEXT";

    return (
      <pre className="my-3 rounded-lg border border-white bg-black">
        <div className="flex justify-between items-center px-2 bg-white text-black text-sm font-mono rounded-t-md">
          <span className="font-bold text-black">{language}</span>
          <button
            type="button"
            className="bg-white cursor-pointer transition-transform duration-300 hover:scale-110 [&_svg]:w-4 [&_svg]:h-4 border-none p-0"
            title="Copy Code"
            onClick={() => handleClick(children.props.children)}
          >
            <CopyIcon size={16} />
          </button>
        </div>
        <div className="font-mono text-sm px-2 py-1 overflow-x-auto whitespace-pre-wrap mb-[-0.6rem]">
          {children}
        </div>
      </pre>
    );
  };

  const markdownComponents: Components = {
    pre: Pre,
    code: CodeBlock,
    div: OverflowDiv,
  };

  const validationMarkdownComponents: Components = {
    pre: Pre,
    code: CodeBlock,
  };

  const toggleExecuting = () => {
    setIsExecutingExpanded(!isExecutingExpanded);
  };

  const toggleValidating = () => {
    setIsValidatingExpanded(!isValidatingExpanded);
  };

  if (error) {
    return (
      <div className="w-full">
        <div className="wrap-break-word w-full">
          <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {content?.prompt}
          </Markdown>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="wrap-break-word w-full">
        <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {content?.response}
        </Markdown>
      </div>

      {(content?.execution?.length || isExecuting) && (
        <div className="mt-4 mb-2 rounded-lg border border-border bg-[rgba(0,0,0,0.3)] overflow-hidden">
          <button
            type="button"
            className="w-full flex justify-between items-center p-3 bg-[rgba(0,0,0,0.4)] cursor-pointer transition-[background] duration-300 ease-in-out hover:bg-[rgba(0,0,0,0.5)] border-none text-white"
            onClick={toggleExecuting}
            aria-expanded={isExecutingExpanded}
          >
            <div className="flex items-center gap-2">
              {isExecuting ? (
                <>
                  <Loader2 size={16} className="animate-[spin_1.5s_linear_infinite] text-white" />
                  <span className="font-normal text-xs">Executing Actions</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} className="text-white" />
                  <span className="font-normal text-xs">Actions Executed</span>
                </>
              )}
            </div>
            <div className="text-white transition-transform duration-200 ease-in-out">
              {isExecutingExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </button>

          {isExecutingExpanded && (
            <DropdownSteps steps={content?.execution || []} isExecuting={isExecuting} />
          )}
        </div>
      )}

      {(content?.validation || isValidating) && (
        <div className="mt-2 mb-4 rounded-lg border border-border bg-[rgba(0,0,0,0.3)] overflow-hidden">
          <button
            type="button"
            className="w-full flex justify-between items-center p-3 bg-[rgba(0,0,0,0.4)] cursor-pointer transition-[background] duration-300 ease-in-out hover:bg-[rgba(0,0,0,0.5)] border-none text-white"
            onClick={toggleValidating}
            aria-expanded={isValidatingExpanded}
          >
            <div className="flex items-center gap-2">
              {isValidating ? (
                <>
                  <Loader2 size={16} className="animate-[spin_1.5s_linear_infinite] text-white" />
                  <span className="font-normal text-xs">Validating Task</span>
                </>
              ) : taskStatus === "success" ? (
                <>
                  <CheckCircle2 size={16} className="text-white" />
                  <span className="font-normal text-xs">Task Completed</span>
                </>
              ) : taskStatus === "suspended" ? (
                <>
                  <CirclePause size={16} className="text-white" />
                  <span className="font-normal text-xs">Task Suspended</span>
                </>
              ) : (
                <>
                  <CircleX size={16} className="text-white" />
                  <span className="font-normal text-xs">Task Failed</span>
                </>
              )}
            </div>
            <div className="text-white transition-transform duration-200 ease-in-out">
              {isValidatingExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </button>

          {isValidatingExpanded && (
            <div className="p-4 border-t border-[rgba(255,255,255,0.05)] animate-expand-content">
              <div className="wrap-break-word w-full">
                <Markdown remarkPlugins={[remarkGfm]} components={validationMarkdownComponents}>
                  {content?.validation || ""}
                </Markdown>
              </div>

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
                      } as React.CSSProperties
                    }
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {(content?.output || isOutput) && (
        <div className="wrap-break-word w-full">
          <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {content?.output}
          </Markdown>
        </div>
      )}

      {(isInitial || isOutput) && (
        <div className="relative inline-block m-1 h-6 w-6 animate-spin-loader">
          <div className="absolute h-full w-[30%] bottom-[5%] left-0 rotate-60 origin-[50%_85%] after:content-[''] after:absolute after:h-0 after:w-full after:pb-[100%] after:bg-[rgb(0,200,83)] after:rounded-full after:bottom-0 after:left-0 after:animate-wobble1 after:[animation-delay:calc(0.95s*-0.3)]"></div>
          <div className="absolute h-full w-[30%] bottom-[5%] right-0 rotate-[-60deg] origin-[50%_85%] after:content-[''] after:absolute after:h-0 after:w-full after:pb-[100%] after:bg-[rgb(0,200,83)] after:rounded-full after:bottom-0 after:left-0 after:animate-wobble1 after:[animation-delay:calc(0.95s*-0.15)]"></div>
          <div className="absolute h-full w-[30%] bottom-[-5%] left-0 translate-x-[116.666%] after:content-[''] after:absolute after:h-0 after:w-full after:pb-[100%] after:bg-[rgb(0,200,83)] after:rounded-full after:top-0 after:left-0 after:animate-wobble2"></div>
        </div>
      )}
    </div>
  );
};

export default RenderResponse;
