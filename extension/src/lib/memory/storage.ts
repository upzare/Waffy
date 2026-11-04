import { liveQuery } from "dexie";
import type { Memory, MemoryScope, MemorySearchResult, StorageAdapter } from "turbomem";
import { db, type StoredMemory } from "@/lib/db";

function cosineSimilarity(a: number[], b: number[]): number {
  const length = Math.min(a.length, b.length);
  let dot = 0;
  let left = 0;
  let right = 0;
  for (let i = 0; i < length; i++) {
    dot += a[i] * b[i];
    left += a[i] * a[i];
    right += b[i] * b[i];
  }
  const denom = Math.sqrt(left) * Math.sqrt(right);
  return denom === 0 ? 0 : dot / denom;
}

function toMemory(row: StoredMemory): Memory {
  return {
    id: row.id,
    content: row.content,
    embedding: row.embedding,
    metadata: {},
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt),
  };
}

export class IndexedDbStorage implements StorageAdapter {
  async init(_dimensions: number): Promise<void> {}

  async insert(memory: Omit<Memory, "id" | "createdAt" | "updatedAt">): Promise<Memory> {
    const now = new Date();
    const row: StoredMemory = {
      id: crypto.randomUUID(),
      content: memory.content,
      embedding: memory.embedding,
      createdAt: now,
      updatedAt: now,
    };
    await db.memories.add(row);
    return toMemory(row);
  }

  async update(
    id: string,
    patch: { content: string; embedding: number[]; metadata?: Record<string, unknown> }
  ): Promise<Memory> {
    const existing = await db.memories.get(id);
    if (!existing) throw new Error(`Memory not found: ${id}`);
    const updated: StoredMemory = {
      ...existing,
      content: patch.content,
      embedding: patch.embedding,
      updatedAt: new Date(),
    };
    await db.memories.put(updated);
    return toMemory(updated);
  }

  async search(
    embedding: number[],
    _scope: MemoryScope,
    limit: number
  ): Promise<MemorySearchResult[]> {
    const rows = await db.memories.toArray();
    return rows
      .map((row) => ({ memory: toMemory(row), score: cosineSimilarity(embedding, row.embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(1, limit));
  }

  async getAll(_scope: MemoryScope): Promise<Memory[]> {
    const rows = await db.memories.toArray();
    return rows.map(toMemory).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async delete(id: string): Promise<void> {
    await db.memories.delete(id);
  }

  async deleteAll(_scope: MemoryScope): Promise<void> {
    await db.memories.clear();
  }
}

export async function listMemories(): Promise<Memory[]> {
  const rows = await db.memories.toArray();
  return rows.map(toMemory).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
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
