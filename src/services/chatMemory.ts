import type { ChatMessage } from "../types";

export class ChatMemory {
  private readonly recentMessagesByChat = new Map<string, ChatMessage[]>();

  constructor(
    private readonly inMemoryHistoryLimit: number,
    private readonly contextMessages: number
  ) {}

  pushMessage(chatId: string, message: ChatMessage) {
    const list = this.recentMessagesByChat.get(chatId) ?? [];
    list.push(message);

    if (list.length > this.inMemoryHistoryLimit) {
      list.shift();
    }

    this.recentMessagesByChat.set(chatId, list);
  }

  getContextFromOtherUsers(chatId: string, excludeUserId: string): ChatMessage[] {
    const list = this.recentMessagesByChat.get(chatId) ?? [];
    return list.filter((msg) => msg.userId !== excludeUserId).slice(-this.contextMessages);
  }
}
