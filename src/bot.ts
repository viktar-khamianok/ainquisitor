import "dotenv/config";
import OpenAI from "openai";
import { Telegraf } from "telegraf";
import { config } from "./config";
import { ChatMemory } from "./services/chatMemory";
import { OpenAiService } from "./services/openaiService";
import { SinService } from "./services/sinService";
import { JsonStorage } from "./storage/jsonStorage";

const bot = new Telegraf(config.telegramBotToken);
const storage = new JsonStorage(config.storagePath);
const memory = new ChatMemory(config.inMemoryHistoryLimit, config.contextMessages);
const llmService = new OpenAiService(new OpenAI({ apiKey: config.openaiApiKey }), config.openaiModel);
const sinService = new SinService(llmService);

bot.on("text", async (ctx) => {
  const chatId = String(ctx.chat.id);
  const userId = String(ctx.from.id);
  const username =
    ctx.from.username ??
    [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(" ") ??
    `user_${userId}`;
  const text = ctx.message.text.trim();
  const now = new Date().toISOString();

  memory.pushMessage(chatId, {
    userId,
    username,
    text,
    date_time: now,
  });

  const context = memory.getContextFromOtherUsers(chatId, userId);

  try {
    const result = await sinService.detectSin(context, text);
    if (!result.is_sin) {
      return;
    }

    const sinName = result.sin_name.trim() || "Неопределенный грех";
    const manifestation = result.manifestation.trim() || text;
    const currentCount = storage.addSin(chatId, userId, {
      date_time: now,
      sin: sinName,
      manifestation,
    });

    await ctx.reply(`${sinName} ${Math.min(currentCount, config.maxSins)}/${config.maxSins}`, {
      reply_parameters: { message_id: ctx.message.message_id },
    });

    if (currentCount >= config.maxSins) {
      const recentSins = storage.getRecentSins(chatId, userId, config.maxSins);
      const punishment = await sinService.generatePunishment(sinName, manifestation, recentSins);
      await ctx.reply(`Епитимья: ${punishment}`);

      storage.addPunishment(chatId, userId, {
        date_time: new Date().toISOString(),
        reason: `Достигнут лимит ${config.maxSins} грехов`,
        punishment,
      });
    }
  } catch (error) {
    console.error("Failed to analyze message:", error);
  }
});

bot.catch((err) => {
  console.error("Telegram error:", err);
});

async function start() {
  await storage.load();
  await bot.launch();
  console.log("Bot started");
}

start().catch((err) => {
  console.error("Startup error:", err);
  process.exit(1);
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
