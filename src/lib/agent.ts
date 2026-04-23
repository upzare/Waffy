import { getLocalStorage } from './client';
import { fetchEventSource } from "@microsoft/fetch-event-source";

const API_URL = process.env.NODE_ENV === "production" ? "https://waffy-preview-api.upzare.com/inference" : "http://localhost:4000/inference";

export async function createConversation(conversationID: string | null) {
    try {
        const localStorage: Record<string, any> = await getLocalStorage();
        const response = await fetch(`${API_URL}/start`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${localStorage.data.waffyAPI}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                id: conversationID,
                metadata: {
                    client_id: localStorage.client.client_id,
                    account_id: localStorage.data.account.account_id,
                }
            }),
        });

        const data = await response.json();
        if (data.status !== "success") {
            throw new Error(data.message);
        }
        return data.id;
    } catch (error) {
        throw new Error("Connection Failed");
    }
}

export async function createTitle(conversationID: string | null, prompt: string) {
    try {
        const localStorage: Record<string, any> = await getLocalStorage();
        const response = await fetch(`${API_URL}/meta`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${localStorage.data.waffyAPI}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                id: conversationID,
                prompt: prompt,
                metadata: {
                    client_id: localStorage.client.client_id,
                    account_id: localStorage.data.account.account_id,
                }
            }),
        });

        const data: any = await response.json();
        const title = data.title ?? "Untitled";
        return title;
    } catch (error) {
        throw new Error("Title Generation Error");
    }
}

export async function* AI(conversationID: string | null, messages: any[], handler: string, messageID: string | null, abortController: AbortController | null, handleError: () => void):
    AsyncGenerator<any> {
    const localStorage: Record<string, any> = await getLocalStorage();

    const generateMetadata = () => {
        const metadata: any = {}
        if (localStorage.client.client_id) metadata.client_id = localStorage.client.client_id;
        if (localStorage.data.account.account_id) metadata.account_id = localStorage.data.account.account_id;
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
            id: conversationID,
            data: messages,
            metadata: generateMetadata(),
        }),
        signal: abortController?.signal,
        openWhenHidden: true,
        onmessage(event) {
            pushEvent(JSON.parse(event.data));
        },
        onclose() {
            done = true;
            if (resolveQueue) resolveQueue();
        },
        onerror(err) {
            done = true;
            if (resolveQueue) resolveQueue();
            handleError();
            throw new Error(err);
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