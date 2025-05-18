import Browser from 'webextension-polyfill';
import { OpenAI } from "openai";

export async function* ai(messages: any[], handler: string, signal?: AbortSignal) {
    const localStorage: Record<string, unknown> = await Browser.storage.local.get("data");
    const records = JSON.parse(localStorage.data as string);
    const client = new OpenAI({ apiKey: records.gptAPIKey, dangerouslyAllowBrowser: true, baseURL: "http://localhost:4000/" });
    // @ts-ignore
    const response = await client.responses.create({
        handler,
        data: messages,
        stream: true,
        metadata: {
            client_id: records.client_id,
            trace_user_id: records.trace_user_id
        },
    });

    for await (const event of response) {
        if (signal?.aborted) return;
        yield event;
    }
}

export async function generateTitle(prompt: string) {
    try {
        const localStorage: Record<string, unknown> = await Browser.storage.local.get("data");
        const records = JSON.parse(localStorage.data as string);
        const client = new OpenAI({ apiKey: records.gptAPIKey, dangerouslyAllowBrowser: true, baseURL: "http://localhost:4000/" });
        const response = await client.responses.create({
            // @ts-ignore
            title: prompt,
            metadata: {
                client_id: records.client_id,
                trace_user_id: records.trace_user_id
            }
        });

        const title = response.output_text ?? "Untitled";
        return title;
    } catch (error) {
        console.error("Title Generation Error");
        return "Untitled";
    }
}