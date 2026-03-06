import path from "node:path";

const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
const openaiApiKey = process.env.OPENAI_API_KEY;

if (!telegramBotToken) {
  throw new Error("TELEGRAM_BOT_TOKEN is required in .env");
}

if (!openaiApiKey) {
  throw new Error("OPENAI_API_KEY is required in .env");
}

export const config = {
  telegramBotToken,
  openaiApiKey,
  openaiModel: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
  storagePath: process.env.STORAGE_PATH ?? path.join(process.cwd(), "data", "sins_storage.json"),
  maxSins: 10,
  contextMessages: 15,
  inMemoryHistoryLimit: 100,
};
