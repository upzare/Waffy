import { getLocalStorage } from './client';
import { fetchEventSource } from "@microsoft/fetch-event-source";

const API_URL = process.env.NODE_ENV === "production" ? "https://waffy-preview-api.upzare.com/inference" : "http://localhost:4000/inference";

export async function createConversation(conversationId: string | null) {
    try {
        const localStorage: Record<string, any> = await getLocalStorage();
        const response = await fetch(`${API_URL}/start`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${localStorage.data.waffyAPI}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                id: conversationId,
                metadata: {
                    client_id: localStorage.client.client_id,
                }
            }),
        });

        const data = await response.json();
        if (!response.ok) {
            throw (data.detail || "Something went wrong. Please try again.");
        }
        return data.id;
    } catch (error) {
        throw error;
    }
}

export async function createTitle(conversationId: string | null, messageId: string | null, prompt: string) {
    try {
        const localStorage: Record<string, any> = await getLocalStorage();
        const response = await fetch(`${API_URL}/meta`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${localStorage.data.waffyAPI}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                id: conversationId,
                prompt: prompt,
                metadata: {
                    client_id: localStorage.client.client_id,
                    message_id: messageId,
                }
            }),
        });

        const data = await response.json();
        if (!response.ok) {
            throw (data.detail || "Something went wrong. Please try again.");
        }
        const title = data.title ?? "Untitled";
        return title;
    } catch (error) {
        throw "Title Generation Error";
    }
}

export async function* AI(conversationId: string | null, messages: any[], handler: string, messageID: string | null, abortController: AbortController | null, safeToAbortRef: React.RefObject<boolean>, displayError: (error?: string) => void):
    AsyncGenerator<any> {
    const localStorage: Record<string, any> = await getLocalStorage();

    const generateMetadata = () => {
        const metadata: any = {}
        if (localStorage.client.client_id) metadata.client_id = localStorage.client.client_id;
        if (handler) metadata.mode = handler;
        if (messageID) metadata.message_id = messageID;
        return metadata;
    }

    // SSE handler
    const abortSignal = abortController?.signal;
    let done = false;
    const queue: any[] = [];
    let resolveQueue: (() => void) | null = null;

    function pushEvent(data: any) {
        queue.push(data);
        if (resolveQueue) {
            resolveQueue();
            resolveQueue = null;
        }
    }

    function waitForEvent(): Promise<void> {
        return new Promise((resolve) => {
            resolveQueue = resolve;
        });
    }

    if (abortSignal) {
        abortSignal.addEventListener("abort", () => {
            done = true;
            if (resolveQueue) {
                resolveQueue();
                resolveQueue = null;
            }
        });
    }

    fetchEventSource(`${API_URL}/stream`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${localStorage.data.waffyAPI}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            id: conversationId,
            data: messages,
            metadata: generateMetadata(),
        }),
        signal: abortController?.signal,
        openWhenHidden: true,
        async onopen(response) {
            safeToAbortRef.current = true;
            if (!response.ok) {
                let errorMessage = "Something went wrong. Please try again.";
                try {
                    const data = await response.json();
                    errorMessage = data.detail || errorMessage;
                } catch { }
                done = true;
                if (resolveQueue) resolveQueue();
                throw new Error(errorMessage);
            }
        },
        onmessage(event) {
            pushEvent(JSON.parse(event.data));
        },
        onclose() {
            done = true;
            safeToAbortRef.current = false;
            if (resolveQueue) resolveQueue();
        },
        onerror(err) {
            done = true;
            safeToAbortRef.current = false;
            if (resolveQueue) resolveQueue();
            displayError(err?.message);
            throw err;
        }
    }).catch(() => { });

    while (!done || queue.length > 0) {
        if (queue.length === 0) {
            await waitForEvent();
        }
        while (queue.length > 0) {
            yield queue.shift();
        }
    }
}