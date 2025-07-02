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
    currentConversationId: string | null;
    currentTitle: string;
    onNewChat: () => void;
}

export interface HeroProps {
    hidden: boolean;
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
    currentConversationId: string | null;
    conversations: Conversation[];
    visible: boolean;
    onSelectConversation: (id: string) => void;
    onRemoveConversation: (id: string) => void;
}

export interface Message {
    id: string;
    content: { text?: { t0?: string, t1?: string, t2?: string, t3?: string, t4?: string }, files?: File[], task?: string, taskStatus?: string };
    streaming?: { t1?: boolean, t2?: boolean, t3?: boolean, t4?: boolean };
    isUser: boolean;
    isError?: boolean;
    task?: string;
}

export interface FileFormat {
    type: string,
    payload: Record<string, any>
};

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
    quantity?: number;
    staticity?: number;
    ease?: number;
    refresh?: boolean;
}

export interface Settings {
    client_id: string;
    trace_user_id: string;
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
    id: string;
    type: string;
    arguments: string;
    call_id: string;
    name: string;
    status: string;
}