import Dexie, { type EntityTable } from "dexie";
import type { Conversation, Message } from "@/types";

class WaffyDB extends Dexie {
  conversations!: EntityTable<Conversation, "id">;

  constructor() {
    super("WaffyDB");
    this.version(1).stores({
      conversations: "id, timestamp",
    });
  }
}

export const db = new WaffyDB();

export function listConversations(): Promise<Conversation[]> {
  return db.conversations.orderBy("timestamp").reverse().toArray();
}

export function getConversation(id: string): Promise<Conversation | undefined> {
  return db.conversations.get(id);
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
  return db.conversations.update(id, { messages });
}

export function updateConversationTitle(id: string, title: string): Promise<number> {
  return db.conversations.update(id, { title });
}

export function deleteConversation(id: string): Promise<void> {
  return db.conversations.delete(id);
}
