import type { Logger } from "./logger";
import type { StorageService } from "../storage/storageService";
import type { ChatMemorySnapshot, ChatMessage } from "../types";

export class ChatMemory {
  private readonly recentMessagesByChat = new Map<string, ChatMessage[]>();

  constructor(
    private readonly inMemoryHistoryLimit: number,
    private readonly contextMessages: number,
    private readonly storage?: StorageService<ChatMemorySnapshot>,
    private readonly logger?: Logger
  ) {}

  async load() {
    if (!this.storage) {
      return;
    }

    await this.storage.load();
    const snapshot = this.storage.read();
    for (const [chatId, messages] of Object.entries(snapshot.chats ?? {})) {
      this.recentMessagesByChat.set(chatId, messages.slice(-this.inMemoryHistoryLimit));
    }

    this.logger?.info("Context memory loaded", { chats: this.recentMessagesByChat.size });
  }

  pushMessage(chatId: string, message: ChatMessage) {
    const list = this.recentMessagesByChat.get(chatId) ?? [];
    list.push(message);

    if (list.length > this.inMemoryHistoryLimit) {
      list.shift();
    }

    this.recentMessagesByChat.set(chatId, list);
    this.persist();
  }

  getContextFromOtherUsers(chatId: string, excludeUserId: string): ChatMessage[] {
    const list = this.recentMessagesByChat.get(chatId) ?? [];
    return list.filter((msg) => msg.userId !== excludeUserId).slice(-this.contextMessages);
  }

  private persist() {
    if (!this.storage) {
      return;
    }

    const snapshot = this.snapshot();
    this.storage.update((data) => {
      data.chats = snapshot.chats;
    });
    this.logger?.debug("Context memory persisted", { chats: Object.keys(snapshot.chats).length });
  }

  private snapshot(): ChatMemorySnapshot {
    const chats: Record<string, ChatMessage[]> = {};
    for (const [chatId, messages] of this.recentMessagesByChat.entries()) {
      chats[chatId] = messages.slice(-this.contextMessages);
    }
    return { chats };
  }
}
