import React, { useState, useRef, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { v4 as uuid4 } from "uuid";
import toast, { Toaster } from "react-hot-toast";
import Browser from "webextension-polyfill";
import { AI, createTitle } from "@/lib/agent";
import Header from "./components/header";
import ChatContainer from "./components/chat-container";
import InputContainer from "./components/input-container";
import { parseSlashCommand, stripSlashCommands } from "./utils/slash-commands";
import { fileHandler, fileFormatsToFiles } from "./utils/file-handler";
import { availableFunctions as chatFunctions } from "@/lib/llm/tools/handlers/chat";
import {
  availableFunctions as automateFunctions,
  updateOpenedTabs,
} from "@/lib/llm/tools/handlers/automate";
import { getActiveTab } from "@/helper";
import { getAppSettings, DEFAULT_PINNED_PROMPTS } from "@/lib/client";
import { findMissingProvider, getStageConfig } from "@/lib/llm/model";
import {
  buildChatMessages,
  buildT1Messages,
  buildT2Messages,
  buildT3Messages,
  buildT4Messages,
} from "@/lib/llm/messages";
import type { StreamSession } from "@/lib/llm/stream";
import type { ExtensionMessage } from "@/lib/llm/messages";
import HistorySidebar from "./components/history-sidebar";
import Hero from "./components/hero";
import Particles from "./components/particles";
import Loader from "./components/loader";
import type {
  Message,
  MessageMode,
  Conversation,
  StreamingState,
  ToolCall,
  FileFormat,
} from "../types";
import "@/stylesheets/globals.css";

const App = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isFirstMessage, setIsFirstMessage] = useState(true);
  const [isChat, setIsChat] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [errorText, setErrorText] = useState("");
  const [message, setMessage] = useState("");
  const [mentions, setMentions] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [streaming, setStreaming] = useState<StreamingState>({
    response: false,
    execution: false,
    validation: false,
    output: false,
  });
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [missingApiKeys, setMissingApiKeys] = useState(false);
  const [pinnedPrompts, setPinnedPrompts] = useState<string[]>([...DEFAULT_PINNED_PROMPTS]);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentTitle, setCurrentTitle] = useState("New Chat");
  const [inputResetKey, setInputResetKey] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController>(null);
  const safeToAbortRef = useRef<boolean>(false);
  const generationLockRef = useRef(false);
  const dbSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const db = useRef<IDBDatabase>(null);
  const db_request = useRef<IDBOpenDBRequest>(null);
  const conversationIdRef = useRef<string>(null);
  const messageIdRef = useRef<string>(null);
  const t2SessionRef = useRef<StreamSession>({
    screenshot: null,
    screenshotMetadata: null,
    previousReasoning: "",
  });

  const checkApiKeys = async () => {
    const { settings, apiKeys } = await getAppSettings();
    const missing = (await findMissingProvider(settings.models, apiKeys)) !== null;
    setMissingApiKeys(missing);
    setPinnedPrompts(settings.pinnedPrompts);
  };

  useEffect(() => {
    initDB();
    fetchConversations();
    checkApiKeys();

    const onMessage = (request: unknown) => {
      if ((request as { action?: string })?.action === "RELOAD_PANEL") {
        window.location.reload();
      }
    };
    Browser.runtime.onMessage.addListener(onMessage);

    const handleMouseMove = (e: MouseEvent) => {
      const threshold = window.innerWidth - 10;
      if (e.clientX > threshold) {
        setSidebarHovered(true);
      } else if (e.clientX < window.innerWidth - 300) {
        setSidebarHovered(false);
      }
    };

    setTimeout(() => {
      setIsLoading(false);
    }, 800);

    document.addEventListener("mousemove", handleMouseMove);
    return () => {
      Browser.runtime.onMessage.removeListener(onMessage);
      document.removeEventListener("mousemove", handleMouseMove);
      if (dbSyncTimerRef.current) clearTimeout(dbSyncTimerRef.current);
    };
  }, []);

  const initDB = () => {
    db_request.current = indexedDB.open("WaffyDB", 1);
    db_request.current.onerror = (event) => {
      console.log("Error opening database:", event);
    };
    db_request.current.onupgradeneeded = (event) => {
      db.current = (event.target as IDBOpenDBRequest).result as IDBDatabase;
      db.current.createObjectStore("conversations", { keyPath: "id" });
    };
    db_request.current.onsuccess = (event) => {
      db.current = (event.target as IDBOpenDBRequest).result as IDBDatabase;
    };
  };

  // Resolves with the shared connection, waiting for the initial open if needed.
  const getDB = () =>
    new Promise<IDBDatabase | null>((resolve) => {
      if (db.current) {
        resolve(db.current);
        return;
      }
      const request = db_request.current;
      if (!request) {
        resolve(null);
        return;
      }
      if (request.readyState === "done") {
        resolve(request.result ?? null);
        return;
      }
      request.addEventListener("success", () => resolve(request.result));
      request.addEventListener("error", () => resolve(null));
    });

  const initConversation = async () => {
    const database = await getDB();
    if (!database || !conversationIdRef.current) return;

    await new Promise<void>((resolve) => {
      const tx = database.transaction("conversations", "readwrite");
      tx.objectStore("conversations").add({
        id: conversationIdRef.current,
        title: "New Chat",
        timestamp: new Date(),
        messages: [],
      });
      tx.oncomplete = () => {
        void fetchConversations();
        resolve();
      };
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  };

  const generateTitle = async (prompt: string) => {
    const title = await createTitle(prompt);
    setCurrentTitle(title);
    const conversationDB = db.current
      ?.transaction("conversations", "readwrite")
      .objectStore("conversations");
    if (conversationDB && conversationIdRef.current) {
      conversationDB.get(conversationIdRef.current).onsuccess = (event) => {
        const data = (event.target as IDBRequest).result;
        if (data) {
          data.title = title;
          conversationDB.put(data);
        }
      };
    }
  };

  const fetchConversations = async (): Promise<Conversation[]> => {
    const database = await getDB();
    if (!database) return [];

    return new Promise((resolve) => {
      const request = database
        .transaction("conversations", "readonly")
        .objectStore("conversations")
        .getAll();
      request.onsuccess = () => {
        const sortedData = (request.result as Conversation[]).sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        setConversations(sortedData);
        resolve(sortedData);
      };
      request.onerror = () => resolve([]);
    });
  };

  const updateConversationsDB = (updatedMessages: Message[], immediate = false): Promise<void> => {
    const write = async () => {
      const database = await getDB();
      const conversationId = conversationIdRef.current;
      if (!database || !conversationId) return;

      await new Promise<void>((resolve) => {
        const tx = database.transaction("conversations", "readwrite");
        const store = tx.objectStore("conversations");
        const getRequest = store.get(conversationId);

        getRequest.onsuccess = () => {
          const data = getRequest.result;
          if (!data) return;
          data.messages = updatedMessages;
          store.put(data);
        };

        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
        tx.onabort = () => resolve();
      });
    };

    if (immediate) {
      if (dbSyncTimerRef.current) clearTimeout(dbSyncTimerRef.current);
      return write();
    }

    if (dbSyncTimerRef.current) clearTimeout(dbSyncTimerRef.current);
    dbSyncTimerRef.current = setTimeout(() => {
      void write();
    }, 300);
    return Promise.resolve();
  };

  const syncMessages = (updatedMessages: Message[], immediate = false) => {
    void updateConversationsDB(updatedMessages, immediate);
    return updatedMessages;
  };

  const attachController = async () => {
    const tab = await getActiveTab();
    if (!tab?.id) return;
    await Browser.runtime.sendMessage({ action: "START_SESSION", tabId: tab.id });
  };

  const detachController = async () => {
    await Browser.runtime.sendMessage({ action: "STOP_SESSION" });
  };

  const automateHandler = async (
    prompt_text: string,
    prompt_files: FileFormat[],
    conversationMessages: Message[]
  ) => {
    await attachController();
    try {
      const task = await t1Handler(prompt_text, prompt_files, conversationMessages);
      if (task) {
        const t2Reasoning = await t2Handler(task, prompt_files, conversationMessages);
        if (t2Reasoning) {
          await t3Handler(task, t2Reasoning);
          await t4Handler(task, t2Reasoning);
        }
      }
    } finally {
      try {
        await detachController();
      } catch {
        console.log("Error detaching from tab");
      }
    }
  };

  const t1Handler = async (
    prompt_text: string,
    prompt_files: FileFormat[],
    conversationMessages: Message[]
  ) => {
    if (abortControllerRef.current?.signal.aborted) return;
    setStatusText("GENERATING");
    setStreaming((prev) => ({ ...prev, response: true }));
    const t1Messages = buildT1Messages(prompt_text, prompt_files, conversationMessages);
    console.log("t1Messages:", t1Messages);
    const responseStream = AI(t1Messages, "t1", abortControllerRef?.current, safeToAbortRef);
    const toolCalls: Record<string, ToolCall> = {};
    for await (const res of responseStream) {
      if (res.type === "action.call") {
        for (const [key, value] of Object.entries(res.action)) {
          toolCalls[key] = value;
        }
      }
      if (res.type === "text.stream") {
        setMessages((prev) => {
          const update = prev.map((msg) => {
            if (msg.id !== `assistant-${messageIdRef.current}`) return msg;
            const response = (msg.content.text?.response ?? "") + res.text;
            return { ...msg, content: { ...msg.content, text: { ...msg.content.text, response } } };
          });
          syncMessages(update);
          return update;
        });
      }
      if (res.type === "response.completed") {
        setMessages((prev) => syncMessages(prev, true));
      }
      if (res.type === "response.error") {
        throw res.error;
      }
    }
    setStreaming((prev) => ({ ...prev, response: false }));
    for (const toolCall of Object.values(toolCalls)) {
      const toolArgs = JSON.parse(toolCall.arguments);
      console.log("t1 toolArgs:", toolArgs);
      if (toolCall.name === "proceed") {
        setMessages((prev) =>
          syncMessages(
            prev.map((msg) =>
              msg.id === `assistant-${messageIdRef.current}`
                ? { ...msg, content: { ...msg.content, task: toolArgs.task } }
                : msg
            ),
            true
          )
        );
        return toolArgs.task;
      }
    }
    return false;
  };

  const t2Handler = async (
    task: string,
    prompt_files: FileFormat[],
    conversationMessages: Message[]
  ) => {
    if (abortControllerRef.current?.signal.aborted) return;
    setStatusText("EXECUTING");
    setStreaming((prev) => ({ ...prev, execution: true }));

    t2SessionRef.current = {
      screenshot: null,
      screenshotMetadata: null,
      previousReasoning: "",
    };

    await updateOpenedTabs();
    const overlayTab = (await Browser.runtime.sendMessage({ action: "GET_TAB" })) as {
      id?: number;
    } | null;
    if (!overlayTab || !overlayTab.id) throw new Error("Tab not found");
    await Browser.runtime.sendMessage({ action: "ENABLE_OVERLAY", tabId: overlayTab.id });

    let responded = true;
    let finish = false;
    let functionExecState = false;
    setMessages((prev) =>
      syncMessages(
        prev.map((msg) =>
          msg.id === `assistant-${messageIdRef.current}`
            ? {
                ...msg,
                content: {
                  ...msg.content,
                  text: { ...msg.content.text, execution: ["Initializing"] },
                },
              }
            : msg
        )
      )
    );

    const t2Messages = buildT2Messages(task, prompt_files, conversationMessages);
    console.log("t2History:", t2Messages);
    let t2Reasoning = "";

    while (!finish || functionExecState) {
      if (!responded) return false;
      responded = false;

      let reasoning = "";
      const executionToolCalls: Record<string, ToolCall> = {};
      const executionModelStream = AI(
        t2Messages,
        "t2",
        abortControllerRef?.current,
        safeToAbortRef,
        t2SessionRef.current
      );

      for await (const res of executionModelStream) {
        responded = true;
        if (res.type === "reasoning.delta") {
          const delta = res.text;
          reasoning += delta;
        }
        if (res.type === "action.call") {
          for (const [key, value] of Object.entries(res.action)) {
            executionToolCalls[key] = value;
          }
          if (res.step) {
            const step = res.step;
            setMessages((prev) => {
              const update = prev.map((msg) => {
                if (msg.id !== `assistant-${messageIdRef.current}`) return msg;
                const execution = [...(msg.content.text?.execution ?? []), step];
                return {
                  ...msg,
                  content: { ...msg.content, text: { ...msg.content.text, execution } },
                };
              });
              syncMessages(update);
              return update;
            });
          }
        }
        if (res.type === "response.completed") {
          if (!functionExecState) finish = true;
          setMessages((prev) => syncMessages(prev, true));
        }
        if (res.type === "response.error") {
          throw res.error;
        }
      }

      const iterationMessages: any[] = [];
      if (reasoning) {
        iterationMessages.push({
          type: "response",
          content: [{ type: "text", text: reasoning }],
        });
      }

      functionExecState = false;

      for (const toolCall of Object.values(executionToolCalls)) {
        await updateOpenedTabs();
        const toolName = toolCall.name;
        const toolArgs = JSON.parse(toolCall.arguments);
        iterationMessages.push({
          type: "action.init",
          id: toolCall.id,
          name: toolName,
          arguments: toolCall.arguments,
        });

        console.log("toolName:", toolName);
        console.log("toolArgs:", toolArgs);
        const toolCallResult = await automateFunctions[toolName](toolArgs);
        console.log("toolCallResult:", toolCallResult);
        iterationMessages.push({
          type: "action.result",
          id: toolCall.id,
          name: toolName,
          output: toolCallResult.message,
        });

        if (
          toolName === "fetchScreen" &&
          toolCallResult.status === "success" &&
          toolCallResult.data
        ) {
          iterationMessages.push(toolCallResult.data);
          if (toolCallResult.data.image) {
            t2SessionRef.current.screenshot = toolCallResult.data.image;
            t2SessionRef.current.screenshotMetadata = toolCallResult.data.metadata ?? null;
          }
        }
        functionExecState = true;
      }

      t2Reasoning += reasoning;
      console.log("t2Reasoning:", t2Reasoning);
      t2Messages.push(...iterationMessages);
    }

    setStreaming((prev) => ({ ...prev, execution: false }));
    const disableOverlayTab = (await Browser.runtime.sendMessage({ action: "GET_TAB" })) as {
      id?: number;
    } | null;
    if (!disableOverlayTab || !disableOverlayTab.id) throw new Error("Tab not found");
    await Browser.runtime.sendMessage({
      action: "DISABLE_OVERLAY",
      tabId: disableOverlayTab.id,
    });

    return t2Reasoning;
  };

  const t3Handler = async (task: string, t2Reasoning: string) => {
    if (abortControllerRef.current?.signal.aborted) return;
    setStatusText("VALIDATING");
    setStreaming((prev) => ({ ...prev, validation: true }));
    const t3Messages = buildT3Messages(task, t2Reasoning);
    const summaryModelStream = AI(t3Messages, "t3", abortControllerRef?.current, safeToAbortRef);
    const toolCalls: Record<string, ToolCall> = {};
    for await (const res of summaryModelStream) {
      if (res.type === "action.call") {
        for (const [key, value] of Object.entries(res.action)) {
          toolCalls[key] = value;
        }
      }
      if (res.type === "text.stream") {
        setMessages((prev) => {
          const update = prev.map((msg) => {
            if (msg.id !== `assistant-${messageIdRef.current}`) return msg;
            const validation = (msg.content.text?.validation ?? "") + res.text;
            return {
              ...msg,
              content: { ...msg.content, text: { ...msg.content.text, validation } },
            };
          });
          syncMessages(update);
          return update;
        });
      }
      if (res.type === "response.completed") {
        setMessages((prev) => syncMessages(prev, true));
      }
      if (res.type === "response.error") {
        throw res.error;
      }
    }
    setStreaming((prev) => ({ ...prev, validation: false }));
    for (const toolCall of Object.values(toolCalls)) {
      const statusMap: Record<string, string> = {
        success: "success",
        failed: "failed",
        suspended: "suspended",
      };
      const status = statusMap[toolCall.name];
      if (status) {
        setMessages((prev) =>
          syncMessages(
            prev.map((msg) =>
              msg.id === `assistant-${messageIdRef.current}`
                ? { ...msg, content: { ...msg.content, taskStatus: status } }
                : msg
            ),
            true
          )
        );
      }
    }
  };

  const t4Handler = async (task: string, t2Reasoning: string) => {
    if (abortControllerRef.current?.signal.aborted) return;
    setStatusText("FINALIZING");
    setStreaming((prev) => ({ ...prev, output: true }));
    const t4Messages = buildT4Messages(task, t2Reasoning);
    const summaryModelStream = AI(t4Messages, "t4", abortControllerRef?.current, safeToAbortRef);
    for await (const res of summaryModelStream) {
      if (res.type === "text.stream") {
        setMessages((prev) => {
          const update = prev.map((msg) => {
            if (msg.id !== `assistant-${messageIdRef.current}`) return msg;
            const output = (msg.content.text?.output ?? "") + res.text;
            return { ...msg, content: { ...msg.content, text: { ...msg.content.text, output } } };
          });
          syncMessages(update);
          return update;
        });
      }
      if (res.type === "response.completed") {
        setMessages((prev) => syncMessages(prev, true));
      }
      if (res.type === "response.error") {
        throw res.error;
      }
    }
    setStreaming((prev) => ({ ...prev, output: false }));
  };

  const chatHandler = async (
    prompt_text: string,
    prompt_files: FileFormat[],
    conversationMessages: Message[]
  ) => {
    if (abortControllerRef.current?.signal.aborted) return;
    setStatusText("GENERATING");
    setStreaming((prev) => ({ ...prev, response: true }));

    const chatMessages = buildChatMessages(prompt_text, prompt_files, conversationMessages);
    let finish = false;
    let functionExecState = false;

    while (!finish || functionExecState) {
      if (abortControllerRef.current?.signal.aborted) return;

      let textResponse = "";
      const chatToolCalls: Record<string, ToolCall> = {};
      const chatStream = AI(chatMessages, "chat", abortControllerRef?.current, safeToAbortRef);

      for await (const res of chatStream) {
        if (res.type === "text.stream") {
          textResponse += res.text;
          setMessages((prev) => {
            const update = prev.map((msg) => {
              if (msg.id !== `assistant-${messageIdRef.current}`) return msg;
              const response = (msg.content.text?.response ?? "") + res.text;
              return {
                ...msg,
                content: { ...msg.content, text: { ...msg.content.text, response } },
              };
            });
            syncMessages(update);
            return update;
          });
        }
        if (res.type === "action.call") {
          for (const [key, value] of Object.entries(res.action)) {
            chatToolCalls[key] = value;
          }
        }
        if (res.type === "response.completed") {
          if (!functionExecState) finish = true;
          setMessages((prev) => syncMessages(prev, true));
        }
        if (res.type === "response.error") {
          throw res.error;
        }
      }

      console.log("textResponse:", textResponse);
      const iterationMessages: ExtensionMessage[] = [];
      if (textResponse) {
        iterationMessages.push({
          type: "response",
          content: [{ type: "text", text: textResponse }],
        });
      }

      functionExecState = false;

      for (const toolCall of Object.values(chatToolCalls)) {
        const toolName = toolCall.name;
        console.log("toolCall:", toolCall);

        iterationMessages.push({
          type: "action.init",
          id: toolCall.id,
          name: toolName,
          arguments: toolCall.arguments,
        });

        const toolArgs = JSON.parse(toolCall.arguments);
        const toolCallResult = await chatFunctions[toolName](toolArgs);

        iterationMessages.push({
          type: "action.result",
          id: toolCall.id,
          name: toolName,
          output: toolCallResult.message,
        });
        console.log("toolCallResult:", toolCallResult);

        if (
          toolName === "captureScreenshot" &&
          toolCallResult.status === "success" &&
          toolCallResult.data
        ) {
          iterationMessages.push({
            type: "screenshot",
            image: toolCallResult.data.image,
            metadata: toolCallResult.data.metadata,
          });
        }

        functionExecState = true;
      }

      chatMessages.push(...iterationMessages);
    }

    setStreaming((prev) => ({ ...prev, response: false }));
  };

  const displayError = (error?: unknown) => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    setIsGenerating(false);
    let errorMessage = "Something went wrong. Please try again.";
    if (typeof error === "string") errorMessage = error;
    else if (error instanceof Error) errorMessage = error.message;
    setErrorText(errorMessage);
  };

  const ensureProvidersConfigured = async () => {
    const { settings, apiKeys } = await getAppSettings();
    const missingStage = await findMissingProvider(settings.models, apiKeys);
    if (!missingStage) return true;

    const provider = getStageConfig(settings.models, missingStage).provider;
    if (provider === "browser-ai") {
      toast.error("Download Browser AI in extension settings.");
    } else {
      toast.error("Configure API keys in extension settings.");
    }
    void Browser.runtime.openOptionsPage();
    return false;
  };

  const sendMessage = async ({
    promptText,
    promptFiles,
    isAutomate,
    messageId,
    conversationContext,
    prepareMessages,
    clearInput = false,
  }: {
    promptText: string;
    promptFiles: FileFormat[];
    isAutomate: boolean;
    messageId: string;
    conversationContext: Message[];
    prepareMessages: () => void | Promise<void>;
    clearInput?: boolean;
  }) => {
    if (generationLockRef.current) return;
    generationLockRef.current = true;

    try {
      if (!(await ensureProvidersConfigured())) return;

      messageIdRef.current = messageId;
      setIsGenerating(true);
      setStreamingMessageId(`assistant-${messageId}`);
      setStatusText("INITIALIZING");
      setErrorText("");
      abortControllerRef.current = new AbortController();

      const inputEl = textareaRef.current;
      if (clearInput && inputEl) {
        inputEl.style.color = "#909090";
      }

      try {
        await prepareMessages();

        if (isAutomate) {
          await automateHandler(promptText, promptFiles, conversationContext);
        } else {
          await chatHandler(promptText, promptFiles, conversationContext);
        }
      } catch (error: unknown) {
        displayError(error);
      } finally {
        setStreaming({ response: false, execution: false, validation: false, output: false });
        setStreamingMessageId(null);
        setIsGenerating(false);
        setStatusText("");
        if (clearInput) {
          setMessage("");
          setMentions([]);
          setFiles([]);
          setInputResetKey((key) => key + 1);
          if (inputEl) {
            inputEl.style.height = "auto";
            inputEl.style.color = "#ffffff";
          }
        } else {
          textareaRef.current?.focus();
        }
        messageIdRef.current = null;
        abortControllerRef.current = null;
        safeToAbortRef.current = false;
      }
    } finally {
      generationLockRef.current = false;
    }
  };

  const handleSendMessage = async () => {
    if ((!message.trim() && files.length === 0) || isGenerating || generationLockRef.current) {
      return;
    }

    const command = parseSlashCommand(mentions, message);
    const isAutomate = command === "automate";
    const messageId = uuid4();
    const promptText = command ? stripSlashCommands(message) : message.trim();
    const promptFiles = await fileHandler(files);

    if (!promptText && promptFiles.length === 0) {
      toast.error(command ? `Add a message after /${command}` : "Message cannot be empty");
      return;
    }

    const wasFirstMessage = isFirstMessage;
    const conversationContext = messages;

    await sendMessage({
      promptText,
      promptFiles,
      isAutomate,
      messageId,
      conversationContext,
      clearInput: true,
      prepareMessages: async () => {
        if (wasFirstMessage) {
          setIsChat(true);
          setIsFirstMessage(false);
          conversationIdRef.current = uuid4();
          await initConversation();
        }

        setMessages((prev) => {
          const update = [
            ...prev,
            {
              id: `user-${messageId}`,
              content: { text: { prompt: promptText }, files: promptFiles },
            },
            {
              id: `assistant-${messageId}`,
              content: {
                task: "",
                taskStatus: "",
                text: { response: "", execution: [], validation: "", output: "" },
                files: [],
                mode: (isAutomate ? "automate" : "chat") as MessageMode,
              },
            },
          ];
          syncMessages(update, true);
          return update;
        });

        if (wasFirstMessage) {
          generateTitle(promptText)
            .then(() => fetchConversations())
            .catch(() => {});
        }
      },
    });
  };

  const handleRetryMessage = async (assistantMessageId: string) => {
    if (isGenerating || generationLockRef.current || !assistantMessageId.startsWith("assistant-")) {
      return;
    }

    const assistantIndex = messages.findIndex((msg) => msg.id === assistantMessageId);
    if (assistantIndex < 1) return;

    const userMsg = messages[assistantIndex - 1];
    const assistantMsg = messages[assistantIndex];
    if (!userMsg?.id.startsWith("user-") || !assistantMsg) return;

    const promptText = userMsg.content.text?.prompt ?? "";
    const promptFiles = userMsg.content.files ?? [];
    if (!promptText && promptFiles.length === 0) {
      toast.error("Cannot retry an empty message");
      return;
    }

    const isAutomate = assistantMsg.content.mode === "automate";

    await sendMessage({
      promptText,
      promptFiles,
      isAutomate,
      messageId: assistantMessageId.slice("assistant-".length),
      conversationContext: messages.slice(0, assistantIndex - 1),
      prepareMessages: () => {
        setMessages((prev) => {
          const update = prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: {
                    task: "",
                    taskStatus: "",
                    text: { response: "", execution: [], validation: "", output: "" },
                    files: [],
                    mode: (isAutomate ? "automate" : "chat") as MessageMode,
                  },
                }
              : msg
          );
          syncMessages(update, true);
          return update;
        });
      },
    });
  };

  const handleRevertMessage = async (userMessageId: string) => {
    if (isGenerating || generationLockRef.current || !userMessageId.startsWith("user-")) return;

    const userIndex = messages.findIndex((msg) => msg.id === userMessageId);
    if (userIndex < 0) return;

    const userMsg = messages[userIndex];
    const promptText = userMsg.content.text?.prompt ?? "";
    const promptFiles = userMsg.content.files ?? [];
    const remainingMessages = messages.slice(0, userIndex);
    const conversationId = conversationIdRef.current;

    setMessages(remainingMessages);
    await updateConversationsDB(remainingMessages, true);
    if (conversationId) {
      setConversations((prev) =>
        prev.map((conversation) =>
          conversation.id === conversationId
            ? { ...conversation, messages: remainingMessages }
            : conversation
        )
      );
    }

    setMentions([]);
    setMessage(promptText);
    setFiles(await fileFormatsToFiles(promptFiles));
    setErrorText("");
    textareaRef.current?.focus();
  };

  const handleStopGeneration = async () => {
    if (safeToAbortRef.current) {
      const currentMessageId = messageIdRef.current;
      abortControllerRef.current?.abort();
      if (currentMessageId) {
        setMessages((prev) => {
          const update = prev.map((msg) =>
            msg.id === `assistant-${currentMessageId}`
              ? { ...msg, content: { ...msg.content, aborted: true } }
              : msg
          );
          syncMessages(update, true);
          return update;
        });
      }
    }
  };

  const handlePromptClick = (prompt: string) => {
    setMessage(prompt);
    textareaRef.current?.focus();
  };

  const handleNewChat = async () => {
    await handleStopGeneration();
    fetchConversations();
    setIsFirstMessage(true);
    setMessages([]);
    conversationIdRef.current = null;
    setCurrentTitle("New Chat");
    setStatusText("");
    setErrorText("");
    setMessage("");
    setMentions([]);
    setFiles([]);
    setIsChat(false);
    setInputResetKey((key) => key + 1);
  };

  const handleSelectConversation = async (id: string) => {
    if (id === conversationIdRef.current) return;
    const latestConversations = await fetchConversations();
    const conversation = latestConversations.find((c) => c.id === id);
    if (conversation) {
      await handleStopGeneration();
      setMessages([]);
      await new Promise((resolve) => setTimeout(resolve, 100));
      setIsFirstMessage(false);
      setMessages(conversation.messages);
      conversationIdRef.current = id;
      setMessage("");
      setMentions([]);
      setFiles([]);
      setErrorText("");
      setCurrentTitle(conversation.title);
      setIsChat(true);
      setInputResetKey((key) => key + 1);
    }
  };

  const handleItemRemove = async (id: string) => {
    const conversation = conversations.find((c) => c.id === id);
    if (conversation) {
      const conversationDB = db.current
        ?.transaction("conversations", "readwrite")
        .objectStore("conversations");
      conversationDB?.delete(id);
      await fetchConversations();
      if (conversationIdRef.current === id) {
        handleNewChat();
      }
      toast.success("Deleted Successfully", { duration: 1500 });
      textareaRef.current?.focus();
    }
  };

  if (isLoading) {
    return <Loader />;
  }

  return (
    <>
      <Toaster position="top-center" reverseOrder={false} />
      <Particles quantity={100} />
      <HistorySidebar
        currentConversationId={conversationIdRef.current}
        conversations={conversations}
        visible={sidebarHovered}
        onSelectConversation={handleSelectConversation}
        onRemoveConversation={handleItemRemove}
      />
      <div className="w-full h-screen flex flex-col relative overflow-hidden">
        <Header
          currentConversationId={conversationIdRef.current}
          currentTitle={currentTitle}
          onNewChat={handleNewChat}
        />
        {missingApiKeys && (
          <div
            style={{
              padding: "8px 16px",
              background: "#3d2a00",
              color: "#f5c542",
              fontSize: "13px",
              textAlign: "center",
            }}
          >
            Models not configured.{" "}
            <button
              style={{
                color: "#fff",
                textDecoration: "underline",
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
              onClick={() => void Browser.runtime.openOptionsPage()}
            >
              Open Settings
            </button>
          </div>
        )}
        <Hero hidden={isChat} pinnedPrompts={pinnedPrompts} onPromptClick={handlePromptClick} />
        <ChatContainer
          hidden={!isChat}
          messages={messages}
          streaming={streaming}
          streamingMessageId={streamingMessageId}
          isGenerating={isGenerating}
          statusText={statusText}
          errorText={errorText}
          setErrorText={setErrorText}
          onRetryMessage={handleRetryMessage}
          onRevertMessage={handleRevertMessage}
        />
        <InputContainer
          isGenerating={isGenerating}
          textareaRef={textareaRef}
          fileInputRef={fileInputRef as React.RefObject<HTMLInputElement>}
          message={message}
          mentions={mentions}
          files={files}
          inputResetKey={inputResetKey}
          setMessage={setMessage}
          setMentions={setMentions}
          setFiles={setFiles}
          onSendMessage={handleSendMessage}
          onStopGeneration={handleStopGeneration}
        />
      </div>
    </>
  );
};

ReactDOM.createRoot(document.getElementById("_app")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
