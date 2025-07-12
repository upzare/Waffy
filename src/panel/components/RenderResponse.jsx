import { useState } from "react";
import Markdown from "react-markdown";
import { DropdownSteps } from "../components/DropdownSteps";
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { funky } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check, ChevronDown, ChevronUp, Loader2, CheckCircle2, CircleX, CirclePause } from 'lucide-react';
import styles from "css/panel/RenderResponse.module.css";

const RenderResponse = ({
    content,
    taskStatus = "",
    isInitial = false,
    isExecuting = false,
    isValidating = false,
    isSummary = false,
    error = false
}) => {
    const [CopyIcon, setCopyIcon] = useState(Copy);
    const [isExecutingExpanded, setIsExecutingExpanded] = useState(false);
    const [isValidatingExpanded, setIsValidatingExpanded] = useState(false);

    const handleClick = (code) => {
        navigator.clipboard.writeText(code);
        setCopyIcon(Check);
        setTimeout(() => {
            setCopyIcon(Copy);
        }, 2000);
    }

    const Pre = ({ children }) => {
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
                        {<CopyIcon size={16} />}
                    </div>
                </div>
                <div className={styles.codeContent}>{children}</div>
            </pre>
        );
    }

    const toggleExecuting = () => {
        setIsExecutingExpanded(!isExecutingExpanded);
    };

    const toggleValidating = () => {
        setIsValidatingExpanded(!isValidatingExpanded);
    };

    if (error) {
        return (
            <div className={styles.responseContainer}>
                {/* Rendering Error Response */}
                <div className={styles.markdownContent}>
                    <Markdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                            pre: Pre,
                            code({ node, inline, className = "code", children, ...props }) {
                                const match = /language-(\w+)/.exec(className || "")
                                return !inline && match ? (
                                    <SyntaxHighlighter
                                        style={funky}
                                        language={match[1]}
                                        PreTag="div"
                                        className="syntax-highlighter"
                                        {...props}
                                    >
                                        {String(children).replace(/\n$/, "")}
                                    </SyntaxHighlighter>
                                ) : (
                                    <code className={className} {...props}>
                                        {children}
                                    </code>
                                )
                            },
                            div(props) {
                                return (
                                    <div className={styles.overflowContainer}>
                                        {props.children}
                                    </div>
                                );
                            }
                        }}
                    >
                        {content.prompt}
                    </Markdown>
                </div>
            </div>
        )
    }

    return (
        <div className={styles.responseContainer}>
            {/* Rendering Initial Response */}
            <div className={styles.markdownContent}>
                <Markdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                        pre: Pre,
                        code({ node, inline, className = "code", children, ...props }) {
                            const match = /language-(\w+)/.exec(className || "")
                            return !inline && match ? (
                                <SyntaxHighlighter
                                    style={funky}
                                    language={match[1]}
                                    PreTag="div"
                                    className="syntax-highlighter"
                                    {...props}
                                >
                                    {String(children).replace(/\n$/, "")}
                                </SyntaxHighlighter>
                            ) : (
                                <code className={className} {...props}>
                                    {children}
                                </code>
                            )
                        },
                        div(props) {
                            return (
                                <div className={styles.overflowContainer}>
                                    {props.children}
                                </div>
                            );
                        }
                    }}
                >
                    {content.response}
                </Markdown>
            </div>

            {/* Rendering Execution */}
            {(content.execution || isExecuting) && (
                <div className={styles.dropdownContainer}>
                    <div
                        className={styles.dropdownHeader}
                        onClick={toggleExecuting}
                    >
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
                            {isExecutingExpanded ? (
                                <ChevronUp size={16} />
                            ) : (
                                <ChevronDown size={16} />
                            )}
                        </div>
                    </div>

                    {isExecutingExpanded && (
                        <DropdownSteps steps={content.execution || []} />
                    )}
                </div>
            )}

            {/* Rendering Validation */}
            {(content.validation || isValidating) && (
                <div className={styles.dropdownContainer}>
                    <div
                        className={styles.dropdownHeader}
                        onClick={toggleValidating}
                    >
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
                            {isValidatingExpanded ? (
                                <ChevronUp size={16} />
                            ) : (
                                <ChevronDown size={16} />
                            )}
                        </div>
                    </div>

                    {isValidatingExpanded && (
                        <div className={styles.dropdownContent}>
                            <div className={styles.dropdownMarkdown}>
                                <Markdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                        pre: Pre,
                                        code({ node, inline, className = "code", children, ...props }) {
                                            const match = /language-(\w+)/.exec(className || "")
                                            return !inline && match ? (
                                                <SyntaxHighlighter
                                                    style={funky}
                                                    language={match[1]}
                                                    PreTag="div"
                                                    className="syntax-highlighter"
                                                    {...props}
                                                >
                                                    {String(children).replace(/\n$/, "")}
                                                </SyntaxHighlighter>
                                            ) : (
                                                <code className={className} {...props}>
                                                    {children}
                                                </code>
                                            )
                                        }
                                    }}
                                >
                                    {content.validation || ""}
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

            {(content.output || isSummary) && (
                <div className={styles.markdownContent}>
                    <Markdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                            pre: Pre,
                            code({ node, inline, className = "code", children, ...props }) {
                                const match = /language-(\w+)/.exec(className || "")
                                return !inline && match ? (
                                    <SyntaxHighlighter
                                        style={funky}
                                        language={match[1]}
                                        PreTag="div"
                                        className="syntax-highlighter"
                                        {...props}
                                    >
                                        {String(children).replace(/\n$/, "")}
                                    </SyntaxHighlighter>
                                ) : (
                                    <code className={className} {...props}>
                                        {children}
                                    </code>
                                )
                            },
                            div(props) {
                                return (
                                    <div className={styles.overflowContainer}>
                                        {props.children}
                                    </div>
                                );
                            }
                        }}
                    >
                        {content.output}
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