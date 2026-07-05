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
import styles from "css/panel/render-response.module.css";

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
  isSummary?: boolean;
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
      className={styles.syntaxHighlighter}
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
  <div className={styles.overflowContainer}>{props.children}</div>
);

const RenderResponse: React.FC<RenderResponseProps> = ({
  content,
  taskStatus = "",
  isInitial = false,
  isExecuting = false,
  isValidating = false,
  isSummary = false,
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
        <pre className={styles.codeBlock}>
          <div className={styles.codeContent}>{children}</div>
        </pre>
      );
    }

    const match = /language-(\w+)/.exec(children.props.className || "");
    const language = match ? match[1].toUpperCase() : "TEXT";

    return (
      <pre className={styles.codeBlock}>
        <div className={styles.codeHeader}>
          <span className={styles.languageLabel}>{language}</span>
          <div
            className={styles.copyButton}
            title="Copy Code"
            onClick={() => handleClick(children.props.children)}
          >
            <CopyIcon size={16} />
          </div>
        </div>
        <div className={styles.codeContent}>{children}</div>
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
      <div className={styles.responseContainer}>
        <div className={styles.markdownContent}>
          <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {content?.prompt}
          </Markdown>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.responseContainer}>
      <div className={styles.markdownContent}>
        <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {content?.response}
        </Markdown>
      </div>

      {(content?.execution?.length || isExecuting) && (
        <div className={styles.dropdownContainer}>
          <div className={styles.dropdownHeader} onClick={toggleExecuting}>
            <div className={styles.dropdownHeaderLeft}>
              {isExecuting ? (
                <>
                  <Loader2 size={16} className={styles.dropdownLoadingIcon} />
                  <span className={styles.dropdownLabel}>Executing Actions</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} className={styles.dropdownCompleteIcon} />
                  <span className={styles.dropdownLabel}>Actions Executed</span>
                </>
              )}
            </div>
            <div className={styles.dropdownToggle}>
              {isExecutingExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </div>

          {isExecutingExpanded && (
            <DropdownSteps steps={content?.execution || []} isExecuting={isExecuting} />
          )}
        </div>
      )}

      {(content?.validation || isValidating) && (
        <div className={styles.dropdownContainer}>
          <div className={styles.dropdownHeader} onClick={toggleValidating}>
            <div className={styles.dropdownHeaderLeft}>
              {isValidating ? (
                <>
                  <Loader2 size={16} className={styles.dropdownLoadingIcon} />
                  <span className={styles.dropdownLabel}>Validating Task</span>
                </>
              ) : taskStatus === "success" ? (
                <>
                  <CheckCircle2 size={16} className={styles.dropdownCompleteIcon} />
                  <span className={styles.dropdownLabel}>Task Completed</span>
                </>
              ) : taskStatus === "suspended" ? (
                <>
                  <CirclePause size={16} className={styles.dropdownCompleteIcon} />
                  <span className={styles.dropdownLabel}>Task Suspended</span>
                </>
              ) : (
                <>
                  <CircleX size={16} className={styles.dropdownCompleteIcon} />
                  <span className={styles.dropdownLabel}>Task Failed</span>
                </>
              )}
            </div>
            <div className={styles.dropdownToggle}>
              {isValidatingExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </div>

          {isValidatingExpanded && (
            <div className={styles.dropdownContent}>
              <div className={styles.dropdownMarkdown}>
                <Markdown remarkPlugins={[remarkGfm]} components={validationMarkdownComponents}>
                  {content?.validation || ""}
                </Markdown>
              </div>

              {isValidating && (
                <div className={styles.loaderContainer}>
                  <div className={styles.loader} />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {(content?.output || isSummary) && (
        <div className={styles.markdownContent}>
          <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {content?.output}
          </Markdown>
        </div>
      )}

      {(isInitial || isSummary) && (
        <div className={styles.loadingIndicator}>
          <div className={styles.loadingIndicatorDot}></div>
          <div className={styles.loadingIndicatorDot}></div>
          <div className={styles.loadingIndicatorDot}></div>
        </div>
      )}
    </div>
  );
};

export default RenderResponse;
