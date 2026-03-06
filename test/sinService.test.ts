import { describe, expect, it, vi } from "vitest";
import { SinService } from "../src/services/sinService";
import type { JsonSchema, LlmService } from "../src/services/llmService";
import type { SinDetection } from "../src/types";

class LlmMock implements LlmService {
  generateText = vi.fn(async () => "Mocked punishment");

  generateJson = vi.fn(
    async <T>(_prompt: string, _schemaName: string, _schema: JsonSchema): Promise<T> => {
      const result: SinDetection = {
        is_sin: true,
        sin_name: "Гнев",
        manifestation: "резкий тон",
      };
      return result as T;
    }
  );
}

describe("SinService", () => {
  it("detectSin delegates to llm JSON generation with schema name", async () => {
    const llm = new LlmMock();
    const service = new SinService(llm);

    const result = await service.detectSin(
      [
        {
          userId: "u2",
          username: "user2",
          text: "контекст",
          date_time: "2026-03-06T10:10:00.000Z",
        },
      ],
      "текущее сообщение"
    );

    expect(result.is_sin).toBe(true);
    expect(result.sin_name).toBe("Гнев");
    expect(llm.generateJson).toHaveBeenCalledTimes(1);
    expect(llm.generateJson.mock.calls[0][1]).toBe("sin_detection");
  });

  it("generatePunishment delegates to llm text generation", async () => {
    const llm = new LlmMock();
    const service = new SinService(llm);

    const punishment = await service.generatePunishment("Лень", "откладывал дело", [
      {
        date_time: "2026-03-06T10:11:00.000Z",
        sin: "Лень",
        manifestation: "откладывал дело",
      },
    ]);

    expect(punishment).toBe("Mocked punishment");
    expect(llm.generateText).toHaveBeenCalledTimes(1);
  });
});
