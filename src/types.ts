export interface Conversation {
    id: string;
    title: string;
    timestamp: Date;
    messages: Message[];
}

export interface Model {
    id: string;
    name: string;
    description: string;
}

export interface HeaderProps {
    currentTitle: string;
    isNewChat: boolean;
    onNewChat: () => void;
}

export interface HeroProps {
    homeSection: React.RefObject<HTMLDivElement>;
    onPromptClick: (prompt: string) => void;
}

export interface SuggestedPromptProps {
  text: string;
  onClick?: () => void;
}

export interface ChatContainerProps {
    messages: Message[];
}

export interface InputContainerProps {
    isGenerating: boolean;
    isRecording: boolean;
    textareaRef: React.RefObject<HTMLTextAreaElement>;
    fileInputRef: React.RefObject<HTMLInputElement>;
    message: string;
    files: File[];
    setMessage: React.Dispatch<React.SetStateAction<string>>;
    setFiles: React.Dispatch<React.SetStateAction<File[]>>;
    onSpeechRecognition: () => Promise<void>;
    onSendMessage: () => Promise<void>;
    onStopGeneration: () => Promise<void>;
}

export interface HistorySidebarProps {
    conversations: Conversation[];
    visible: boolean;
    onSelectConversation: (id: string) => void;
    onRemoveConversation: (id: string) => void;
    currentConversationId: string;
}

export interface Message {
    id: string;
    content: { text?: string, files?: File[], tool?: { toolCall?: { type: string, toolCallId: string, toolName: string, args: any }, toolResult?: { type: string, toolCallId: string, toolName: string, args: any, result: any } } };
    isUser: boolean;
    isTool: boolean;
    isStreaming?: boolean;
    isError?: boolean;
}

export interface StorageResult {
    isActive?: boolean;
}

export interface TextMessage {
    key: string;
    type: string;
    value: string;
}

export interface ToggleMessage {
    type: string;
    isActive: boolean;
}

export interface DomMessage {
    type: string;
    dom: string;
}

export interface ParticlesProps {
    className?: string;
    quantity?: number;
    staticity?: number;
    ease?: number;
    refresh?: boolean;
}

export interface Settings {
    geminiApiKey: string;
    gptAPIKey: string;
    systemPrompt: string;
    fetchPrompt: string;
}

export interface DomProps {
    id: string,
    x: number,
    y: number,
    width: number,
    height: number,
    type: string,
    content: string,
    interactivity: boolean
}

export interface ToolCall {
    arguments: string;
    call_id: string;
    id: string;
    name: string;
    status: string;
    type: string;
}