import type { Logger } from "../services/logger";
import type { PunishmentEntry, SinEntry, StorageShape, UserRecord } from "../types";
import type { StorageService } from "./storageService";

export class SinStorageService {
  constructor(
    private readonly storage: StorageService<StorageShape>,
    private readonly logger?: Logger
  ) {}

  async load() {
    await this.storage.load();
  }

  addSin(chatId: string, userId: string, sin: SinEntry): number {
    let sinsCount = 0;

    this.storage.update((data) => {
      const user = this.ensureUserRecord(data, chatId, userId);
      user.sins.push(sin);
      user.sins_count += 1;
      sinsCount = user.sins_count;
    });

    this.logger?.debug("Sin saved", { chatId, userId, sinsCount });
    return sinsCount;
  }

  addPunishment(chatId: string, userId: string, punishment: PunishmentEntry): void {
    this.storage.update((data) => {
      const user = this.ensureUserRecord(data, chatId, userId);
      user.punishments.push(punishment);
      user.sins_count = 0;
    });

    this.logger?.debug("Punishment saved", { chatId, userId });
  }

  getRecentSins(chatId: string, userId: string, count: number): SinEntry[] {
    const user = this.getUserRecord(chatId, userId);
    return user.sins.slice(-count);
  }

  private getUserRecord(chatId: string, userId: string): UserRecord {
    const data = this.storage.read();
    return this.ensureUserRecord(data, chatId, userId);
  }

  private ensureUserRecord(data: StorageShape, chatId: string, userId: string): UserRecord {
    if (!data.chats[chatId]) {
      data.chats[chatId] = { users: {} };
    }

    if (!data.chats[chatId].users[userId]) {
      data.chats[chatId].users[userId] = {
        sins_count: 0,
        sins: [],
        punishments: [],
      };
    }

    return data.chats[chatId].users[userId];
  }
}
