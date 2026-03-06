import OpenAI from "openai";
import type { JsonSchema, LlmService } from "./llmService";

export class OpenAiService implements LlmService {
  constructor(
    private readonly client: OpenAI,
    private readonly model: string
  ) {}

  async generateText(prompt: string): Promise<string> {
    const response = await this.client.responses.create({
      model: this.model,
      input: prompt,
    });

    return response.output_text.trim();
  }

  async generateJson<T>(prompt: string, schemaName: string, schema: JsonSchema): Promise<T> {
    const response = await this.client.responses.create({
      model: this.model,
      input: prompt,
      text: {
        format: {
          type: "json_schema",
          name: schemaName,
          schema,
        },
      },
    });

    return JSON.parse(response.output_text) as T;
  }
}
