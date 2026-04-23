import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { v4 as uuid4 } from 'uuid';
import toast, { Toaster } from 'react-hot-toast';
import { AI, createConversation, createTitle } from '@/lib/agent';
import WelcomePage from './components/WelcomePage';
import Header from './components/Header';
import ChatContainer from './components/ChatContainer';
import InputContainer from './components/InputContainer';
import Mousetrap from 'mousetrap';
import Speech from './utils/Speech';
import { fileHandler } from './utils/FileHandler';
import { availableFunctions, updateOpenedTabs } from '@/lib/tools';
import { getLocalStorage } from '@/lib/client';
import HistorySidebar from './components/HistorySidebar';
import Hero from './components/Hero';
import Particles from './components/Particles';
import Loader from './components/Loader';
import type { Message, Conversation, ToolCall, FileFormat, ExecutionStep } from '../types';
import styles from "css/panel/Root.module.css";

const App = () => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [isFirstMessage, setIsFirstMessage] = useState(true);
    const [isChat, setIsChat] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [statusText, setStatusText] = useState("");
    const [message, setMessage] = useState("");
    const [files, setFiles] = useState<File[]>([]);
    const [isRecording, setIsRecording] = useState(false);
    const [isRecorded, setIsRecorded] = useState(false);
    const [sidebarHovered, setSidebarHovered] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [currentTitle, setCurrentTitle] = useState("New Chat");
    const [signed, setSigned] = useState(false);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const abortControllerRef = useRef<AbortController>(null);

    // const [isConnected, setIsConnected] = useState(socket.connected);

    const db = useRef<IDBDatabase>(null);
    const db_request = useRef<IDBOpenDBRequest>(null);
    const conversationID = useRef<string>(null);
    const messageID = useRef<string>(null);

    useEffect(() => {
        initSigned();
        initDB();
        // initSocket();
        fetchConversations();
        Mousetrap.bind("ctrl+space", () => { speechRecognition() });

        const handleMouseMove = (e: MouseEvent) => {
            const threshold = window.innerWidth - 10;
            if (e.clientX > threshold) {
                setSidebarHovered(true);
            } else if (e.clientX < window.innerWidth - 300) {
                setSidebarHovered(false);
            }
        }

        setTimeout(() => {
            setIsLoading(false);
        }, 800);

        document.addEventListener("mousemove", handleMouseMove);
        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            // deinitSocket();
        }
    }, []);

    useEffect(() => {
        if (message && isRecorded) {
            handleSendMessage();
            setIsRecorded(false);
        }
    }, [message]);

    const speechRecognition = async () => {
        setIsRecording(true);
        const toastID = toast.loading("Listening...", { duration: 10000 });
        new Promise<void>(async (resolve, reject) => {
            try {
                const text = await Speech();
                console.log("Speech:", text);
                setMessage(text);
                setIsRecorded(true);
                toast.success("Prompt Sent", { id: toastID });
            } catch (error) {
                toast.error("Already Listening...", { id: toastID });
                reject();
            } finally {
                setIsRecording(false);
                resolve();
            }
        });
    };

    const initSigned = async () => {
        const localStorage: Record<string, any> = await getLocalStorage();
        if (localStorage.data.signed) {
            setSigned(true);
        }
    };

    const initDB = () => {
        db_request.current = indexedDB.open("WaffyDB", 1);
        db_request.current.onerror = (event) => {
            console.log("Error opening database:", event);
        };
        db_request.current.onupgradeneeded = (event) => {
            db.current = (event.target as IDBOpenDBRequest).result as IDBDatabase;
            db.current.createObjectStore("conversations", { keyPath: "id" });
        }
        db_request.current.onsuccess = (event) => {
            db.current = (event.target as IDBOpenDBRequest).result as IDBDatabase;
        };
    };

    const initConversation = async () => {
        await createConversation(conversationID.current);
        const conversationDB = db.current?.transaction("conversations", "readwrite").objectStore("conversations");
        conversationDB?.add({ id: conversationID.current, title: "New Chat", timestamp: new Date(), messages: [] });
        fetchConversations();
    }

    // const initSocket = () => {
    //     socket.on("connect", socketOnConnect);
    //     socket.on("disconnect", socketOnDisconnect);
    // }

    // const deinitSocket = () => {
    //     socket.off("connect", socketOnConnect);
    //     socket.off("disconnect", socketOnDisconnect);
    // }

    // const socketOnConnect = () => {
    //     setIsConnected(true);
    // }

    // const socketOnDisconnect = () => {
    //     setIsConnected(false);
    // }

    const generateTitle = async (prompt: string) => {
        const title = await createTitle(conversationID.current, prompt);
        setCurrentTitle(title);
        const conversationDB = db.current?.transaction("conversations", "readwrite").objectStore("conversations");
        if (conversationDB && conversationID.current) {
            conversationDB.get(conversationID.current).onsuccess = (event) => {
                const data = (event.target as IDBRequest).result;
                if (data) {
                    data.title = title;
                    const res = conversationDB.put(data);
                    res.onerror = (event) => {
                        console.log("Error updating title:", event);
                    };
                    res.onsuccess = () => {
                        return;
                    };
                }
            }
        }
    }

    const fetchConversations = async () => {
        const dbr: IDBOpenDBRequest = indexedDB.open("WaffyDB", 1);
        dbr.onsuccess = (dbEvent) => {
            (dbEvent.target as IDBOpenDBRequest).result.transaction("conversations", "readwrite")
                .objectStore("conversations").getAll().onsuccess = (event) => {
                    const data = (event.target as IDBRequest).result;
                    const sortedData = data.sort((a: Conversation, b: Conversation) => {
                        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
                    });
                    setConversations(sortedData);
                }
        }
    };

    const updateConversationsDB = async (updatedMessages: Message[]) => {
        const conversationDB = db.current?.transaction("conversations", "readwrite").objectStore("conversations");
        if (conversationDB && conversationID.current) {
            conversationDB.get(conversationID.current).onsuccess = (event) => {
                const data = (event.target as IDBRequest).result;
                if (data) {
                    data.messages = updatedMessages;
                    const res = conversationDB.put(data);
                    res.onerror = (event) => {
                        console.log("Error updating conversation:", event);
                    };
                    res.onsuccess = () => {
                        return;
                    };
                }
            }
        }
    };

    const attachController = async () => {
        return new Promise<void>((resolve, reject) => {
            chrome.tabs.query({}, async (tabs) => {
                try {
                    for (let tab of tabs) {
                        if (tab.url?.startsWith("chrome://")) {
                            continue;
                        }
                        chrome.debugger.attach({ tabId: tab.id }, "1.3", async () => {
                            if (chrome.runtime.lastError) {
                                reject();
                            }
                            await chrome.debugger.sendCommand({ tabId: tab.id }, "Page.enable");
                            await chrome.debugger.sendCommand({ tabId: tab.id }, "DOM.enable");
                            await chrome.debugger.sendCommand({ tabId: tab.id }, "Overlay.enable");
                        });
                    }
                    // Set current tab as active
                    chrome.tabs.query({ active: true, currentWindow: true }, async (currentTabs) => {
                        if (!currentTabs || !currentTabs[0]?.id) {
                            return;
                        }
                        await updateOpenedTabs();
                        await chrome.runtime.sendMessage({ action: "SET_TAB", tabId: currentTabs[0].id });
                        await chrome.runtime.sendMessage({ action: "SET_ACTIVE", active: true });
                    });
                    resolve();
                } catch (e) {
                    reject();
                }
            });
        });
    };

    const detachController = async () => {
        return new Promise<void>((resolve, reject) => {
            chrome.tabs.query({}, async (tabs) => {
                try {
                    for (let tab of tabs) {
                        if (tab.url?.startsWith("chrome://")) {
                            continue;
                        }
                        await chrome.runtime.sendMessage({ action: "DISABLE_OVERLAY", tabId: tab.id }); // force disable overlay
                        await chrome.debugger.sendCommand({ tabId: tab.id }, "Page.disable");
                        await chrome.debugger.sendCommand({ tabId: tab.id }, "DOM.disable");
                        await chrome.debugger.sendCommand({ tabId: tab.id }, "Overlay.disable");
                        await chrome.runtime.sendMessage({ action: "SET_ACTIVE", active: false });
                        chrome.debugger.detach({ tabId: tab.id }, async () => {
                            if (chrome.runtime.lastError) {
                                reject();
                            }
                        });
                    }
                    resolve();
                } catch (e) {
                    reject();
                }
            });
        });
    };

    const t1Handler = async (messageId: string, prompt_text: string, prompt_files: FileFormat[]) => {
        setStatusText("GENERATING");
        const handleError = () => raiseError(messageId);
        const t1Prompt = [];
        t1Prompt.push({ type: "prompt", content: [{ type: "text", text: prompt_text }, ...prompt_files] });
        const responseStream = AI(conversationID.current, t1Prompt, "t1", messageID.current, abortControllerRef?.current, handleError);
        let response = "";
        const toolCalls: Record<string, ToolCall> = {};
        for await (const res of responseStream) {
            if (res.type === "action.call") {
                for (const [key, value] of Object.entries(res.action)) {
                    toolCalls[key] = value as ToolCall;
                }
            }
            if (res.type === "text.stream") {
                response += res.text;
                setMessages(prev => {
                    const update = prev.map(msg => msg.id === `assistant-${messageId}` ? { ...msg, content: { ...msg.content, text: { ...msg.content.text, response: response } } } : msg);
                    updateConversationsDB(update);
                    return update;
                });
            }
            if (res.type === "response.completed") {
                messageID.current = res.message_id;
            }
            if (res.type === "response.error") {
                throw res.error;
            }
        }
        setMessages(prev => {
            const update = prev.map(msg => msg.id === `assistant-${messageId}` ? { ...msg, streaming: { ...msg.streaming, response: false } } : msg);
            updateConversationsDB(update);
            return update;
        });
        console.log("llm handler", response, toolCalls);
        for await (const [index, toolCall] of Object.entries(toolCalls)) {
            const toolName = toolCall.name;
            const toolArgs = JSON.parse(toolCall.arguments);
            if (toolName === "proceed") {
                setMessages(prev => {
                    const update = prev.map(msg => msg.id === `assistant-${messageId}` ? { ...msg, content: { ...msg.content, task: toolArgs.task }, streaming: { ...msg.streaming, execution: true } } : msg);
                    updateConversationsDB(update);
                    return update;
                });
                return toolArgs.task;
            }
        }
        return false;
    }

    const t2Handler = async (messageId: string, task: string, prompt_files: FileFormat[]) => {
        setStatusText("EXECUTING");
        const handleError = () => raiseError(messageId);
        await updateOpenedTabs();
        chrome.runtime.sendMessage({ action: "GET_TAB" }, async (tab) => {
            if (!tab || !tab.id) {
                throw new Error("Tab not found");
            }
            await chrome.runtime.sendMessage({ action: "ENABLE_OVERLAY", tabId: tab.id });
        });
        let responded = true;
        let finish = false;
        let functionExecState = false;
        let executionResponse: ExecutionStep[] = [{ id: 0, text: "Initializing", executing: true }];
        setMessages(prev => {
            const update = prev.map(msg => msg.id === `assistant-${messageId}` ? { ...msg, content: { ...msg.content, text: { ...msg.content.text, execution: executionResponse } } } : msg);
            updateConversationsDB(update);
            return update;
        });
        const t2Prompt: any[] = [];
        t2Prompt.push({ type: "prompt", content: [{ type: "text", text: task }, ...prompt_files] });
        while (!finish || functionExecState) {
            if (!responded) return false;
            responded = false;
            console.log("t2Prompt:", t2Prompt);
            const executionToolCalls: Record<string, ToolCall> = {};
            const executionModelStream = AI(conversationID.current, t2Prompt, "t2", messageID.current, abortControllerRef?.current, handleError);
            for await (const res of executionModelStream) {
                responded = true;
                if (res.type === "action.call") {
                    for (const [key, value] of Object.entries(res.action)) {
                        executionToolCalls[key] = value as ToolCall;
                    }
                    console.log("ToolCall:", executionToolCalls);
                    if (res.step) {
                        if (executionResponse.length > 0) executionResponse[executionResponse.length - 1].executing = false;
                        executionResponse.push({ id: executionResponse.length, text: res.step, executing: true });
                        setMessages(prev => {
                            const update = prev.map(msg => msg.id === `assistant-${messageId}` ? { ...msg, content: { ...msg.content, text: { ...msg.content.text, execution: executionResponse } } } : msg);
                            updateConversationsDB(update);
                            return update;
                        });
                    }
                }
                if (res.type === "response.completed") {
                    messageID.current = res.message_id;
                    if (!functionExecState) finish = true;
                }
                if (res.type === "response.error") {
                    throw res.error;
                }
            }
            t2Prompt.length = 0;
            functionExecState = false;
            for await (const [index, toolCall] of Object.entries(executionToolCalls)) {
                await updateOpenedTabs();
                const toolName = toolCall.name;
                const toolArgs = JSON.parse(toolCall.arguments);
                const toolCallResult = await availableFunctions[toolName](toolArgs);
                console.log("tsresult", toolCallResult)
                t2Prompt.push({
                    type: "action.result",
                    id: toolCall.id,
                    output: toolCallResult.message
                });
                // if (toolCallResult.status != "success") throw new Error("Action failed");
                if (toolName === "fetchScreen" || toolName === "getScrollPortions") {
                    t2Prompt.push(toolCallResult.data);
                }
                functionExecState = true;
            }
            if (abortControllerRef.current?.signal.aborted) {
                return false;
            }
        }
        if (executionResponse.length > 0) executionResponse[executionResponse.length - 1].executing = false;
        setMessages(prev => {
            const update = prev.map(msg => msg.id === `assistant-${messageId}` ? { ...msg, streaming: { ...msg.streaming, execution: false, validation: true } } : msg);
            updateConversationsDB(update);
            return update;
        });
        console.log("t2response", executionResponse);
        chrome.runtime.sendMessage({ action: "GET_TAB" }, async (tab) => {
            if (!tab || !tab.id) {
                throw new Error("Tab not found");
            }
            await chrome.runtime.sendMessage({ action: "DISABLE_OVERLAY", tabId: tab.id });
        });
        return executionResponse;
    }

    const t3Handler = async (messageId: string, task: string) => {
        setStatusText("VALIDATING");
        const handleError = () => raiseError(messageId);
        const t3Prompt = [{ type: "prompt", content: [{ type: "text", text: task }] }];
        const summaryModelStream = AI(conversationID.current, t3Prompt, "t3", messageID.current, abortControllerRef?.current, handleError);
        const toolCalls: Record<string, ToolCall> = {};
        let validationResponse = "";
        for await (const res of summaryModelStream) {
            if (res.type === "action.call") {
                for (const [key, value] of Object.entries(res.action)) {
                    toolCalls[key] = value as ToolCall;
                }
            }
            if (res.type === "text.stream") {
                validationResponse += res.text;
                setMessages(prev => {
                    const update = prev.map(msg => msg.id === `assistant-${messageId}` ? { ...msg, content: { ...msg.content, text: { ...msg.content.text, validation: validationResponse } } } : msg);
                    updateConversationsDB(update);
                    return update;
                });
            }
            if (res.type === "response.completed") {
                messageID.current = res.message_id;
            }
            if (res.type === "response.error") {
                throw res.error;
            }
        }
        for await (const [index, toolCall] of Object.entries(toolCalls)) {
            const toolName = toolCall.name;
            const toolArgs = JSON.parse(toolCall.arguments);
            switch (toolName) {
                case "success":
                    console.log("Validation Success");
                    setMessages(prev => {
                        const update = prev.map(msg => msg.id === `assistant-${messageId}` ? { ...msg, content: { ...msg.content, taskStatus: "success" }, streaming: { ...msg.streaming, validation: false, output: true } } : msg);
                        updateConversationsDB(update);
                        return update;
                    });
                    break;
                case "failed":
                    console.log("Validation Failed");
                    setMessages(prev => {
                        const update = prev.map(msg => msg.id === `assistant-${messageId}` ? { ...msg, content: { ...msg.content, taskStatus: "failed" }, streaming: { ...msg.streaming, validation: false, output: true } } : msg);
                        updateConversationsDB(update);
                        return update;
                    });
                    break;
                case "suspended":
                    console.log("Validation Suspended");
                    setMessages(prev => {
                        const update = prev.map(msg => msg.id === `assistant-${messageId}` ? { ...msg, content: { ...msg.content, taskStatus: "suspended" }, streaming: { ...msg.streaming, validation: false, output: true } } : msg);
                        updateConversationsDB(update);
                        return update;
                    });
                    break;
                default:
                    break;
            }
        }
        return validationResponse;
    }

    const t4Handler = async (messageId: string, task: string) => {
        setStatusText("FINALIZING");
        const handleError = () => raiseError(messageId);
        const t4Prompt = [{ type: "prompt", content: [{ type: "text", text: task }] }];
        const summaryModelStream = AI(conversationID.current, t4Prompt, "t4", messageID.current, abortControllerRef?.current, handleError);
        let summary = "";
        for await (const res of summaryModelStream) {
            if (res.type === "text.stream") {
                summary += res.text;
                setMessages(prev => {
                    const update = prev.map(msg => msg.id === `assistant-${messageId}` ? { ...msg, content: { ...msg.content, text: { ...msg.content.text, output: summary } } } : msg);
                    updateConversationsDB(update);
                    return update;
                });
            }
            if (res.type === "response.completed") {
                messageID.current = res.message_id;
            }
            if (res.type === "response.error") {
                throw res.error;
            }
        }
        setMessages(prev => {
            const update = prev.map(msg => msg.id === `assistant-${messageId}` ? { ...msg, streaming: { ...msg.streaming, output: false } } : msg);
            updateConversationsDB(update);
            return update;
        });
    };

    const raiseError = (messageId: string, error?: string) => {
        setMessages(prev => {
            const update = prev.filter(msg => msg.id !== `assistant-${messageId}`);
            updateConversationsDB(update);
            return update;
        });
        const errorMessage = "Something went wrong";
        setMessages(prev => {
            const update = [...prev, { id: `error-${messageId}`, content: { text: { prompt: `*${error ? error : errorMessage}*` } }, isUser: false, isError: true }];
            updateConversationsDB(update);
            return update;
        });
    };

    const handleSendMessage = async () => {
        if ((!message.trim() && files.length === 0) || isGenerating) return;
        messageID.current = null;
        const messageId = Date.now().toString();
        setIsGenerating(true);
        setStatusText("INITIALIZING");
        if (textareaRef.current) {
            textareaRef.current.style.color = "#909090";
        }
        abortControllerRef.current = new AbortController();
        const prompt_text = message.trim();
        const prompt_files = await fileHandler(files);
        setMessages(prev => {
            const update = [
                ...prev,
                { id: `user-${messageId}`, content: { text: { prompt: prompt_text }, files: prompt_files }, isUser: true, isError: false },
                { id: `assistant-${messageId}`, content: { text: {}, files: [] }, streaming: { response: true, execution: false, validation: false, output: false }, isUser: false, isError: false }
            ];
            updateConversationsDB(update);
            return update;
        });
        try {
            if (isFirstMessage) {
                setIsChat(true);
                setIsFirstMessage(false);
                conversationID.current = uuid4();
                await initConversation();
                generateTitle(prompt_text).then(() => fetchConversations());
            }
            await attachController();
            const task = await t1Handler(messageId, prompt_text, prompt_files);
            if (task) {
                const executionOutput = await t2Handler(messageId, task, prompt_files);
                if (executionOutput) {
                    await t3Handler(messageId, task);
                    await t4Handler(messageId, task);
                }
            }
        } catch (error: any) {
            raiseError(messageId, error);
        } finally {
            try {
                await detachController();
            } catch (e) {
                console.log("Error detaching from tab");
            }
            setMessages(prev => {
                const update = prev.map(msg => {
                    if (msg.id === `assistant-${messageId}`) {
                        if (msg?.content?.text?.execution) {
                            const execution = (msg.content.text.execution).map(step => ({
                                ...step,
                                executing: false
                            }));
                            return { ...msg, content: { ...msg.content, text: { ...msg.content.text, execution } } };
                        }
                    }
                    return msg;
                });
                updateConversationsDB(update);
                return update;
            });
            setMessages(prev => {
                const update = prev.map(msg => msg.id === `assistant-${messageId}` ? { ...msg, streaming: { response: false, execution: false, validation: false, output: false } } : msg);
                updateConversationsDB(update);
                return update;
            });
            if (abortControllerRef.current?.signal.aborted) {
                setMessages(prev => {
                    const update = [...prev, { id: `error-${messageId}`, content: { text: { prompt: "*User interupted while processing.*" } }, isUser: false, isError: true }];
                    updateConversationsDB(update);
                    return update;
                });
            }
            setIsGenerating(false);
            setStatusText("");
            setMessage("");
            setFiles([]);
            if (textareaRef.current) {
                textareaRef.current.style.height = "auto";
                textareaRef.current.style.color = "#ffffff";
            };
            messageID.current = null;
            abortControllerRef.current = null;
        }
    };

    const handleStopGeneration = async () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            setIsGenerating(false);
        }
    };

    const handleNewChat = async () => {
        await handleStopGeneration();
        fetchConversations();
        setIsFirstMessage(true);
        setMessages([]);
        conversationID.current = null;
        setCurrentTitle("New Chat");
        setMessage("");
        setFiles([]);
        setIsChat(false);
        textareaRef.current?.focus();
    };

    const handleSelectConversation = async (id: string) => {
        if (id === conversationID.current) return;
        await fetchConversations();
        const conversation = conversations.find(c => c.id === id);
        if (conversation) {
            await handleStopGeneration();
            setMessages([]);
            await new Promise(resolve => setTimeout(resolve, 100));
            setIsFirstMessage(false);
            setMessages(conversation.messages);
            conversationID.current = id;
            setMessage("");
            setFiles([]);
            setCurrentTitle(conversation.title);
            setIsChat(true);
            textareaRef.current?.focus();
        }
    };

    const handleItemRemove = async (id: string) => {
        const conversation = conversations.find(c => c.id === id);
        if (conversation) {
            const conversationDB = db.current?.transaction("conversations", "readwrite").objectStore("conversations");
            conversationDB?.delete(id);
            await fetchConversations();
            if (conversationID.current === id) {
                handleNewChat();
            }
            toast.success("Deleted Successfully", { duration: 1500 });
            textareaRef.current?.focus();
        }
    };

    if (isLoading) {
        return <Loader />
    }

    if (!signed) {
        return <WelcomePage />
    }

    return (
        <>
            <Toaster
                position="top-center"
                reverseOrder={false}
            />
            <Particles quantity={100} />
            <HistorySidebar
                currentConversationId={conversationID.current}
                conversations={conversations}
                visible={sidebarHovered}
                onSelectConversation={handleSelectConversation}
                onRemoveConversation={handleItemRemove}
            />
            <div className={styles.container}>
                <Header
                    currentConversationId={conversationID.current}
                    currentTitle={currentTitle}
                    onNewChat={handleNewChat}
                />
                <Hero
                    hidden={isChat}
                    onPromptClick={handleNewChat}
                />
                <ChatContainer
                    hidden={!isChat}
                    messages={messages}
                    isGenerating={isGenerating}
                    statusText={statusText}
                />
                <InputContainer
                    isGenerating={isGenerating}
                    isRecording={isRecording}
                    textareaRef={textareaRef as any}
                    fileInputRef={fileInputRef as any}
                    message={message}
                    files={files}
                    setMessage={setMessage}
                    setFiles={setFiles}
                    onSpeechRecognition={speechRecognition}
                    onSendMessage={handleSendMessage}
                    onStopGeneration={handleStopGeneration}
                />
            </div>
        </>
    );
};

ReactDOM.createRoot(document.getElementById('_app')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);