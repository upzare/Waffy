import Browser from 'webextension-polyfill';
import { OpenAI } from "openai";

export async function* ai(messages: any[], handler: string, signal?: AbortSignal) {
    const settings: Record<string, unknown> = await Browser.storage.local.get("extension_settings");
    const records = JSON.parse(settings.extension_settings as string);
    const client = new OpenAI({ apiKey: records.gptAPIKey, dangerouslyAllowBrowser: true, baseURL: "http://localhost:4000/" });
    // @ts-ignore
    const response = await client.responses.create({
        handler,
        data: messages,
        stream: true,
        metadata: {
            client_id: "unique-client-123",
            trace_user_id: "user-123"
        },
    });

    for await (const event of response) {
        if (signal?.aborted) return;
        yield event;
    }
}

export async function generateTitle(prompt: string) {
    try {
        const settings: Record<string, unknown> = await Browser.storage.local.get("extension_settings");
        const records = JSON.parse(settings.extension_settings as string);
        const client = new OpenAI({ apiKey: records.gptAPIKey, dangerouslyAllowBrowser: true, baseURL: "http://localhost:4000/" });
        const response = await client.responses.create({
            // @ts-ignore
            title: prompt,
            metadata: {
                client_id: "unique-client-123",
                trace_user_id: "user-123"
            }
        });

        const title = response.output_text ?? "Untitled";
        return title;
    } catch (error) {
        console.error("Title Generation Error");
        return "Untitled";
    }
}