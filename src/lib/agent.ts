import { OpenAI } from "openai";
import { getLocalStorage } from './client';
import { fetchEventSource } from "@microsoft/fetch-event-source";

export async function* ai2(messages: any[], handler: string, signal?: AbortSignal) {
    const localStorage: Record<string, any> = await getLocalStorage();
    const client = new OpenAI({ apiKey: localStorage.data.waffyAPI, dangerouslyAllowBrowser: true, baseURL: "http://localhost:4000/" });
    // @ts-ignore
    const response = await client.responses.create({
        handler,
        data: messages,
        stream: true,
        metadata: {
            client_id: localStorage.client.client_id,
            account_id: localStorage.data.account.account_id,
            mode: handler,
        },
    });

    for await (const event of response) {
        if (signal?.aborted) return;
        yield event;
    }
}

export async function* AI(conversationID: string | null, messages: any[], handler: string, mode: string, messageID: string | null, signal?: AbortSignal):
    AsyncGenerator<any> {
    const localStorage: Record<string, any> = await getLocalStorage();

    // SSE handler
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

    fetchEventSource(`http://localhost:4000/inference/${mode}`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${localStorage.data.waffyAPI}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            id: conversationID,
            data: messages,
            metadata: {
                client_id: localStorage.client.client_id,
                account_id: localStorage.data.account.account_id,
                mode: handler,
                message_id: messageID,
            },
        }),
        signal: signal,
        openWhenHidden: true,
        onmessage(event) {
            pushEvent(JSON.parse(event.data));
        },
        onclose() {
            done = true;
            if (resolveQueue) resolveQueue();
        },
        onerror(err) {
            throw new Error(err);
        }
    });

    while (!done || queue.length > 0) {
        if (queue.length === 0) {
            await waitForEvent();
        }
        while (queue.length > 0) {
            yield queue.shift();
        }
    }
}

export async function createTitle(conversationID: string | null, prompt: string) {
    try {
        const localStorage: Record<string, any> = await getLocalStorage();
        const response = await fetch("http://localhost:4000/inference/meta", {
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
        throw new Error("Title Error");
    }
}

export async function createConversation(conversationID: string | null) {
    try {
        const localStorage: Record<string, any> = await getLocalStorage();
        const response = await fetch("http://localhost:4000/inference/start", {
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
        throw new Error("Conversation Error");
    }
}