import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import OpenAI from "openai";
import { afterAll, describe, it } from "vitest";
import { BotMessageProcessor } from "../../src/core/botMessageProcessor";
import { ChatMemory } from "../../src/services/chatMemory";
import { Logger } from "../../src/services/logger";
import { OpenAiService } from "../../src/services/openaiService";
import { SinService } from "../../src/services/sinService";
import { JsonStorageService } from "../../src/storage/jsonStorageService";
import { SinStorageService } from "../../src/storage/sinStorageService";
import type { ChatMemorySnapshot, StorageShape } from "../../src/types";

const BOT_NAME = "Inquisitor Maximus";
const CHAT_ID = "friends-chat-001";
const FIXTURE_PATH = path.join(process.cwd(), "test", "fixtures", "three_friends_chat.txt");
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

describe("Inquisitor Maximus integration (real LLM)", () => {
  afterAll(async () => {
    if (tempDir) {
      await sleep(100);
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("replays group chat line by line and prints bot answers", async () => {
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is required for this integration test");
    }

    const logger = new Logger("info");

    tempDir = await mkdtemp(path.join(os.tmpdir(), "ainq-int-real-"));
    const sinStoragePath = path.join(tempDir, "sins.json");
    const contextStoragePath = path.join(tempDir, "context.json");

    const sinJsonStorage = new JsonStorageService<StorageShape>(
      sinStoragePath,
      () => ({ chats: {} }),
      "integration sin storage",
      logger
    );
    const contextJsonStorage = new JsonStorageService<ChatMemorySnapshot>(
      contextStoragePath,
      () => ({ chats: {} }),
      "integration context storage",
      logger
    );

    const sinStorage = new SinStorageService(sinJsonStorage, logger);
    const memory = new ChatMemory(100, 15, contextJsonStorage, logger);
    const llmService = new OpenAiService(new OpenAI({ apiKey: OPENAI_API_KEY }), OPENAI_MODEL, logger);
    const sinService = new SinService(llmService, logger);
    const processor = new BotMessageProcessor(memory, sinService, sinStorage, 10, logger);

    await sinStorage.load();
    await memory.load();

    const transcriptRaw = await readFile(FIXTURE_PATH, "utf-8");
    const lines = transcriptRaw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    let messageId = 1;

    console.log(`\n=== ${BOT_NAME}: integration replay started (model: ${OPENAI_MODEL}) ===`);
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
        console.log(`[${BOT_NAME} -> ${msg.username}] ${reply.text}`);
      }
    }
    console.log(`=== ${BOT_NAME}: integration replay finished ===\n`);

    await sleep(100);
  }, 10 * 60 * 1000);
});
