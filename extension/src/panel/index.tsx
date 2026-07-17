import React, { useState, useRef, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { v4 as uuid4 } from "uuid";
import toast, { Toaster } from "react-hot-toast";
import { AI, createTitle } from "@/lib/agent";
import Header from "./components/header";
import ChatContainer from "./components/chat-container";
import InputContainer from "./components/input-container";
import { parseSlashCommand, stripSlashCommands } from "./utils/slash-commands";
import { fileHandler } from "./utils/file-handler";
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
import type { Message, Conversation, StreamingState, ToolCall, FileFormat } from "../types";
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
  const [missingApiKeys, setMissingApiKeys] = useState(false);
  const [pinnedPrompts, setPinnedPrompts] = useState<string[]>([...DEFAULT_PINNED_PROMPTS]);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentTitle, setCurrentTitle] = useState("New Chat");

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController>(null);
  const safeToAbortRef = useRef<boolean>(false);
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

    const onMessage = (request: { action?: string }) => {
      if (request.action === "RELOAD_PANEL") {
        window.location.reload();
      }
    };
    chrome.runtime.onMessage.addListener(onMessage);

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
      chrome.runtime.onMessage.removeListener(onMessage);
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

  const initConversation = async () => {
    const conversationDB = db.current
      ?.transaction("conversations", "readwrite")
      .objectStore("conversations");
    conversationDB?.add({
      id: conversationIdRef.current,
      title: "New Chat",
      timestamp: new Date(),
      messages: [],
    });
    fetchConversations();
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

  const fetchConversations = async () => {
    const dbr: IDBOpenDBRequest = indexedDB.open("WaffyDB", 1);
    dbr.onsuccess = (dbEvent) => {
      (dbEvent.target as IDBOpenDBRequest).result
        .transaction("conversations", "readwrite")
        .objectStore("conversations")
        .getAll().onsuccess = (event) => {
          const data = (event.target as IDBRequest).result;
          const sortedData = data.sort((a: Conversation, b: Conversation) => {
            return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
          });
          setConversations(sortedData);
        };
    };
  };

  const updateConversationsDB = (updatedMessages: Message[], immediate = false) => {
    const write = () => {
      const conversationDB = db.current
        ?.transaction("conversations", "readwrite")
        .objectStore("conversations");
      if (conversationDB && conversationIdRef.current) {
        conversationDB.get(conversationIdRef.current).onsuccess = (event) => {
          const data = (event.target as IDBRequest).result;
          if (data) {
            data.messages = updatedMessages;
            conversationDB.put(data);
          }
        };
      }
    };

    if (immediate) {
      if (dbSyncTimerRef.current) clearTimeout(dbSyncTimerRef.current);
      write();
      return;
    }

    if (dbSyncTimerRef.current) clearTimeout(dbSyncTimerRef.current);
    dbSyncTimerRef.current = setTimeout(write, 300);
  };

  const syncMessages = (updatedMessages: Message[], immediate = false) => {
    updateConversationsDB(updatedMessages, immediate);
    return updatedMessages;
  };

  const attachController = async () => {
    const tab = await getActiveTab();
    if (!tab?.id) return;
    await chrome.runtime.sendMessage({ action: "START_SESSION", tabId: tab.id });
  };

  const detachController = async () => {
    await chrome.runtime.sendMessage({ action: "STOP_SESSION" });
  };

  const automateHandler = async (prompt_text: string, prompt_files: FileFormat[]) => {
    await attachController();
    try {
      const task = await t1Handler(prompt_text, prompt_files);
      if (task) {
        const t2Reasoning = await t2Handler(task, prompt_files);
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

  const t1Handler = async (prompt_text: string, prompt_files: FileFormat[]) => {
    if (abortControllerRef.current?.signal.aborted) return;
    setStatusText("GENERATING");
    setStreaming((prev) => ({ ...prev, response: true }));
    const t1Messages = buildT1Messages(prompt_text, prompt_files, messages);
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

  const t2Handler = async (task: string, prompt_files: FileFormat[]) => {
    if (abortControllerRef.current?.signal.aborted) return;
    setStatusText("EXECUTING");
    setStreaming((prev) => ({ ...prev, execution: true }));

    t2SessionRef.current = {
      screenshot: null,
      screenshotMetadata: null,
      previousReasoning: "",
    };

    await updateOpenedTabs();
    chrome.runtime.sendMessage({ action: "GET_TAB" }, async (tab) => {
      if (!tab || !tab.id) throw new Error("Tab not found");
      await chrome.runtime.sendMessage({ action: "ENABLE_OVERLAY", tabId: tab.id });
    });

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

    const t2Messages = buildT2Messages(task, prompt_files, messages);
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
    chrome.runtime.sendMessage({ action: "GET_TAB" }, async (tab) => {
      if (!tab || !tab.id) throw new Error("Tab not found");
      await chrome.runtime.sendMessage({ action: "DISABLE_OVERLAY", tabId: tab.id });
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

  const chatHandler = async (prompt_text: string, prompt_files: FileFormat[]) => {
    if (abortControllerRef.current?.signal.aborted) return;
    setStatusText("GENERATING");
    setStreaming((prev) => ({ ...prev, response: true }));

    const chatMessages = buildChatMessages(prompt_text, prompt_files, messages);
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

  const handleSendMessage = async () => {
    if ((!message.trim() && files.length === 0) || isGenerating) return;

    const { settings, apiKeys } = await getAppSettings();
    const command = parseSlashCommand(mentions, message);
    const isAutomate = command === "automate";

    const missingStage = await findMissingProvider(settings.models, apiKeys);
    if (missingStage) {
      const provider = getStageConfig(settings.models, missingStage).provider;
      if (provider === "browser-ai") {
        toast.error("Download Browser AI in extension settings.");
      } else {
        toast.error("Configure API keys in extension settings.");
      }
      chrome.runtime.openOptionsPage();
      return;
    }

    messageIdRef.current = uuid4();
    const prompt_text = command ? stripSlashCommands(message) : message.trim();
    const prompt_files = await fileHandler(files);
    if (!prompt_text && prompt_files.length === 0) {
      messageIdRef.current = null;
      toast.error(command ? `Add a message after /${command}` : "Message cannot be empty");
      return;
    }

    setIsGenerating(true);
    setStatusText("INITIALIZING");
    setErrorText("");
    const inputEl = textareaRef.current;
    if (inputEl) {
      inputEl.style.color = "#909090";
    }
    abortControllerRef.current = new AbortController();
    const wasFirstMessage = isFirstMessage;

    try {
      if (wasFirstMessage) {
        setIsChat(true);
        setIsFirstMessage(false);
        conversationIdRef.current = uuid4();
      }
      setMessages((prev) => {
        const update = [
          ...prev,
          {
            id: `user-${messageIdRef.current}`,
            content: { text: { prompt: prompt_text }, files: prompt_files },
          },
          {
            id: `assistant-${messageIdRef.current}`,
            content: {
              task: "",
              taskStatus: "",
              text: { response: "", execution: [], validation: "", output: "" },
              files: [],
            },
          },
        ];
        syncMessages(update);
        return update;
      });
      if (wasFirstMessage) {
        await initConversation();
        generateTitle(prompt_text)
          .then(() => fetchConversations())
          .catch(() => { });
      }

      if (isAutomate) {
        await automateHandler(prompt_text, prompt_files);
      } else {
        await chatHandler(prompt_text, prompt_files);
      }
    } catch (error: any) {
      displayError(error);
    } finally {
      setStreaming({ response: false, execution: false, validation: false, output: false });
      setIsGenerating(false);
      setStatusText("");
      setMessage("");
      setMentions([]);
      setFiles([]);
      if (inputEl) {
        inputEl.style.height = "auto";
        inputEl.style.color = "#ffffff";
      }
      messageIdRef.current = null;
      abortControllerRef.current = null;
      safeToAbortRef.current = false;
    }
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
    textareaRef.current?.focus();
  };

  const handleSelectConversation = async (id: string) => {
    if (id === conversationIdRef.current) return;
    await fetchConversations();
    const conversation = conversations.find((c) => c.id === id);
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
      textareaRef.current?.focus();
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
              onClick={() => chrome.runtime.openOptionsPage()}
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
          isGenerating={isGenerating}
          statusText={statusText}
          errorText={errorText}
          setErrorText={setErrorText}
        />
        <InputContainer
          isGenerating={isGenerating}
          textareaRef={textareaRef}
          fileInputRef={fileInputRef as React.RefObject<HTMLInputElement>}
          message={message}
          mentions={mentions}
          files={files}
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
