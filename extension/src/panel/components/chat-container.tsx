import { useEffect, useRef } from "react";
import toast from "react-hot-toast";
import RenderResponse from "./render-response";
import { Copy, File, Repeat, Undo2, X } from "lucide-react";
import type { ChatContainerProps, FileFormat, Message } from "../../types";

const getMessageMarkdown = (msg: Message) => {
  const parts = [msg.content.text?.response, msg.content.text?.output].filter(
    (part): part is string => Boolean(part?.trim())
  );
  return parts.join("\n\n");
};

const actionButtonClass =
  "flex items-center justify-center w-6.5 h-6.5 rounded bg-transparent border-none text-[rgba(255,255,255,0.7)] cursor-pointer transition-all duration-200 ease-in-out hover:bg-[rgba(0,200,83,0.15)] hover:text-[rgba(0,200,83,1)] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[rgba(255,255,255,0.7)] disabled:active:scale-100";

const MessageFiles = ({
  files,
  onFileClick,
}: {
  files: FileFormat[];
  onFileClick: (file: FileFormat) => void;
}) => (
  <>
    {files.map((file, fileIndex) => (
      <div
        key={`${file.payload.name}-${fileIndex}`}
        className="py-2 px-4 mt-2 mr-4 mb-0.5 ml-0 rounded-md flex items-center gap-1.5 bg-border cursor-pointer transition-all duration-200 ease-in-out hover:bg-[rgba(255,255,255,0.15)]"
        onClick={() => onFileClick(file)}
      >
        {file.payload.mimeType.startsWith("image/") ? (
          <img
            src={`data:${file.payload.mimeType};base64,${file.payload.content}`}
            className="w-4 h-4 object-contain"
            alt={file.payload.name}
          />
        ) : (
          <File className="h-4 w-4 stroke-white" />
        )}
        <span
          className="flex-1 text-xs overflow-hidden text-ellipsis whitespace-nowrap"
          title={file.payload.name}
        >
          {file.payload.name}
        </span>
      </div>
    ))}
  </>
);

const ChatContainer: React.FC<ChatContainerProps> = ({
  hidden,
  messages,
  streaming,
  streamingMessageId,
  isGenerating,
  statusText,
  errorText,
  setErrorText,
  onRetryMessage,
  onRevertMessage,
}) => {
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const pinnedToBottomRef = useRef(true);

  const handleFileClick = async (file: FileFormat) => {
    const response = await fetch(`data:${file.payload.mimeType};base64,${file.payload.content}`);
    const url = URL.createObjectURL(await response.blob());
    window.open(url);
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const handleCopyMessage = async (msg: Message) => {
    const markdown = getMessageMarkdown(msg);
    if (!markdown) {
      toast.error("Nothing to copy");
      return;
    }
    try {
      await navigator.clipboard.writeText(markdown);
      toast.success("Copied to clipboard", { duration: 1500 });
    } catch {
      toast.error("Failed to copy");
    }
  };

  // Track whether the user is at the bottom, so streaming updates only
  // auto-scroll when they haven't scrolled up to read earlier messages.
  const handleScroll = () => {
    const el = chatContainerRef.current;
    if (!el) return;
    pinnedToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  };

  useEffect(() => {
    const el = chatContainerRef.current;
    if (el && pinnedToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  return (
    <>
      {isGenerating && !hidden && (
        <div className="flex justify-center items-center p-1 gap-1 bg-[#ffffff10] shadow-[0_10px_25px_0_#000000b0] backdrop-brightness-[0.1] z-10">
          <div className="w-5 h-5 inline-block relative before:content-[''] after:content-[''] before:box-border after:box-border before:w-5 before:h-5 after:w-5 after:h-5 before:rounded-full after:rounded-full before:bg-green-400 after:bg-green-400 before:absolute after:absolute before:left-0 after:left-0 before:top-0 after:top-0 before:animate-iconloader after:animate-iconloader after:[animation-delay:1s] after:opacity-0"></div>
          <span className="text-[0.6rem] text-white">{statusText}</span>
        </div>
      )}
      {errorText && !hidden && (
        <div className="flex justify-between items-center py-3 px-4 bg-[rgba(255,50,50,0.15)] shadow-[0_10px_25px_0_#000000b0] backdrop-blur-sm z-10">
          <span className="text-xs text-[#ffcccc] flex-1">{errorText}</span>
          <button
            className="bg-transparent border-none text-[#ffcccc] cursor-pointer flex items-center justify-center p-0 ml-2 transition-colors duration-200 ease-in-out hover:text-white"
            onClick={() => setErrorText("")}
            title="Dismiss"
          >
            <X size={16} />
          </button>
        </div>
      )}
      <div
        className={`flex flex-col gap-4 items-center z-1 ${
          hidden
            ? "max-h-0 max-w-0 opacity-0 m-0 p-0 overflow-hidden"
            : "flex-1 overflow-y-auto pb-4"
        }`}
        ref={chatContainerRef}
        onScroll={handleScroll}
        style={{ paddingTop: hidden ? 0 : "1rem" }}
      >
        {messages.map((msg) => {
          const isUser = msg.id.startsWith("user-");
          const isStreamingMessage = msg.id === streamingMessageId;
          const files = msg.content.files ?? [];

          return (
            <div
              key={msg.id}
              className={`group relative flex gap-4 text-sm py-4 px-6 rounded-lg animate-fade-in-message w-[95%] transition-all duration-200 ease-out${
                isUser
                  ? " bg-[rgba(0,255,70,0.03)] border border-[rgba(0,255,70,0.08)] backdrop-blur-[2px] hover:shadow-[0_0px_10px_1px_#ffffff20] hover:backdrop-blur-[3px]"
                  : " bg-[rgba(255,255,255,0.05)] border border-border backdrop-blur-xs hover:shadow-[0_0px_10px_1px_#ffffff2b] hover:backdrop-blur-[5px]"
              }`}
            >
              <div className="absolute -top-2.5 right-1 z-5 opacity-0 translate-y-1 transition-[opacity,transform] duration-200 ease-in-out pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto">
                <div className="flex gap-1 bg-[rgba(15,15,15,0.8)] backdrop-blur-sm p-0.5 rounded-md border border-border">
                  {isUser ? (
                    <button
                      className={actionButtonClass}
                      title="Edit message"
                      disabled={isGenerating}
                      onClick={() => onRevertMessage(msg.id)}
                    >
                      <Undo2 size={16} />
                    </button>
                  ) : (
                    <>
                      <button
                        className={actionButtonClass}
                        title="Retry"
                        disabled={isGenerating}
                        onClick={() => onRetryMessage(msg.id)}
                      >
                        <Repeat size={16} />
                      </button>
                      <button
                        className={actionButtonClass}
                        title="Copy to clipboard"
                        disabled={isGenerating}
                        onClick={() => handleCopyMessage(msg)}
                      >
                        <Copy size={16} />
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="flex-1 whitespace-normal wrap-break-word overflow-hidden">
                {isUser ? (
                  <>
                    {msg.content.text?.prompt}
                    {files.length > 0 && (
                      <MessageFiles files={files} onFileClick={handleFileClick} />
                    )}
                  </>
                ) : (
                  <>
                    <RenderResponse
                      content={msg.content.text}
                      isInitial={isStreamingMessage && streaming.response}
                      isExecuting={isStreamingMessage && streaming.execution}
                      isValidating={isStreamingMessage && streaming.validation}
                      isOutput={isStreamingMessage && streaming.output}
                      taskStatus={msg.content?.taskStatus}
                    />
                    {files.length > 0 && (
                      <MessageFiles files={files} onFileClick={handleFileClick} />
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};

export default ChatContainer;
