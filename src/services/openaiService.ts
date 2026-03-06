import OpenAI from "openai";
import type { ChatMessage, SinDetection, SinEntry } from "../types";

export class OpenAiService {
  constructor(
    private readonly client: OpenAI,
    private readonly model: string
  ) {}

  async detectSin(context: ChatMessage[], currentText: string): Promise<SinDetection> {
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

    const response = await this.client.responses.create({
      model: this.model,
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

    return JSON.parse(response.output_text) as SinDetection;
  }

  async generatePunishment(
    sinName: string,
    manifestation: string,
    recentSins: SinEntry[]
  ): Promise<string> {
    const sinsText = recentSins.map((s, idx) => `${idx + 1}. ${s.sin}: ${s.manifestation}`).join("\n");

    const prompt = `
Сгенерируй короткую смешную "епитимью" в 1-2 предложениях на русском.
Это должна быть безобидная, неоскорбительная, безопасная шуточная задача.
Без угроз, насилия, унижений, опасных действий.

Последний грех: ${sinName}
Проявление: ${manifestation}
Недавние грехи:
${sinsText || "(нет данных)"}
`.trim();

    const response = await this.client.responses.create({
      model: this.model,
      input: prompt,
    });

    return response.output_text.trim();
  }
}
