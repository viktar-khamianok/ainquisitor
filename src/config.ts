import path from "node:path";
import type { LogLevel } from "./services/logger";

const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
const openaiApiKey = process.env.OPENAI_API_KEY;

if (!telegramBotToken) {
  throw new Error("TELEGRAM_BOT_TOKEN is required in .env");
}

if (!openaiApiKey) {
  throw new Error("OPENAI_API_KEY is required in .env");
}

function parseLogLevel(value: string | undefined): LogLevel {
  if (value === "debug" || value === "info" || value === "warn" || value === "error") {
    return value;
  }

  return "info";
}

export const config = {
  telegramBotToken,
  openaiApiKey,
  openaiModel: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
  storagePath: process.env.STORAGE_PATH ?? path.join(process.cwd(), "data", "sins_storage.json"),
  logLevel: parseLogLevel(process.env.LOG_LEVEL),
  maxSins: 10,
  contextMessages: 15,
  inMemoryHistoryLimit: 100,
};
