import "dotenv/config";
import OpenAI from "openai";
import { Telegraf } from "telegraf";
import { config } from "./config";
import { BotMessageProcessor } from "./core/botMessageProcessor";
import { ChatMemory } from "./services/chatMemory";
import { Logger } from "./services/logger";
import { OpenAiService } from "./services/openaiService";
import { SinService } from "./services/sinService";
import { JsonStorageService } from "./storage/jsonStorageService";
import { SinStorageService } from "./storage/sinStorageService";
import type { ChatMemorySnapshot, StorageShape } from "./types";

const logger = new Logger(config.logLevel);
const bot = new Telegraf(config.telegramBotToken);

const jsonStorage = new JsonStorageService<StorageShape>(
  config.storagePath,
  () => ({ chats: {} }),
  "sin storage",
  logger
);
const storage = new SinStorageService(jsonStorage, logger);

const contextStorage = new JsonStorageService<ChatMemorySnapshot>(
  config.contextStoragePath,
  () => ({ chats: {} }),
  "context memory",
  logger
);
const memory = new ChatMemory(config.inMemoryHistoryLimit, config.contextMessages, contextStorage, logger);

const llmService = new OpenAiService(new OpenAI({ apiKey: config.openaiApiKey }), config.openaiModel, logger);
const sinService = new SinService(llmService, logger);
const processor = new BotMessageProcessor(memory, sinService, storage, config.maxSins, logger);

bot.on("text", async (ctx) => {
  const chatId = String(ctx.chat.id);
  const userId = String(ctx.from.id);
  const username =
    ctx.from.username ??
    [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(" ") ??
    `user_${userId}`;
  const text = ctx.message.text.trim();
  const now = new Date().toISOString();

  try {
    const replies = await processor.process({
      chatId,
      userId,
      username,
      text,
      dateTime: now,
      messageId: ctx.message.message_id,
    });

    for (const reply of replies) {
      await ctx.reply(
        reply.text,
        reply.replyToMessageId
          ? { reply_parameters: { message_id: reply.replyToMessageId } }
          : undefined
      );
    }
  } catch (error) {
    logger.error("Failed to analyze message", error);
  }
});

bot.catch((err) => {
  logger.error("Telegram error", err);
});

async function start() {
  await storage.load();
  await memory.load();
  await bot.launch();
  logger.info("Bot started");
}

start().catch((err) => {
  logger.error("Startup error", err);
  process.exit(1);
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
