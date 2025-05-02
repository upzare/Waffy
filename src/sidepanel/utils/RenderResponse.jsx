import { useState } from "react";
import Markdown from "react-markdown";
import { Copy, Check } from "lucide-react";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import remarkGfm from 'remark-gfm';
import { funky } from 'react-syntax-highlighter/dist/esm/styles/prism';

export default function RenderResponse({ content }) {
  const Pre = ({ children }) => {
    const [CopyIcon, setCopyIcon] = useState(Copy);
    
    const handleClick = () => {
      navigator.clipboard.writeText(children.props.children);
      setCopyIcon(Check);
      setTimeout(() => {
        setCopyIcon(Copy);
      }, 2000);
    }
    
    const match = /language-(\w+)/.exec(children.props.className || "");
    const language = match ? match[1].toUpperCase() : "TEXT";
    
    return (
      <pre className="code-block">
        <div className="code-header">
          <span className="language-label">{language}</span>
          <div
            className="copy-button"
            title="Copy Code"
            onClick={handleClick}
          >
            {<CopyIcon />}
          </div>
        </div>
        <div className="code-content">{children}</div>
      </pre>
    );
  }
  
  return (
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
      {content}
    </Markdown>
  );
};