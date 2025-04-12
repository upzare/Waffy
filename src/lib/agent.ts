import Browser from 'webextension-polyfill';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { APICallError, streamText, tool } from 'ai';
import { availableFunctions } from './tools';
import { fetchPrompt } from '../sidepanel/utils/SystemPrompt';

export async function* ai(model: string, messages: any[], signal?: AbortSignal) {
    const tools = {
        fetchScreen: tool({
            description: "Get the current page screenshot as annotated image.",
            parameters: z.object({}),
            execute: availableFunctions["fetchScreen"],
        }),
        click: tool({
            description: "Simulate a click on the specified DOM element",
            parameters: z.object({
                elementId: z.number().describe("The ID of the element to click. DO NOT USE ANY RANDOM ID."),
            }),
            execute: availableFunctions["click"],
        }),
        typeText: tool({
            description: "Type text into the specified element",
            parameters: z.object({
                elementId: z.number().describe("The ID of the input element. DO NOT USE ANY RANDOM ID."),
                text: z.string().describe("The text to type"),
                // global: z.boolean().describe("Whether to type the text globally (TRUE) or within an element (FALSE)"),
            }),
            execute: availableFunctions["typeText"],
        }),
        enterKey: tool({
            description: "Send enter key to the page",
            parameters: z.object({}),
            execute: availableFunctions["enterKey"],
        }),
        getOption: tool({
            description: "Get all available options for the specified select element",
            parameters: z.object({
                elementId: z.number().describe("The ID of the specific element. DO NOT USE ANY RANDOM ID."),
            }),
            execute: availableFunctions["getOption"],
        }),
        setOption: tool({
            description: "Set the value of a specified select. Fetch the available options first.",
            parameters: z.object({
                elementId: z.number().describe("The ID of the specific element. DO NOT USE ANY RANDOM ID."),
                value: z.string().describe("The value to set. DO NOT USE ANY RANDOM VALUE. ALWAYS USE THE VALUES RETURNED BY getOptions. FETCH THE AVAILABLE OPTIONS FIRST."),
            }),
            execute: availableFunctions["setOption"],
        }),
        loadingState: tool({
            description: "Check whether the page is loading or fully loaded",
            parameters: z.object({}),
            execute: availableFunctions["loadingState"],
        }),
        goto: tool({
            description: "Navigate to a given URL in current tab.",
            parameters: z.object({
                url: z.string().describe("The URL to navigate to."),
            }),
            execute: availableFunctions["goto"],
        }),
        // open: tool({
        //     description: "Navigate to a given URL in new tab.",
        //     parameters: z.object({
        //         url: z.string().describe("The URL to navigate to."),
        //     }),
        //     execute: availableFunctions["open"],
        // }),
        close: tool({
            description: "Closes the current tab",
            parameters: z.object({}),
            execute: availableFunctions["close"],
        }),
        reload: tool({
            description: "Reloads the current tab",
            parameters: z.object({}),
            execute: availableFunctions["reload"],
        }),
        checkScrollbar: tool({
            description: "Check whether the page is scrollable or not. Returns scroll position if it is scrollable.",
            parameters: z.object({}),
            execute: availableFunctions["checkScrollbar"],
        }),
        scroll: tool({
            description: "Scrolls the page in the specified direction and returns the current scrollbar position",
            parameters: z.object({
                direction: z.enum(["up", "down", "left", "right"]).describe("The direction to scroll"),
                // x: z.number().describe("The number of pixels to scroll horizontally"),
                // y: z.number().describe("The number of pixels to scroll vertically"),
            }),
            execute: availableFunctions["scroll"],
        }),
        wait: tool({
            description: "Wait for a specified amount of time",
            parameters: z.object({
                ms: z.number().describe("The amount of time to wait in milliseconds"),
            }),
            execute: availableFunctions["wait"],
        }),
        pdf: tool({
            description: "Generate PDF file with text",
            parameters: z.object({
                text: z.string().describe("Text to add inside PDF file, with markdown support"),
            }),
            execute: availableFunctions["pdf"],
        }),
    };
    const settings: Record<string, unknown> = await Browser.storage.local.get("extension_settings");
    const records = JSON.parse(settings.extension_settings as string);
    const genAI = createGoogleGenerativeAI({ apiKey: records.geminiApiKey });
    const openai = createOpenAI({ apiKey: records.gptAPIKey, baseURL: "http://0.0.0.0:4000/v1" });
    let currentModel;
    let domContentIndex: number;
    if (model.startsWith("gpt") || model.startsWith("o1")) {
        currentModel = openai(model, {
            parallelToolCalls: false,
        });
    } else {
        currentModel = genAI(model);
    }
    const response = streamText({
        model: currentModel,
        tools: tools,
        messages: messages,
        maxSteps: 500,
        abortSignal: signal,
        experimental_continueSteps: true,
        // providerOptions: {
        //     openai: {
        //         reasoningEffort: "high",
        //     },
        // },
        onError: async (error) => {
            console.log('Stream Error:', error);
            if (APICallError.isInstance(error)) {
                console.log('API Error:', error.message);
            }
        },
        onStepFinish: async (step) => {
            console.log("STEP FINISH:", step);
            if (step.finishReason === "tool-calls") {
                const toolCall = step.toolCalls[0];
                const functionID = toolCall.toolCallId;
                const functionName = toolCall.toolName;
                const functionArgs = toolCall.args;
                const functionResponse = step.toolResults[0].result;
                // messages.push({
                //     role: "assistant", content: [{
                //         type: "tool-call",
                //         toolCallId: functionID,
                //         toolName: functionName,
                //         args: functionArgs,
                //     }]
                // });
                // messages.push({
                //     role: "tool", content: [{
                //         type: "tool-result",
                //         toolCallId: functionID,
                //         toolName: functionName,
                //         args: functionArgs,
                //         result: functionResponse.message,
                //     }]
                // });
                if (functionResponse.status === "success" && functionResponse.data) {
                    if (functionResponse.data.type === "dom") {
                        if (domContentIndex) {
                            messages.splice(domContentIndex, 1);
                        }
                        domContentIndex = messages.length;
                        let dom_content = fetchPrompt;
                        dom_content += `
<PAGE_METDATA>
<PAGE_URL>${functionResponse.data.url}</PAGE_URL>
</PAGE_METDATA>
<PAGE_TEXT_CONTENT>
${functionResponse.data.ocr_content}
</PAGE_TEXT_CONTENT>
`;
                        messages.push({ role: "user", content: [{ type: "text", text: dom_content }, { type: "image", image: new URL(functionResponse.data.annotatedImage) }] });
                    }
                }
            }
        },
    });

    for await (const res of response.fullStream) {
        if (signal?.aborted) return;
        yield res;
        console.log(res);
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