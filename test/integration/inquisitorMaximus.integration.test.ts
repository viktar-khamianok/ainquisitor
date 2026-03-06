import { mkdtemp, rm, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { BotMessageProcessor } from "../../src/core/botMessageProcessor";
import { ChatMemory } from "../../src/services/chatMemory";
import type { JsonSchema, LlmService } from "../../src/services/llmService";
import { SinService } from "../../src/services/sinService";
import { JsonStorageService } from "../../src/storage/jsonStorageService";
import { SinStorageService } from "../../src/storage/sinStorageService";
import type { ChatMemorySnapshot, SinDetection, StorageShape } from "../../src/types";

const BOT_NAME = "Inquisitor Maximus";
const CHAT_ID = "friends-chat-001";
const FIXTURE_PATH = path.join(process.cwd(), "test", "fixtures", "three_friends_chat.txt");

class FakeLlmService implements LlmService {
  async generateText(_prompt: string): Promise<string> {
    return "Похвали каждого друга за одно хорошее качество и купи всем по чаю.";
  }

  async generateJson<T>(prompt: string, _schemaName: string, _schema: JsonSchema): Promise<T> {
    const currentText = this.extractCurrentMessage(prompt).toLowerCase();
    const detected = this.detectByKeyword(currentText);
    return detected as T;
  }

  private extractCurrentMessage(prompt: string): string {
    const lines = prompt
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    return lines[lines.length - 1] ?? "";
  }

  private detectByKeyword(text: string): SinDetection {
    const mapping: Array<{ keyword: string; sinName: string }> = [
      { keyword: "ленюсь", sinName: "Лень" },
      { keyword: "завид", sinName: "Зависть" },
      { keyword: "осужда", sinName: "Осуждение" },
      { keyword: "гнева", sinName: "Гнев" },
      { keyword: "жаднич", sinName: "Жадность" },
      { keyword: "горжусь", sinName: "Гордыня" },
      { keyword: "вру", sinName: "Ложь" },
      { keyword: "тщеслав", sinName: "Тщеславие" },
      { keyword: "злопамят", sinName: "Злопамятство" },
      { keyword: "алчност", sinName: "Алчность" },
    ];

    const found = mapping.find((entry) => text.includes(entry.keyword));
    if (!found) {
      return {
        is_sin: false,
        sin_name: "",
        manifestation: "",
      };
    }

    return {
      is_sin: true,
      sin_name: found.sinName,
      manifestation: text,
    };
  }
}

function parseLine(line: string) {
  const [dateTime, userId, username, ...messageParts] = line.split("|");
  return {
    dateTime,
    userId,
    username,
    text: messageParts.join("|").trim(),
  };
}

let tempDir = "";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("Inquisitor Maximus integration", () => {
  afterAll(async () => {
    if (tempDir) {
      await sleep(100);
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("replays group chat line by line and prints bot answers", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "ainq-int-"));
    const sinStoragePath = path.join(tempDir, "sins.json");
    const contextStoragePath = path.join(tempDir, "context.json");

    const sinJsonStorage = new JsonStorageService<StorageShape>(
      sinStoragePath,
      () => ({ chats: {} }),
      "integration sin storage"
    );
    const contextJsonStorage = new JsonStorageService<ChatMemorySnapshot>(
      contextStoragePath,
      () => ({ chats: {} }),
      "integration context storage"
    );

    const sinStorage = new SinStorageService(sinJsonStorage);
    const memory = new ChatMemory(100, 15, contextJsonStorage);
    const sinService = new SinService(new FakeLlmService());
    const processor = new BotMessageProcessor(memory, sinService, sinStorage, 10);

    await sinStorage.load();
    await memory.load();

    const transcriptRaw = await readFile(FIXTURE_PATH, "utf-8");
    const lines = transcriptRaw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    let totalBotReplies = 0;
    let punishments = 0;
    let messageId = 1;

    console.log(`\n=== ${BOT_NAME}: integration replay started ===`);
    for (const line of lines) {
      const msg = parseLine(line);
      console.log(`[${msg.dateTime}] ${msg.username}: ${msg.text}`);

      const replies = await processor.process({
        chatId: CHAT_ID,
        userId: msg.userId,
        username: msg.username,
        text: msg.text,
        dateTime: msg.dateTime,
        messageId,
      });
      messageId += 1;

      for (const reply of replies) {
        totalBotReplies += 1;
        if (reply.text.startsWith("Епитимья:")) {
          punishments += 1;
        }
        console.log(`[${BOT_NAME} -> ${msg.username}] ${reply.text}`);
      }
    }
    console.log(`=== ${BOT_NAME}: integration replay finished ===\n`);

    await sleep(100);
    expect(totalBotReplies).toBeGreaterThan(0);
    expect(punishments).toBeGreaterThan(0);
  });
});
