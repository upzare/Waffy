import { useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { funky } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check, ChevronDown, ChevronUp, Loader2, CheckCircle2 } from 'lucide-react';
import styles from "css/panel/RenderResponse.module.css";

const RenderResponse = ({
    content,
    isInitial = false,
    isPlanning = false,
    isExecuting = false,
    isSummary = false,
    error = false
}) => {
    const [CopyIcon, setCopyIcon] = useState(Copy);
    const [isPlannningExpanded, setIsPlannningExpanded] = useState(false);
    const [isExecutingExpanded, setIsExecutingExpanded] = useState(false);

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

    const togglePlannning = () => {
        setIsPlannningExpanded(!isPlannningExpanded);
    };

    const toggleExecuting = () => {
        setIsExecutingExpanded(!isExecutingExpanded);
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
                        {content.t0}
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
                    {content.t1}
                </Markdown>
            </div>

            {/* Rendering Steps */}
            {(content.t2 || isPlanning) && (
                <div className={styles.dropdownContainer}>
                    <div
                        className={styles.dropdownHeader}
                        onClick={togglePlannning}
                    >
                        <div className={styles.dropdownHeaderLeft}>
                            {isPlanning ? (
                                <>
                                    <Loader2 size={16} className={styles.dropdownLoadingIcon} />
                                    <span className={styles.dropdownLabel}>Calculating Steps</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 size={16} className={styles.dropdownCompleteIcon} />
                                    <span className={styles.dropdownLabel}>Steps Calculated</span>
                                </>
                            )}
                        </div>
                        <div className={styles.dropdownToggle}>
                            {isPlannningExpanded ? (
                                <ChevronUp size={16} />
                            ) : (
                                <ChevronDown size={16} />
                            )}
                        </div>
                    </div>

                    {isPlannningExpanded && (
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
                                    {content.t2 || ""}
                                </Markdown>
                            </div>

                            {isPlanning && (
                                <div className={styles.dropdownLoading}>
                                    <div className={styles.dropdownLoadingDots}>
                                        <span></span>
                                        <span></span>
                                        <span></span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Rendering Execution */}
            {(content.t3 || isExecuting) && (
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
                                    {content.t3 || ""}
                                </Markdown>
                            </div>

                            {isExecuting && (
                                <div className={styles.dropdownLoading}>
                                    <div className={styles.dropdownLoadingDots}>
                                        <span></span>
                                        <span></span>
                                        <span></span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {(content.t4 || isSummary) && (
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
                        {content.t4}
                    </Markdown>
                </div>
            )}

            {(isInitial || isSummary) && (
                <div className={styles.loadingIndicator}>
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            )}
        </div>
    );
};

export default RenderResponse;