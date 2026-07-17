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
  pinnedPrompts: string[];
  onPromptClick: (prompt: string) => void;
}

export interface SuggestedPromptProps {
  text: string;
  onClick?: () => void;
}

export interface StreamingState {
  response: boolean;
  execution: boolean;
  validation: boolean;
  output: boolean;
}

export interface ChatContainerProps {
  hidden: boolean;
  messages: Message[];
  streaming: StreamingState;
  streamingMessageId: string | null;
  isGenerating: boolean;
  statusText: string;
  errorText: string;
  setErrorText: (error: string) => void;
  onRetryMessage: (assistantMessageId: string) => Promise<void>;
  onRevertMessage: (userMessageId: string) => Promise<void>;
}

export interface InputContainerProps {
  isGenerating: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  fileInputRef: React.RefObject<HTMLInputElement>;
  message: string;
  mentions: string[];
  files: File[];
  setMessage: React.Dispatch<React.SetStateAction<string>>;
  setMentions: React.Dispatch<React.SetStateAction<string[]>>;
  setFiles: React.Dispatch<React.SetStateAction<File[]>>;
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

export type MessageMode = "chat" | "automate";

export interface Message {
  id: string;
  content: {
    text?: {
      prompt?: string;
      response?: string;
      execution?: string[];
      validation?: string;
      output?: string;
    };
    files?: FileFormat[];
    task?: string;
    taskStatus?: string;
    aborted?: boolean;
    mode?: MessageMode;
  };
}

export interface FileFormat {
  type: string;
  payload: { name: string; size: number; mimeType: string; content: string };
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
  quantity?: number;
  staticity?: number;
  ease?: number;
  refresh?: boolean;
}

export interface Settings {
  theme: string;
  enableHistory: boolean;
  enableNotifications: boolean;
  pinnedPrompts: string[];
  models: Partial<Record<StageId, ModelConfig>>;
}

export type ProviderId =
  | "openai"
  | "anthropic"
  | "google"
  | "xai"
  | "groq"
  | "openrouter"
  | "browser-ai";

export type StageId = "title" | "chat" | "t1" | "t2" | "t3" | "t4" | "step";

export interface ModelConfig {
  provider: ProviderId;
  model: string;
}

export interface ApiKeys {
  openai?: string;
  anthropic?: string;
  google?: string;
  xai?: string;
  groq?: string;
  openrouter?: string;
}

export interface AppSettings {
  settings: Settings;
  apiKeys: ApiKeys;
}

export interface DomProps {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: string;
  content: string;
  interactivity: boolean;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}
