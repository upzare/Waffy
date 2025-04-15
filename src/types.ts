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
    models: Model[];
    currentModel: string;
    currentTitle: string;
    conversations: Conversation[];
    conversationID: React.MutableRefObject<string>;
    isNewChat: boolean;
    onNewChat: () => void;
    onSelectConversation: (id: string) => void;
    onSelectModel: (id: string) => void;
    onItemRemove: (id: string) => void;
}

export interface HomeProps {
    homeSection: React.RefObject<HTMLDivElement>;
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