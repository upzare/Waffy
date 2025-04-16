import Browser from 'webextension-polyfill';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { OpenAI } from "openai";

export async function* ai(model: string, messages: any[], signal?: AbortSignal) {
    const all_tools = [
        {
            "type": "function",
            "name": "fetchScreen",
            "description": "Get the current page screenshot as annotated image.",
            "strict": true,
            "parameters": {
                "type": "object",
                "properties": {},
                "additionalProperties": false
            }
        },
        {
            "type": "function",
            "name": "click",
            "description": "Simulate a click on the specified DOM element",
            "strict": true,
            "parameters": {
                "type": "object",
                "properties": {
                    "elementId": {
                        "type": "number",
                        "description": "The ID of the input element. DO NOT USE ANY RANDOM ID."
                    }
                },
                "required": ["elementId"],
                "additionalProperties": false
            }
        },
        {
            "type": "function",
            "name": "typeText",
            "description": "Type text into the specified element",
            "strict": true,
            "parameters": {
                "type": "object",
                "properties": {
                    "elementId": {
                        "type": "number",
                        "description": "The ID of the input element. DO NOT USE ANY RANDOM ID."
                    },
                    "text": {
                        "type": "string",
                        "description": "The text to type"
                    }
                },
                "required": ["elementId", "text"],
                "additionalProperties": false
            }
        },
        {
            "type": "function",
            "name": "enterKey",
            "description": "Send enter key to the page",
            "strict": true,
            "parameters": {
                "type": "object",
                "properties": {},
                "additionalProperties": false
            }
        },
        {
            "type": "function",
            "name": "getOption",
            "description": "Get all available options for the specified select element",
            "strict": true,
            "parameters": {
                "type": "object",
                "properties": {
                    "elementId": {
                        "type": "number",
                        "description": "The ID of the specific element. DO NOT USE ANY RANDOM ID."
                    }
                },
                "required": ["elementId"],
                "additionalProperties": false
            }
        },
        {
            "type": "function",
            "name": "setOption",
            "description": "Set the value of a specified select. Fetch the available options first.",
            "strict": true,
            "parameters": {
                "type": "object",
                "properties": {
                    "elementId": {
                        "type": "number",
                        "description": "The ID of the input element. DO NOT USE ANY RANDOM ID."
                    },
                    "value": {
                        "type": "string",
                        "description": "The value to set. DO NOT USE ANY RANDOM VALUE. ALWAYS USE THE VALUES RETURNED BY getOptions. FETCH THE AVAILABLE OPTIONS FIRST."
                    }
                },
                "required": ["elementId", "value"],
                "additionalProperties": false
            }
        },
        {
            "type": "function",
            "name": "loadingState",
            "description": "Check whether the page is loading or fully loaded",
            "strict": true,
            "parameters": {
                "type": "object",
                "properties": {},
                "additionalProperties": false
            }
        },
        {
            "type": "function",
            "name": "goto",
            "description": "Navigate to a given URL in current tab.",
            "strict": true,
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": "The URL to navigate to."
                    }
                },
                "required": ["url"],
                "additionalProperties": false
            }
        },
        {
            "type": "function",
            "name": "open",
            "description": "Navigate to a given URL in new tab.",
            "strict": true,
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": "The URL to navigate to."
                    }
                },
                "required": ["url"],
                "additionalProperties": false
            }
        },
        {
            "type": "function",
            "name": "close",
            "description": "Closes the current tab",
            "strict": true,
            "parameters": {
                "type": "object",
                "properties": {},
                "additionalProperties": false
            }
        },
        {
            "type": "function",
            "name": "reload",
            "description": "Reloads the current tab",
            "strict": true,
            "parameters": {
                "type": "object",
                "properties": {},
                "additionalProperties": false
            }
        },
        {
            "type": "function",
            "name": "checkScrollbar",
            "description": "Check whether the page is scrollable or not. Returns scroll position if it is scrollable.",
            "strict": true,
            "parameters": {
                "type": "object",
                "properties": {},
                "additionalProperties": false
            }
        },
        {
            "type": "function",
            "name": "scroll",
            "description": "Scrolls the page in the specified direction and returns the current scrollbar position",
            "strict": true,
            "parameters": {
                "type": "object",
                "properties": {
                    "direction": {
                        "type": "string",
                        "enum": ["up", "down", "left", "right"],
                        "description": "The direction to scroll"
                    }
                },
                "required": ["direction"],
                "additionalProperties": false
            }
        },
        {
            "type": "function",
            "name": "wait",
            "description": "Wait for a specified amount of time",
            "strict": true,
            "parameters": {
                "type": "object",
                "properties": {
                    "ms": {
                        "type": "number",
                        "description": "The amount of time to wait in milliseconds"
                    }
                },
                "required": ["ms"],
                "additionalProperties": false
            }
        },
    ];
    const settings: Record<string, unknown> = await Browser.storage.local.get("extension_settings");
    const records = JSON.parse(settings.extension_settings as string);
    const client = new OpenAI({ apiKey: records.gptAPIKey, dangerouslyAllowBrowser: true });
    const response = await client.responses.create({
        model: model,
        input: messages,
        tools: all_tools as any,
        stream: true,
        parallel_tool_calls: false,
        tool_choice: 'auto',
        truncation: "auto",
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