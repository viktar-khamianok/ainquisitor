import type { ChatMessage, SinDetection, SinEntry } from "../types";
import type { LlmService } from "./llmService";

const SIN_DETECTION_SCHEMA = {
  type: "object" as const,
  additionalProperties: false,
  properties: {
    is_sin: { type: "boolean" },
    sin_name: { type: "string" },
    manifestation: { type: "string" },
  },
  required: ["is_sin", "sin_name", "manifestation"],
};

export class SinService {
  constructor(private readonly llmService: LlmService) {}

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

    return this.llmService.generateJson<SinDetection>(prompt, "sin_detection", SIN_DETECTION_SCHEMA);
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

    return this.llmService.generateText(prompt);
  }
}
