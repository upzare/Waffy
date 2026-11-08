import { embedText } from "./embedding";
import { insertMemory, runMemoryTransaction, searchMemories, updateMemory } from "./storage";

const DEDUPE_SCORE = 0.7;
const RECALL_LIMIT = 5;

export async function rememberFact(fact: string) {
  const embedding = await embedText(fact);

  return runMemoryTransaction(async () => {
    const [closest] = await searchMemories(embedding, 1);

    if (closest && closest.score > DEDUPE_SCORE) {
      await updateMemory(closest.memory.id, fact, embedding);
      return { success: true, action: "updated" as const };
    }

    await insertMemory(fact, embedding);
    return { success: true, action: "created" as const };
  });
}

export async function recallMemories(query: string) {
  const embedding = await embedText(query);
  const results = await searchMemories(embedding, RECALL_LIMIT);
  return { memories: results.map(({ memory }) => memory.content) };
}
