import Browser from 'webextension-polyfill';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { OpenAI } from "openai";

export async function* ai(model: string, messages: any[], signal?: AbortSignal) {
    const settings: Record<string, unknown> = await Browser.storage.local.get("extension_settings");
    const records = JSON.parse(settings.extension_settings as string);
    const client = new OpenAI({ apiKey: records.gptAPIKey, dangerouslyAllowBrowser: true, baseURL: "http://localhost:4000/" });
    // @ts-ignore
    const response = await client.responses.create({
        // model: model,
        data: messages,
        // input: messages,
        // tools: all_tools as any,
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

function inlineData(file: File): Promise<any> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            resolve({
                inlineData: {
                    data: reader.result?.toString().split(",")[1],
                    mimeType: file.type
                }
            });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

export async function* geminiResponseStream(selectedModel: string, prompt: string, files: File[], domImage: File, signal?: AbortSignal): AsyncGenerator<string> {
    try {
        const settings: Record<string, unknown> = await Browser.storage.local.get("extension_settings");
        const records = JSON.parse(settings.extension_settings as string);
        if (records.geminiApiKey) {
            const genAI = new GoogleGenerativeAI(records.geminiApiKey as string);
            const model = genAI.getGenerativeModel({ model: selectedModel });
            const parameters = [prompt];
            if (domImage) {
                const image = await inlineData(domImage);
                parameters.push(image);
            }
            if (files.length > 0) {
                const uploads = await Promise.all(
                    files.map(async (file) => { return await inlineData(file) })
                );
                parameters.push(...uploads);
            }
            let result = await model.generateContentStream(parameters);
            for await (const response of result.stream) {
                if (signal?.aborted) return;
                const chunk = response.text();
                if (chunk) yield JSON.stringify({ status: true, message: chunk });
            }
        } else {
            yield JSON.stringify({ status: false, message: "API key not found. Please set it in the extension settings." });
        }
    } catch (error) {
        console.error(error);
        if (error instanceof Error && error.name === "AbortError") {
            return;
        }
        yield JSON.stringify({ status: false, message: "API error occurred while processing your request." });
    }
}