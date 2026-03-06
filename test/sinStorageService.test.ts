import { describe, expect, it } from "vitest";
import { SinStorageService } from "../src/storage/sinStorageService";
import type { StorageService } from "../src/storage/storageService";
import type { StorageShape } from "../src/types";

class InMemoryStorage implements StorageService<StorageShape> {
  private data: StorageShape = { chats: {} };

  async load(): Promise<void> {
    return;
  }

  read(): StorageShape {
    return this.data;
  }

  update(mutator: (data: StorageShape) => void): void {
    mutator(this.data);
  }
}

describe("SinStorageService", () => {
  it("adds sins and increments counter per user in chat", () => {
    const storage = new SinStorageService(new InMemoryStorage());

    const count1 = storage.addSin("chat-1", "user-1", {
      date_time: "2026-03-06T10:05:00.000Z",
      sin: "Гнев",
      manifestation: "накричал",
    });
    const count2 = storage.addSin("chat-1", "user-1", {
      date_time: "2026-03-06T10:06:00.000Z",
      sin: "Лень",
      manifestation: "игнорировал задачу",
    });

    expect(count1).toBe(1);
    expect(count2).toBe(2);
    expect(storage.getRecentSins("chat-1", "user-1", 10)).toHaveLength(2);
  });

  it("resets sins_count after punishment and stores punishment", () => {
    const backend = new InMemoryStorage();
    const storage = new SinStorageService(backend);

    storage.addSin("chat-2", "user-2", {
      date_time: "2026-03-06T10:07:00.000Z",
      sin: "Зависть",
      manifestation: "язвительный комментарий",
    });
    storage.addPunishment("chat-2", "user-2", {
      date_time: "2026-03-06T10:08:00.000Z",
      reason: "Достигнут лимит 10 грехов",
      punishment: "Сказать 3 добрых слова в чат",
    });

    const userRecord = backend.read().chats["chat-2"].users["user-2"];
    expect(userRecord.sins_count).toBe(0);
    expect(userRecord.punishments).toHaveLength(1);
    expect(userRecord.punishments[0].reason).toContain("10");
  });

  it("returns only requested amount of recent sins", () => {
    const storage = new SinStorageService(new InMemoryStorage());

    for (let i = 1; i <= 5; i += 1) {
      storage.addSin("chat-3", "user-3", {
        date_time: `2026-03-06T10:0${i}:00.000Z`,
        sin: `Грех-${i}`,
        manifestation: `Проявление-${i}`,
      });
    }

    const lastTwo = storage.getRecentSins("chat-3", "user-3", 2);
    expect(lastTwo.map((s) => s.sin)).toEqual(["Грех-4", "Грех-5"]);
  });
});
