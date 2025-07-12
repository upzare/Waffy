import { OpenAI } from "openai";
import { getLocalStorage } from './client';

export async function* ai(messages: any[], handler: string, signal?: AbortSignal) {
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

export async function generateTitle(prompt: string) {
    try {
        const localStorage: Record<string, any> = await getLocalStorage();
        const client = new OpenAI({ apiKey: localStorage.data.waffyAPI, dangerouslyAllowBrowser: true, baseURL: "http://localhost:4000/" });
        const response = await client.responses.create({
            // @ts-ignore
            title: prompt,
            metadata: {
                client_id: localStorage.client.client_id,
                account_id: localStorage.data.account.account_id,
            }
        });

        const title = response.output_text ?? "Untitled";
        return title;
    } catch (error) {
        console.log("Title Generation Error");
        return "Untitled";
    }
}