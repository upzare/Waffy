import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import Browser from 'webextension-polyfill';
import { v4 as uuid4 } from 'uuid';
import toast, { Toaster } from 'react-hot-toast';
import { geminiResponseText, ai } from '../lib/agent';
import { Message, Conversation, Model, ToolCall } from '../types';
import Header from './components/Header';
import Home from './components/Home';
import ChatContainer from './components/ChatContainer';
import InputContainer from './components/InputContainer';
import Mousetrap from 'mousetrap';
import Speech from './utils/Speech';
import { systemPrompt } from './utils/SystemPrompt';
import { fileHandler } from './utils/FileHandler';
import { availableFunctions } from '../lib/tools';

const App = () => {
    const [messages, setMessages] = useState<any[]>([]);
    const [isFirstMessage, setIsFirstMessage] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [message, setMessage] = useState("");
    const [files, setFiles] = useState<File[]>([]);
    const [isRecording, setIsRecording] = useState(false);
    const [isRecorded, setIsRecorded] = useState(false);

    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [currentModel, setCurrentModel] = useState("");
    const [models, setModels] = useState<Model[]>([]);
    const [currentTitle, setCurrentTitle] = useState("New Chat");

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const homeSection = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const userInterruptRef = useRef<boolean>(false);

    const db = useRef<IDBDatabase>();
    const db_request = useRef<IDBOpenDBRequest>();
    const conversationID = useRef<string>("");

    useEffect(() => {
        initDB();
        fetchConversations();
        fetchModels();
        Mousetrap.bind("ctrl+space", () => { speechRecognition() });
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
    }

    const fetchConversations = async () => {
        const dbr: IDBOpenDBRequest = indexedDB.open("WaffyDB", 1);
        dbr.onsuccess = (event) => {
            (event.target as IDBOpenDBRequest).result.transaction("conversations", "readwrite").objectStore("conversations").getAll().onsuccess = (event) => {
                const data = (event.target as IDBRequest).result;
                setConversations(data);
            }
        }
    };

    const fetchModels = async () => {
        Browser.storage.local.get("extension_settings").then((result: any) => {
            if (result.extension_settings) {
                const settings = JSON.parse(result.extension_settings as string);
                if (settings.geminiApiKey) {
                    setModels(prev => [
                        ...prev,
                        { id: "o1", name: "O1", description: "Very Powerfull Reasoning Model" },
                        { id: "gpt-4o", name: "GPT-4o", description: "Very Powerfull LLM" },
                        { id: "gpt-4o-mini", name: "GPT-4o-Mini", description: "GPT Mini Powerfull LLM" },
                    ]);
                }
            }
        });
        setModels(prev => {
            if (prev.length > 0) {
                setCurrentModel(prev[0].id);
            }
            return prev;
        });
    };

    const updateConversationsDB = async (updatedMessages: Message[]) => {
        const conversationDB = db.current?.transaction("conversations", "readwrite").objectStore("conversations");
        if (conversationDB) {
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
        if (!models.find(m => m.id === currentModel)) {
            toast.error("No Model Selected", { duration: 3000 });
            return;
        }
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
                { id: `user-${messageId}`, content: { text: content, files: files, tool: {} }, isUser: true, isTool: false, isStreaming: false, isError: false },
                { id: `assistant-${messageId}`, content: { text: "", files: [], tool: {} }, isUser: false, isTool: false, isStreaming: true, isError: false }
            ];
            updateConversationsDB(update);
            return update;
        });
        // let systemPrompt = "";
        // let fetchPrompt = "";
        // await Browser.storage.local.get("extension_settings").then((result: any) => {
        //     if (result.extension_settings) {
        //         const settings = JSON.parse(result.extension_settings as string);
        //         systemPrompt = settings.systemPrompt;
        //         fetchPrompt = settings.fetchPrompt;
        //     }
        // });
        const prompt = [];
        // let domContentIndex;
        prompt.push({ role: "system", content: systemPrompt });
        for await (const msg of messages) {
            if (msg.isUser && !msg.isTool) {
                prompt.push({ role: "user", content: [{ type: "input_text", text: msg.content.text }, ...await fileHandler(msg.content.files!)] });
            }
            if (!msg.isUser && !msg.isTool) {
                prompt.push({ role: "assistant", content: [{ type: "output_text", text: msg.content.text }] });
            }
            if (msg.isTool && msg.content.tool?.toolCall?.type === "tool-call") {
                prompt.push({ role: "assistant", content: [msg.content.tool.toolCall] });
            }
            if (msg.isTool && msg.content.tool?.toolResult?.type === "tool-result") {
                prompt.push({ role: "tool", content: [msg.content.tool.toolResult] });
            }
        };
        prompt.push({ role: "user", content: [{ type: "input_text", text: content }, ...await fileHandler(files)] });
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
            do {
                console.log("Calling ai...");
                const responseStream = ai(currentModel, prompt, abortControllerRef.current.signal);
                let response = "";
                const finalToolCalls: Record<string, ToolCall> = {};
                for await (const res of responseStream) {
                    console.log(prompt);
                    if (res.type === "response.output_item.added" && res.item.type === "function_call") {
                        finalToolCalls[res.output_index] = res.item as ToolCall;
                    } else if (res.type === "response.function_call_arguments.delta") {
                        const index = res.output_index;
                        if (finalToolCalls[index]) {
                            finalToolCalls[index].arguments += res.delta;
                        }
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
                            const update = [...prev, { id: `error-${messageId}`, content: { text: `*${res.message}*` }, isUser: false, isTool: false, isStreaming: false, isError: true }];
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
                        let dom_content = `
 <PAGE_METDATA>
 <PAGE_URL>${toolCallResult.data.url}</PAGE_URL>
 </PAGE_METDATA>
 <PAGE_TEXT_CONTENT>
 ${toolCallResult.data.ocr_content}
 </PAGE_TEXT_CONTENT>
 `;
                        prompt.push({ role: "user", content: [{ type: "input_text", text: dom_content }, { type: "input_image", image_url: toolCallResult.data.annotatedImage }] });
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
                            { id: `assistant-${messageId}`, content: { text: "", files: [], tool: {} }, isUser: false, isTool: false, isStreaming: true, isError: false }
                        ];
                        updateConversationsDB(update);
                        return update;
                    });
                    prompt.push({ role: "assistant", content: [{ type: "output_text", text: response }] });
                }
            } while (!finish || functionExecState);
        } catch (error) {
            console.log(error);
            if (!abortControllerRef.current?.signal.aborted) {
                setMessages(prev => {
                    const update = [...prev, { id: `error-${messageId}`, content: { text: "*User interupted while processing.*" }, isUser: false, isTool: false, isStreaming: false, isError: true }];
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
        conversationID.current = "";
        setCurrentTitle("New Chat");
        setMessage("");
        setFiles([]);
        homeSection.current?.classList.remove("hidden");
        textareaRef.current?.focus();
    };

    const handleSelectConversation = async (id: string) => {
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

    const handleSelectModel = (id: string) => {
        toast.promise(
            new Promise<void>(resolve => { setCurrentModel(id); resolve() }),
            {
                loading: "Switching Model...",
                success: <b>Switched to {models.find(m => m.id === id)?.name}</b>,
                error: <b>Failed to switch model</b>,
            }, { duration: 2000 }
        );
        textareaRef.current?.focus();
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
            <Header
                models={models}
                currentModel={currentModel}
                currentTitle={currentTitle}
                conversations={conversations}
                conversationID={conversationID}
                isNewChat={isFirstMessage && messages.length === 0}
                onNewChat={handleNewChat}
                onSelectConversation={handleSelectConversation}
                onSelectModel={handleSelectModel}
                onItemRemove={handleItemRemove}
            />
            <Home homeSection={homeSection} />
            <ChatContainer messages={messages} />
            <InputContainer
                isGenerating={isGenerating}
                isRecording={isRecording}
                textareaRef={textareaRef}
                fileInputRef={fileInputRef}
                message={message}
                files={files}
                setMessage={setMessage}
                setFiles={setFiles}
                onSpeechRecognition={speechRecognition}
                onSendMessage={handleSendMessage}
                onStopGeneration={handleStopGeneration}
            />
        </>
    );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);