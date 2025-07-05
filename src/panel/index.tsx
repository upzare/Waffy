import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { v4 as uuid4 } from 'uuid';
import toast, { Toaster } from 'react-hot-toast';
import { ai, generateTitle } from '@/lib/agent';
import { socket } from '@/lib/socket';
import { Message, Conversation, ToolCall, FileFormat } from '../types';
import WelcomePage from './components/WelcomePage';
import Header from './components/Header';
import ChatContainer from './components/ChatContainer';
import InputContainer from './components/InputContainer';
import Mousetrap from 'mousetrap';
import Speech from './utils/Speech';
import { fileHandler } from './utils/FileHandler';
import { availableFunctions } from '@/lib/tools';
import { getLocalStorage } from '@/lib/client';
import HistorySidebar from './components/HistorySidebar';
import Hero from './components/Hero';
import Particles from './components/Particles';
import Loader from './components/Loader';
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

    const [isConnected, setIsConnected] = useState(socket.connected);

    const db = useRef<IDBDatabase>(null);
    const db_request = useRef<IDBOpenDBRequest>(null);
    const conversationID = useRef<string>(null);

    useEffect(() => {
        initSigned();
        initDB();
        initSocket();
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
            deinitSocket();
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
            console.error("Error opening database:", event);
        };
        db_request.current.onupgradeneeded = (event) => {
            db.current = (event.target as IDBOpenDBRequest).result as IDBDatabase;
            db.current.createObjectStore("conversations", { keyPath: "id" });
        }
        db_request.current.onsuccess = (event) => {
            db.current = (event.target as IDBOpenDBRequest).result as IDBDatabase;
        };
    };

    const initConversation = async (prompt: string) => {
        conversationID.current = uuid4();
        const conversationDB = db.current?.transaction("conversations", "readwrite").objectStore("conversations");
        conversationDB?.add({ id: conversationID.current, title: "New Chat", timestamp: new Date(), messages: [] });
        await createTitle(prompt);
        fetchConversations();
    }

    const initSocket = () => {
        socket.on("connect", socketOnConnect);
        socket.on("disconnect", socketOnDisconnect);
    }

    const deinitSocket = () => {
        socket.off("connect", socketOnConnect);
        socket.off("disconnect", socketOnDisconnect);
    }

    const socketOnConnect = () => {
        setIsConnected(true);
    }

    const socketOnDisconnect = () => {
        setIsConnected(false);
    }

    const createTitle = async (prompt: string) => {
        const title = await generateTitle(prompt);
        setCurrentTitle(title);
        const conversationDB = db.current?.transaction("conversations", "readwrite").objectStore("conversations");
        if (conversationDB && conversationID.current) {
            conversationDB.get(conversationID.current).onsuccess = (event) => {
                const data = (event.target as IDBRequest).result;
                if (data) {
                    data.title = title;
                    const res = conversationDB.put(data);
                    res.onerror = (event) => {
                        console.error("Error updating title:", event);
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
                        console.error("Error updating conversation:", event);
                    };
                    res.onsuccess = () => {
                        return;
                    };
                }
            }
        }
    };

    const t1Handler = async (messageId: string, previousPrompt: any, prompt_text: string, prompt_files: FileFormat[]) => {
        setStatusText("GENERATING");
        const t1Prompt = previousPrompt;
        t1Prompt.push({ type: "prompt", content: [{ type: "text", text: prompt_text }, ...prompt_files] });
        const responseStream = ai(t1Prompt, "t1", abortControllerRef?.current?.signal);
        let response = "";
        const toolCalls: Record<string, ToolCall> = {};
        for await (const res of responseStream) {
            if (res.type === "response.output_item.done" && res.item.type === "function_call") {
                toolCalls[res.output_index] = res.item as ToolCall;
            }
            if (res.type === "response.output_text.delta") {
                response += res.delta;
                setMessages(prev => {
                    const update = prev.map(msg => msg.id === `assistant-${messageId}` ? { ...msg, content: { ...msg.content, text: { ...msg.content.text, t1: response } } } : msg);
                    updateConversationsDB(update);
                    return update;
                });
            }
            if (res.type === "error") {
                throw new Error(res.message);
            }
        }
        setMessages(prev => {
            const update = prev.map(msg => msg.id === `assistant-${messageId}` ? { ...msg, streaming: { ...msg.streaming, t1: false } } : msg);
            updateConversationsDB(update);
            return update;
        });
        console.log("llm handler", response, toolCalls);
        for await (const [index, toolCall] of Object.entries(toolCalls)) {
            const toolName = toolCall.name;
            const toolArgs = JSON.parse(toolCall.arguments);
            if (toolName === "proceed") {
                setMessages(prev => {
                    const update = prev.map(msg => msg.id === `assistant-${messageId}` ? { ...msg, content: { ...msg.content, task: toolArgs.task }, streaming: { ...msg.streaming, t2: true } } : msg);
                    updateConversationsDB(update);
                    return update;
                });
                return toolArgs.task;
            }
        }
        return false;
    }

    const t2Handler = async (messageId: string, task: string, previousTask: any, prompt_files: FileFormat[]) => {
        setStatusText("EXECUTING");
        let finish = false;
        let functionExecState = false;
        let domContentIndex;
        let executionResponse = "";
        const t2Prompt = previousTask;
        t2Prompt.push({ type: "prompt", content: [{ type: "text", text: task }, ...prompt_files] });
        while (!finish || functionExecState) {
            console.log("t2Prompt:", t2Prompt);
            const executionToolCalls: Record<string, ToolCall> = {};
            const executionModelStream = ai(t2Prompt, "t2", abortControllerRef?.current?.signal);
            for await (const res of executionModelStream) {
                if (res.type === "response.output_item.done" && res.item.type === "function_call") {
                    executionToolCalls[res.output_index] = res.item as ToolCall;
                    console.log("ToolCall:", executionToolCalls);
                }
                if (res.type === "response.output_text.delta") {
                    executionResponse += res.delta;
                    setMessages(prev => {
                        const update = prev.map(msg => msg.id === `assistant-${messageId}` ? { ...msg, content: { ...msg.content, text: { ...msg.content.text, t2: executionResponse } } } : msg);
                        updateConversationsDB(update);
                        return update;
                    });
                }
                if (res.type === "response.completed" && !functionExecState) {
                    finish = true;
                }
                if (res.type === "error") {
                    throw new Error(res.message);
                }
            }
            t2Prompt.push({ type: "response", content: [{ type: "text", text: executionResponse }] });
            functionExecState = false;
            for await (const [index, toolCall] of Object.entries(executionToolCalls)) {
                const toolName = toolCall.name;
                const toolArgs = JSON.parse(toolCall.arguments);
                const toolCallResult = await availableFunctions[toolName](toolArgs);
                console.log("tsresult", toolCallResult)
                t2Prompt.push(toolCall);
                t2Prompt.push({
                    type: "function_call_output",
                    call_id: toolCall.call_id,
                    output: toolCallResult.message
                });
                if (toolName === "fetchScreen" || toolName === "getScrollPortions") {
                    if (domContentIndex) {
                        t2Prompt.splice(domContentIndex, 1);
                    }
                    domContentIndex = t2Prompt.length;
                    t2Prompt.push(toolCallResult.data);
                }
                functionExecState = true;
            }
            if (abortControllerRef.current?.signal.aborted) {
                return false;
            }
        }
        setMessages(prev => {
            const update = prev.map(msg => msg.id === `assistant-${messageId}` ? { ...msg, streaming: { ...msg.streaming, t2: false, t3: true } } : msg);
            updateConversationsDB(update);
            return update;
        });
        console.log("t2response", executionResponse);
        return executionResponse;
    }

    const t3Handler = async (messageId: string, task: string, executionOutput: string) => {
        setStatusText("VALIDATING");
        const prompt = `**Task:**\n${task}\n\n**Output:**\n${executionOutput}`;
        const t3Prompt = [{ type: "prompt", content: [{ type: "text", text: prompt }] }];
        const summaryModelStream = ai(t3Prompt, "t3", abortControllerRef?.current?.signal);
        const toolCalls: Record<string, ToolCall> = {};
        let validationResponse = "";
        for await (const res of summaryModelStream) {
            if (res.type === "response.output_item.done" && res.item.type === "function_call") {
                toolCalls[res.output_index] = res.item as ToolCall;
            }
            if (res.type === "response.output_text.delta") {
                validationResponse += res.delta;
                setMessages(prev => {
                    const update = prev.map(msg => msg.id === `assistant-${messageId}` ? { ...msg, content: { ...msg.content, text: { ...msg.content.text, t3: validationResponse } } } : msg);
                    updateConversationsDB(update);
                    return update;
                });
            }
            if (res.type === "error") {
                throw new Error(res.message);
            }
        }
        for await (const [index, toolCall] of Object.entries(toolCalls)) {
            const toolName = toolCall.name;
            const toolArgs = JSON.parse(toolCall.arguments);
            switch (toolName) {
                case "success":
                    console.log("Validation Success");
                    setMessages(prev => {
                        const update = prev.map(msg => msg.id === `assistant-${messageId}` ? { ...msg, content: { ...msg.content, taskStatus: "success" }, streaming: { ...msg.streaming, t3: false, t4: true } } : msg);
                        updateConversationsDB(update);
                        return update;
                    });
                    break;
                case "failed":
                    console.log("Validation Failed");
                    setMessages(prev => {
                        const update = prev.map(msg => msg.id === `assistant-${messageId}` ? { ...msg, content: { ...msg.content, taskStatus: "failed" }, streaming: { ...msg.streaming, t3: false, t4: true } } : msg);
                        updateConversationsDB(update);
                        return update;
                    });
                    break;
                case "suspended":
                    console.log("Validation Suspended");
                    setMessages(prev => {
                        const update = prev.map(msg => msg.id === `assistant-${messageId}` ? { ...msg, content: { ...msg.content, taskStatus: "suspended" }, streaming: { ...msg.streaming, t3: false, t4: true } } : msg);
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

    const t4Handler = async (messageId: string, task: string, executionOutput: string) => {
        setStatusText("FINALIZING");
        const prompt = `**Task:**\n${task}\n\n**Output:**\n${executionOutput}`;
        const t4Prompt = [{ type: "prompt", content: [{ type: "text", text: prompt }] }];
        const summaryModelStream = ai(t4Prompt, "t4", abortControllerRef?.current?.signal);
        let summary = "";
        for await (const res of summaryModelStream) {
            if (res.type === "response.output_text.delta") {
                summary += res.delta;
                setMessages(prev => {
                    const update = prev.map(msg => msg.id === `assistant-${messageId}` ? { ...msg, content: { ...msg.content, text: { ...msg.content.text, t4: summary } } } : msg);
                    updateConversationsDB(update);
                    return update;
                });
            }
            if (res.type === "error") {
                throw new Error(res.message);
            }
        }
        setMessages(prev => {
            const update = prev.map(msg => msg.id === `assistant-${messageId}` ? { ...msg, streaming: { ...msg.streaming, t4: false } } : msg);
            updateConversationsDB(update);
            return update;
        });
    };

    const handleSendMessage = async () => {
        if ((!message.trim() && files.length === 0) || isGenerating) return;
        const messageId = Date.now().toString();
        setIsGenerating(true);
        setStatusText("INITIALIZING");
        if (textareaRef.current) {
            textareaRef.current.style.color = "#909090";
        }
        abortControllerRef.current = new AbortController();
        const prompt_text = message.trim();
        if (isFirstMessage) {
            setIsChat(true);
            setIsFirstMessage(false);
            initConversation(prompt_text);
        }
        setMessages(prev => {
            const update = [
                ...prev,
                { id: `user-${messageId}`, content: { text: { t0: prompt_text }, files: files }, isUser: true, isError: false },
                { id: `assistant-${messageId}`, content: { text: {}, files: [] }, streaming: { t1: true, t2: false, t3: false, t4: false }, isUser: false, isError: false }
            ];
            updateConversationsDB(update);
            return update;
        });
        const previousPrompt = [];
        const previousTask = [];
        const userFiles: File[][] = [];
        for await (const msg of messages) {
            if (!msg.isError) {
                if (msg.isUser) {
                    previousPrompt.push({ type: "prompt", content: [{ type: "text", text: msg.content.text?.t0 }, ...await fileHandler(msg.content.files || [])] });
                    userFiles.push(msg.content.files || []);
                } else {
                    const assistantPrompt = `${msg.content.text?.t4 ? `${msg.content.text?.t4}\n\n**Validation Output**:\n${msg.content.text?.t3}` : msg.content.text?.t1}`;
                    previousPrompt.push({ type: "response", content: [{ type: "text", text: assistantPrompt }, ...await fileHandler(msg.content.files || [])] });
                    if (msg.content?.task) {
                        previousTask.push({ type: "prompt", content: [{ type: "text", text: msg.content?.task }, ...await fileHandler(userFiles[userFiles.length - 1] || [])] });
                        previousTask.push({ type: "response", content: [{ type: "text", text: msg.content.text?.t2 }, ...await fileHandler(msg.content.files || [])] });
                    }
                    userFiles.pop();
                }
            } else {
                previousPrompt.push({ type: "response", content: [{ type: "text", text: `ERROR: ${msg.content.text?.t0}` }] });
                userFiles.pop();
            }
        };
        const prompt_files = await fileHandler(files);
        try {
            chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
                if (!tabs || !tabs[0]?.id) {
                    return;
                }
                chrome.debugger.attach({ tabId: tabs[0].id }, "1.3", async () => {
                    if (chrome.runtime.lastError) {
                        console.error("Debugger attach failed: ", chrome.runtime.lastError.message);
                    }
                    await chrome.debugger.sendCommand({ tabId: tabs[0].id }, "DOM.enable");
                    await chrome.debugger.sendCommand({ tabId: tabs[0].id }, "Overlay.enable");
                    console.log(`Debugger attached to tab ${tabs[0].id}`);
                });
            });
            const task = await t1Handler(messageId, previousPrompt, prompt_text, prompt_files);
            if (task) {
                const executionOutput = await t2Handler(messageId, task, previousTask, prompt_files);
                if (executionOutput) {
                    await t3Handler(messageId, task, executionOutput);
                    await t4Handler(messageId, task, executionOutput);
                }
            }
        } catch (error) {
            setMessages(prev => {
                const update = prev.filter(msg => msg.id !== `assistant-${messageId}`);
                updateConversationsDB(update);
                return update;
            });
            let errorMessage = "Something went wrong.";
            if ((error as any).message) {
                errorMessage = (error as any).message;
            }
            setMessages(prev => {
                const update = [...prev, { id: `error-${messageId}`, content: { text: { t0: `*${errorMessage}*` } }, streaming: { t1: false, t2: false, t3: false, t4: false }, isUser: false, isError: true }];
                updateConversationsDB(update);
                return update;
            });
        } finally {
            chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
                if (!tabs || !tabs[0]?.id) {
                    return;
                }
                await chrome.debugger.sendCommand({ tabId: tabs[0].id }, "DOM.disable");
                await chrome.debugger.sendCommand({ tabId: tabs[0].id }, "Overlay.disable");
                chrome.debugger.detach({ tabId: tabs[0].id }, async () => {
                    if (chrome.runtime.lastError) {
                        console.error("Error detaching from tab:", chrome.runtime.lastError.message);
                    }
                });
            });
            setMessages(prev => {
                const update = prev.map(msg => msg.id === `assistant-${messageId}` ? { ...msg, streaming: { t1: false, t2: false, t3: false, t4: false } } : msg);
                updateConversationsDB(update);
                return update;
            });
            if (abortControllerRef.current?.signal.aborted) {
                setMessages(prev => {
                    const update = [...prev, { id: `error-${messageId}`, content: { text: { t0: "*User interupted while processing.*" } }, streaming: { t1: false, t2: false, t3: false, t4: false }, isUser: false, isError: true }];
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
                <ChatContainer messages={messages} isGenerating={isGenerating} statusText={statusText} />
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