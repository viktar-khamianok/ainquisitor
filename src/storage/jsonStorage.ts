import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PunishmentEntry, SinEntry, StorageShape, UserRecord } from "../types";

export class JsonStorage {
  private data: StorageShape = { chats: {} };
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly storagePath: string) {}

  async load() {
    const dir = path.dirname(this.storagePath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    if (!existsSync(this.storagePath)) {
      await this.persist();
      return;
    }

    const raw = await readFile(this.storagePath, "utf-8");
    if (!raw.trim()) {
      this.data = { chats: {} };
      await this.persist();
      return;
    }

    this.data = JSON.parse(raw) as StorageShape;
  }

  getUserRecord(chatId: string, userId: string): UserRecord {
    if (!this.data.chats[chatId]) {
      this.data.chats[chatId] = { users: {} };
    }

    if (!this.data.chats[chatId].users[userId]) {
      this.data.chats[chatId].users[userId] = {
        sins_count: 0,
        sins: [],
        punishments: [],
      };
    }

    return this.data.chats[chatId].users[userId];
  }

  addSin(chatId: string, userId: string, sin: SinEntry): number {
    const user = this.getUserRecord(chatId, userId);
    user.sins.push(sin);
    user.sins_count += 1;
    this.queuePersist();
    return user.sins_count;
  }

  addPunishment(chatId: string, userId: string, punishment: PunishmentEntry): void {
    const user = this.getUserRecord(chatId, userId);
    user.punishments.push(punishment);
    user.sins_count = 0;
    this.queuePersist();
  }

  getRecentSins(chatId: string, userId: string, count: number): SinEntry[] {
    const user = this.getUserRecord(chatId, userId);
    return user.sins.slice(-count);
  }

  private queuePersist() {
    this.writeQueue = this.writeQueue.then(async () => {
      await this.persist();
    });
  }

  private async persist() {
    await writeFile(this.storagePath, JSON.stringify(this.data, null, 2), "utf-8");
  }
}
