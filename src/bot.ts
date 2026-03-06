import "dotenv/config";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import OpenAI from "openai";
import { Telegraf } from "telegraf";

type SinEntry = {
  date_time: string;
  sin: string;
  manifestation: string;
};

type PunishmentEntry = {
  date_time: string;
  reason: string;
  punishment: string;
};

type UserRecord = {
  sins_count: number;
  sins: SinEntry[];
  punishments: PunishmentEntry[];
};

type ChatRecord = {
  users: Record<string, UserRecord>;
};

type StorageShape = {
  chats: Record<string, ChatRecord>;
};

type ChatMessage = {
  userId: string;
  username: string;
  text: string;
  date_time: string;
};

type SinDetection = {
  is_sin: boolean;
  sin_name: string;
  manifestation: string;
};

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
const STORAGE_PATH =
  process.env.STORAGE_PATH ?? path.join(process.cwd(), "data", "sins_storage.json");
const MAX_SINS = 10;
const CONTEXT_MESSAGES = 15;

if (!TELEGRAM_BOT_TOKEN) {
  throw new Error("TELEGRAM_BOT_TOKEN is required in .env");
}
if (!OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY is required in .env");
}

const bot = new Telegraf(TELEGRAM_BOT_TOKEN);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

class JsonStorage {
  private data: StorageShape = { chats: {} };
  private writeQueue: Promise<void> = Promise.resolve();

  async load() {
    const dir = path.dirname(STORAGE_PATH);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    if (!existsSync(STORAGE_PATH)) {
      await this.persist();
      return;
    }

    const raw = await readFile(STORAGE_PATH, "utf-8");
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
    await writeFile(STORAGE_PATH, JSON.stringify(this.data, null, 2), "utf-8");
  }
}

const storage = new JsonStorage();
const recentMessagesByChat = new Map<string, ChatMessage[]>();

function pushRecentMessage(chatId: string, message: ChatMessage) {
  const list = recentMessagesByChat.get(chatId) ?? [];
  list.push(message);
  if (list.length > 100) {
    list.shift();
  }
  recentMessagesByChat.set(chatId, list);
}

function getChatContext(chatId: string, excludeUserId: string): ChatMessage[] {
  const list = recentMessagesByChat.get(chatId) ?? [];
  return list.filter((msg) => msg.userId !== excludeUserId).slice(-CONTEXT_MESSAGES);
}

async function detectSin(context: ChatMessage[], currentText: string): Promise<SinDetection> {
  const contextText = context
    .map(
      (m, index) =>
        `${index + 1}. [${m.date_time}] ${m.username}(${m.userId}): ${m.text.replace(/\s+/g, " ").trim()}`
    )
    .join("\n");

  const prompt = `
Ты модератор чата. Твоя задача: определить, содержит ли последнее сообщение проявление "греха" в шуточно-игровом стиле.
Важно:
1) Будь консервативен: если сомневаешься, считай что греха нет.
2) Не придумывай факты, опирайся на текст.
3) Верни только JSON с полями is_sin, sin_name, manifestation.

Контекст последних сообщений чата (до 15):
${contextText || "(контекст отсутствует)"}

Последнее сообщение для проверки:
${currentText}
`.trim();

  const response = await openai.responses.create({
    model: OPENAI_MODEL,
    input: prompt,
    text: {
      format: {
        type: "json_schema",
        name: "sin_detection",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            is_sin: { type: "boolean" },
            sin_name: { type: "string" },
            manifestation: { type: "string" },
          },
          required: ["is_sin", "sin_name", "manifestation"],
        },
      },
    },
  });

  const raw = response.output_text;
  return JSON.parse(raw) as SinDetection;
}

async function generatePunishment(
  sinName: string,
  manifestation: string,
  recentSins: SinEntry[]
): Promise<string> {
  const sinsText = recentSins
    .map((s, idx) => `${idx + 1}. ${s.sin}: ${s.manifestation}`)
    .join("\n");

  const prompt = `
Сгенерируй короткую смешную "епитимью" в 1-2 предложениях на русском.
Это должна быть безобидная, неоскорбительная, безопасная шуточная задача.
Без угроз, насилия, унижений, опасных действий.

Последний грех: ${sinName}
Проявление: ${manifestation}
Недавние грехи:
${sinsText || "(нет данных)"}
`.trim();

  const response = await openai.responses.create({
    model: OPENAI_MODEL,
    input: prompt,
  });

  return response.output_text.trim();
}

bot.on("text", async (ctx) => {
  const chatId = String(ctx.chat.id);
  const userId = String(ctx.from.id);
  const username =
    ctx.from.username ??
    [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(" ") ??
    `user_${userId}`;
  const text = ctx.message.text.trim();
  const now = new Date().toISOString();

  pushRecentMessage(chatId, {
    userId,
    username,
    text,
    date_time: now,
  });

  const context = getChatContext(chatId, userId);

  try {
    const result = await detectSin(context, text);
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

    await ctx.reply(`${sinName} ${Math.min(currentCount, MAX_SINS)}/${MAX_SINS}`, {
      reply_parameters: { message_id: ctx.message.message_id },
    });

    if (currentCount >= MAX_SINS) {
      const recentSins = storage.getRecentSins(chatId, userId, MAX_SINS);
      const punishment = await generatePunishment(sinName, manifestation, recentSins);
      await ctx.reply(`Епитимья: ${punishment}`);

      storage.addPunishment(chatId, userId, {
        date_time: new Date().toISOString(),
        reason: `Достигнут лимит ${MAX_SINS} грехов`,
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
