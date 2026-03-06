import type { ChatMemory } from "../services/chatMemory";
import type { Logger } from "../services/logger";
import type { SinService } from "../services/sinService";
import type { SinStorageService } from "../storage/sinStorageService";

export type IncomingTextMessage = {
  chatId: string;
  userId: string;
  username: string;
  text: string;
  dateTime: string;
  messageId?: number;
};

export type BotReply = {
  text: string;
  replyToMessageId?: number;
};

export class BotMessageProcessor {
  constructor(
    private readonly memory: ChatMemory,
    private readonly sinService: SinService,
    private readonly storage: SinStorageService,
    private readonly maxSins: number,
    private readonly logger?: Logger
  ) {}

  async process(message: IncomingTextMessage): Promise<BotReply[]> {
    this.memory.pushMessage(message.chatId, {
      userId: message.userId,
      username: message.username,
      text: message.text,
      date_time: message.dateTime,
    });

    const context = this.memory.getContextFromOtherUsers(message.chatId, message.userId);
    const result = await this.sinService.detectSin(context, message.text);
    if (!result.is_sin) {
      this.logger?.debug("No sin detected", { chatId: message.chatId, userId: message.userId });
      return [];
    }

    const sinName = result.sin_name.trim() || "Неопределенный грех";
    const manifestation = result.manifestation.trim() || message.text;
    const currentCount = this.storage.addSin(message.chatId, message.userId, {
      date_time: message.dateTime,
      sin: sinName,
      manifestation,
    });

    this.logger?.info("Sin detected", {
      chatId: message.chatId,
      userId: message.userId,
      sinName,
      currentCount,
    });

    const replies: BotReply[] = [
      {
        text: `${sinName} ${Math.min(currentCount, this.maxSins)}/${this.maxSins}`,
        replyToMessageId: message.messageId,
      },
    ];

    if (currentCount >= this.maxSins) {
      const recentSins = this.storage.getRecentSins(message.chatId, message.userId, this.maxSins);
      const punishment = await this.sinService.generatePunishment(sinName, manifestation, recentSins);
      replies.push({ text: `Епитимья: ${punishment}` });

      this.storage.addPunishment(message.chatId, message.userId, {
        date_time: new Date().toISOString(),
        reason: `Достигнут лимит ${this.maxSins} грехов`,
        punishment,
      });

      this.logger?.warn("Punishment assigned", { chatId: message.chatId, userId: message.userId, punishment });
    }

    return replies;
  }
}
