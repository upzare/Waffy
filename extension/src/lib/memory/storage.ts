import { liveQuery } from "dexie";
import { cos_sim } from "@huggingface/transformers";
import { db, type StoredMemory } from "@/lib/db";

interface MemorySearchResult {
  memory: StoredMemory;
  score: number;
}

export function runMemoryTransaction<T>(operation: () => Promise<T>): Promise<T> {
  return db.transaction("rw", db.memories, operation);
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Embedding dimension mismatch: ${a.length} !== ${b.length}`);
  }

  const similarity = cos_sim(a, b);
  return Number.isFinite(similarity) ? similarity : 0;
}

function normalizeMemory(row: StoredMemory): StoredMemory {
  return {
    ...row,
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt),
  };
}

export async function insertMemory(content: string, embedding: number[]): Promise<void> {
  const now = new Date();
  await db.memories.add({
    id: crypto.randomUUID(),
    content,
    embedding,
    createdAt: now,
    updatedAt: now,
  });
}

export async function updateMemory(
  id: string,
  content: string,
  embedding: number[]
): Promise<void> {
  const updated = await db.memories.update(id, {
    content,
    embedding,
    updatedAt: new Date(),
  });
  if (!updated) throw new Error(`Memory not found: ${id}`);
}

export async function searchMemories(
  embedding: number[],
  limit: number
): Promise<MemorySearchResult[]> {
  const rows = await db.memories.toArray();
  return rows
    .map((row) => ({
      memory: normalizeMemory(row),
      score: cosineSimilarity(embedding, row.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(0, limit));
}

export async function listMemories(): Promise<StoredMemory[]> {
  const rows = await db.memories.toArray();
  return rows.map(normalizeMemory).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export function observeMemories() {
  return liveQuery(() => listMemories());
}

export async function deleteMemory(id: string): Promise<void> {
  await db.memories.delete(id);
}

export async function resetMemories(): Promise<void> {
  await db.memories.clear();
}
