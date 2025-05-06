import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { v4 as uuid4 } from 'uuid';
import toast, { Toaster } from 'react-hot-toast';
import { geminiResponseText, ai } from '../lib/agent';
import { Message, Conversation, ToolCall } from '../types';
import Header from './components/Header';
import ChatContainer from './components/ChatContainer';
import InputContainer from './components/InputContainer';
import Mousetrap from 'mousetrap';
import Speech from './utils/Speech';
import { fileHandler } from './utils/FileHandler';
import { availableFunctions } from '../lib/tools';
import HistorySidebar from './components/HistorySidebar';
import Hero from './components/Hero';
import Particles from './components/Particles';

const App = () => {
    const [messages, setMessages] = useState<any[]>([]);
    const [isFirstMessage, setIsFirstMessage] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [message, setMessage] = useState("");
    const [files, setFiles] = useState<File[]>([]);
    const [isRecording, setIsRecording] = useState(false);
    const [isRecorded, setIsRecorded] = useState(false);
    const [sidebarHovered, setSidebarHovered] = useState(false);

    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [currentTitle, setCurrentTitle] = useState("New Chat");

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const homeSection = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController>(null);
    const userInterruptRef = useRef<boolean>(false);

    const db = useRef<IDBDatabase>(null);
    const db_request = useRef<IDBOpenDBRequest>(null);
    const conversationID = useRef<string>(null);

    useEffect(() => {
        initDB();
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

        document.addEventListener("mousemove", handleMouseMove);
        return () => document.removeEventListener("mousemove", handleMouseMove);
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
        let titlePrompt = "system: You have to create a description for the given prompt. It must be meaningful and contain atleast 3 words or upto 6 words max. The description should be in the form of a single sentence. Do not include any other text, emojis or markdown formatting. Also no need to . at end.\n\n";
        titlePrompt += `user: ${prompt}\n`;
        let response = await geminiResponseText(titlePrompt);
        let title = response?.status ? response?.message : "Untitled";
        setCurrentTitle(title);
        conversationID.current = uuid4();
        const conversationDB = db.current?.transaction("conversations", "readwrite").objectStore("conversations");
        conversationDB?.add({ id: conversationID.current, title: title, timestamp: new Date(), messages: [] });
        fetchConversations();
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

    const handleStopGeneration = async () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            userInterruptRef.current = true;
            setIsGenerating(false);
            setMessages(prev => {
                const update = prev.map((msg, idx) => idx === prev.length - 1 ? { ...msg, isStreaming: false } : msg);
                updateConversationsDB(update);
                return update;
            });
        }
    };

    const handleSendMessage = async () => {
        if ((!message.trim() && files.length === 0) || isGenerating) return;
        let messageId = Date.now().toString();
        setIsGenerating(true);
        if (textareaRef.current) {
            textareaRef.current.style.color = "#909090";
        }
        abortControllerRef.current = new AbortController();
        userInterruptRef.current = false;
        let content = message.trim();
        if (isFirstMessage) {
            homeSection.current?.classList.add("hidden");
            setIsFirstMessage(false);
            initConversation(content);
        }
        setMessages(prev => {
            const update = [
                ...prev,
                { id: `user-${messageId}`, content: { text: content, files: files }, isUser: true, isStreaming: false, isError: false },
                { id: `assistant-${messageId}`, content: { text: "", files: [] }, isUser: false, isStreaming: true, isError: false }
            ];
            updateConversationsDB(update);
            return update;
        });
        const prompt = [];
        for await (const msg of messages) {
            if (msg.isUser) {
                prompt.push({ type: "prompt", content: [{ type: "text", text: msg.content.text }, ...await fileHandler(msg.content.files!)] });
            }
            if (!msg.isUser) {
                prompt.push({ type: "response", content: [{ type: "text", text: msg.content.text }] });
            }
        };
        prompt.push({ type: "prompt", content: [{ type: "text", text: content }, ...await fileHandler(files)] });
        try {
            let finish = false;
            chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
                if (!tabs || !tabs[0]?.id) {
                    return;
                }
                chrome.debugger.attach({ tabId: tabs[0].id }, "1.3", () => {
                    if (chrome.runtime.lastError) {
                        console.error("Debugger attach failed: ", chrome.runtime.lastError.message);
                    }
                    console.log(`Debugger attached to tab ${tabs[0].id}`);
                });
            });
            let functionExecState;
            let domContentIndex;
            let response = "";
            do {
                console.log("Calling ai...");
                const responseStream = ai(prompt, abortControllerRef.current.signal);
                const finalToolCalls: Record<string, ToolCall> = {};
                for await (const res of responseStream) {
                    if (res.type === "response.output_item.done" && res.item.type === "function_call") {
                        finalToolCalls[res.output_index] = res.item as ToolCall;
                        console.log("ToolCall:", finalToolCalls);
                    }
                    if (res.type === "response.output_text.delta") {
                        response += res.delta;
                        setMessages(prev => {
                            const update = prev.map(msg => msg.id === `assistant-${messageId}` ? { ...msg, content: { text: response, files: [...(msg.content.files || [])] } } : msg);
                            updateConversationsDB(update);
                            return update;
                        });
                    }
                    if (res.type === "response.completed" && !functionExecState) {
                        finish = true;
                    }
                    if (res.type === "error") {
                        finish = true;
                        setMessages(prev => {
                            const update = prev.filter(msg => msg.id !== `assistant-${messageId}`);
                            updateConversationsDB(update);
                            return update;
                        });
                        setMessages(prev => {
                            const update = [...prev, { id: `error-${messageId}`, content: { text: `*${res.message}*` }, isUser: false, isStreaming: false, isError: true }];
                            updateConversationsDB(update);
                            return update;
                        });
                    }
                }
                functionExecState = false;
                for await (const [index, toolCall] of Object.entries(finalToolCalls)) {
                    const toolName = toolCall.name;
                    const toolArgs = JSON.parse(toolCall.arguments);
                    const toolCallResult = await availableFunctions[toolName](toolArgs);
                    console.log("tsresult", toolCallResult)
                    prompt.push(toolCall);
                    prompt.push({
                        type: "function_call_output",
                        call_id: toolCall.call_id,
                        output: toolCallResult.message
                    });
                    if (toolName === "fetchScreen") {
                        if (domContentIndex) {
                            prompt.splice(domContentIndex, 1);
                        }
                        domContentIndex = prompt.length;
                        prompt.push(toolCallResult.data);
                    }
                    functionExecState = true;
                }
                setMessages(prev => {
                    const update = prev.map(msg => msg.id === `assistant-${messageId}` ? { ...msg, content: { text: response, files: [...(msg.content.files || [])] } } : msg);
                    updateConversationsDB(update);
                    return update;
                });
                if (!abortControllerRef.current.signal.aborted) {
                    setMessages(prev => {
                        const update = prev.map(msg => msg.id === `assistant-${messageId}` ? { ...msg, isStreaming: false } : msg);
                        updateConversationsDB(update);
                        return update;
                    });
                }
                if (!finish) {
                    messageId = Date.now().toString();
                    setMessages(prev => {
                        const update = [
                            ...prev,
                            { id: `assistant-${messageId}`, content: { text: "", files: [] }, isUser: false, isStreaming: true, isError: false }
                        ];
                        updateConversationsDB(update);
                        return update;
                    });
                    prompt.push({ type: "response", content: [{ type: "text", text: response }] });
                }
            } while (!finish || functionExecState);
        } catch (error) {
            console.log(error);
            if (!abortControllerRef.current?.signal.aborted) {
                setMessages(prev => {
                    const update = [...prev, { id: `error-${messageId}`, content: { text: "*User interupted while processing.*" }, isUser: false, isStreaming: false, isError: true }];
                    updateConversationsDB(update);
                    return update;
                });
                userInterruptRef.current = false;
            } else {
                console.error(error);
            }
        } finally {
            chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
                if (!tabs || !tabs[0]?.id) {
                    return;
                }
                chrome.debugger.detach({ tabId: tabs[0].id }, () => {
                    if (chrome.runtime.lastError) {
                        console.error("Error detaching from tab:", chrome.runtime.lastError.message);
                    }
                });
            });
            if (!abortControllerRef.current?.signal.aborted) {
                setIsGenerating(false);
                setMessage("");
                setFiles([]);
                if (textareaRef.current) {
                    textareaRef.current.style.height = "auto";
                    textareaRef.current.style.color = "#ffffff";
                };
            }
            abortControllerRef.current = null;
        }
    };

    const handleNewChat = async () => {
        await handleStopGeneration();
        while (userInterruptRef.current) {
            await new Promise(resolve => setTimeout(resolve, 1));
        }
        fetchConversations();
        setIsFirstMessage(true);
        setMessages([]);
        conversationID.current = null;
        setCurrentTitle("New Chat");
        setMessage("");
        setFiles([]);
        homeSection.current?.classList.remove("hidden");
        textareaRef.current?.focus();
    };

    const handleSelectConversation = async (id: string) => {
        if (id === conversationID.current) return;
        await fetchConversations();
        const conversation = conversations.find(c => c.id === id);
        if (conversation) {
            await handleStopGeneration();
            while (userInterruptRef.current) {
                await new Promise(resolve => setTimeout(resolve, 1));
            }
            setMessages([]);
            await new Promise(resolve => setTimeout(resolve, 100));
            setIsFirstMessage(false);
            setMessages(conversation.messages);
            conversationID.current = id;
            setMessage("");
            setFiles([]);
            setCurrentTitle(conversation.title);
            homeSection.current?.classList.add("hidden");
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

    return (
        <>
            <Toaster
                position="top-center"
                reverseOrder={false}
            />
            <Particles className="particles" quantity={150} />
            <HistorySidebar
                currentConversationId={conversationID.current}
                conversations={conversations}
                visible={sidebarHovered}
                onSelectConversation={handleSelectConversation}
                onRemoveConversation={handleItemRemove}
            />
            <div className="container">
                <Header
                    currentConversationId={conversationID.current}
                    currentTitle={currentTitle}
                    onNewChat={handleNewChat}
                />
                <Hero
                    homeSection={homeSection}
                    onPromptClick={handleNewChat}
                />
                <ChatContainer messages={messages} />
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

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);