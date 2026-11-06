import Dexie, { liveQuery, type EntityTable } from "dexie";
import type { Conversation, Message } from "@/types";

export interface StoredMemory {
  id: string;
  content: string;
  embedding: number[];
  createdAt: Date;
  updatedAt: Date;
}

class WaffyDB extends Dexie {
  conversations!: EntityTable<Conversation, "id">;
  memories!: EntityTable<StoredMemory, "id">;

  constructor() {
    super("WaffyDB");
    this.version(1).stores({
      conversations: "id, timestamp",
    });
    this.version(2).stores({
      memories: "id",
    });
  }
}

export const db = new WaffyDB();

export function listConversations(): Promise<Conversation[]> {
  return db.conversations.orderBy("timestamp").reverse().toArray();
}

export function createConversation(id: string): Promise<string> {
  return db.conversations.add({
    id,
    title: "New Chat",
    timestamp: new Date(),
    messages: [],
  });
}

export function updateConversationMessages(id: string, messages: Message[]): Promise<number> {
  return db.conversations.update(id, {
    messages,
    timestamp: new Date(),
  });
}

export function updateConversationTitle(id: string, title: string): Promise<number> {
  return db.conversations.update(id, { title });
}

export function deleteConversation(id: string): Promise<void> {
  return db.conversations.delete(id);
}

export function observeConversations() {
  return liveQuery(() => listConversations());
}
