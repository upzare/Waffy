import Browser from 'webextension-polyfill';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { OpenAI } from "openai";

export async function* ai(messages: any[], signal?: AbortSignal) {
    const settings: Record<string, unknown> = await Browser.storage.local.get("extension_settings");
    const records = JSON.parse(settings.extension_settings as string);
    const client = new OpenAI({ apiKey: records.gptAPIKey, dangerouslyAllowBrowser: true, baseURL: "http://localhost:4000/" });
    // @ts-ignore
    const response = await client.responses.create({
        data: messages,
        stream: true,
        metadata: {
            client_id: "unique-client-123",
            trace_user_id: "user-123"
        }
    });

    for await (const event of response) {
        if (signal?.aborted) return;
        yield event;
    }
}

export async function geminiResponseText(prompt: string) {
    try {
        const settings: Record<string, unknown> = await Browser.storage.local.get("extension_settings");
        const records = JSON.parse(settings.extension_settings as string);
        if (records.geminiApiKey) {
            const genAI = new GoogleGenerativeAI(records.geminiApiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const result = await model.generateContent(prompt);
            return { status: true, message: result.response.text() };
        } else {
            return { status: false, message: "API key not found. Please set it in the extension settings." };
        }
    } catch (error) {
        return { status: false, message: "Sorry, I encountered an error while processing your request." };
    }
}