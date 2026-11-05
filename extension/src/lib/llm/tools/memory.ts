import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { recallMemories, rememberFact } from "@/lib/memory/engine";

export const MEMORY_TOOLS = {
  rememberFact: tool({
    description: 'Automatically save one lasting fact the user just stated about themselves: name, job, location, language, preference, or ongoing project. Call it for "I\'m", "I prefer", "I work", and similar. Do not wait for them to say "remember". One call per fact.',
    inputSchema: z.object({
      fact: z
        .string()
        .trim()
        .min(1)
        .describe('One sentence starting with "The user". Not the raw user message.'),
    }),
    execute: ({ fact }) => rememberFact(fact),
  }),
  recallMemories: tool({
    description: 'Automatically search saved facts about the user before answering. Call once when they refer to themselves, their preferences, their project, or ask what you know about them. Do not wait for them to say "recall". Skip public facts, math, news, and page summaries.',
    inputSchema: z.object({
      query: z
        .string()
        .trim()
        .min(1)
        .describe('2-6 words about the user, such as "user name" or "current project". Do not paste the user message.'),
    }),
    execute: ({ query }) => recallMemories(query),
  }),
} as ToolSet;