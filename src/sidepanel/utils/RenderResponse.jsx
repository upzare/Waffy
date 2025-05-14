import { useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { funky } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check, ChevronDown, ChevronUp, Loader2, CheckCircle2 } from 'lucide-react';

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
            <pre className="code-block">
                <div className="code-header">
                    <span className="language-label">{language}</span>
                    <div
                        className="copy-button"
                        title="Copy Code"
                        onClick={() => handleClick(children.props.children)}
                    >
                        {<CopyIcon size={16} />}
                    </div>
                </div>
                <div className="code-content">{children}</div>
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
            <div className="response-container">
                {/* Rendering Error Response */}
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
                                <div className="overflow-container">
                                    {props.children}
                                </div>
                            );
                        }
                    }}
                    className="markdown-content"
                >
                    {content.t0}
                </Markdown>
            </div>
        )
    }

    return (
        <div className="response-container">
            {/* Rendering Initial Response */}
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
                            <div className="overflow-container">
                                {props.children}
                            </div>
                        );
                    }
                }}
                className="markdown-content"
            >
                {content.t1}
            </Markdown>

            {/* Rendering Steps */}
            {(content.t2 || isPlanning) && (
                <div className="dropdown-container">
                    <div
                        className="dropdown-header"
                        onClick={togglePlannning}
                    >
                        <div className="dropdown-header-left">
                            {isPlanning ? (
                                <>
                                    <Loader2 size={16} className="dropdown-loading-icon" />
                                    <span className="dropdown-label">Calculating Steps</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 size={16} className="dropdown-complete-icon" />
                                    <span className="dropdown-label">Steps Calculated</span>
                                </>
                            )}
                        </div>
                        <div className="dropdown-toggle">
                            {isPlannningExpanded ? (
                                <ChevronUp size={16} />
                            ) : (
                                <ChevronDown size={16} />
                            )}
                        </div>
                    </div>

                    {isPlannningExpanded && (
                        <div className="dropdown-content">
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
                                className="dropdown-markdown"
                            >
                                {content.t2 || ""}
                            </Markdown>

                            {isPlanning && (
                                <div className="dropdown-loading">
                                    <div className="dropdown-loading-dots">
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
                <div className="dropdown-container">
                    <div
                        className="dropdown-header"
                        onClick={toggleExecuting}
                    >
                        <div className="dropdown-header-left">
                            {isExecuting ? (
                                <>
                                    <Loader2 size={16} className="dropdown-loading-icon" />
                                    <span className="dropdown-label">Executing Actions</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 size={16} className="dropdown-complete-icon" />
                                    <span className="dropdown-label">Actions Executed</span>
                                </>
                            )}
                        </div>
                        <div className="dropdown-toggle">
                            {isExecutingExpanded ? (
                                <ChevronUp size={16} />
                            ) : (
                                <ChevronDown size={16} />
                            )}
                        </div>
                    </div>

                    {isExecutingExpanded && (
                        <div className="dropdown-content">
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
                                className="dropdown-markdown"
                            >
                                {content.t3 || ""}
                            </Markdown>

                            {isExecuting && (
                                <div className="dropdown-loading">
                                    <div className="dropdown-loading-dots">
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
                                <div className="overflow-container">
                                    {props.children}
                                </div>
                            );
                        }
                    }}
                    className="markdown-content"
                >
                    {content.t4}
                </Markdown>
            )}

            {(isInitial || isSummary) && (
                <div className="loading-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            )}
        </div>
    );
};

export default RenderResponse;