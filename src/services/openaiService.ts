import OpenAI from "openai";
import type { JsonSchema, LlmService } from "./llmService";
import type { Logger } from "./logger";

export class OpenAiService implements LlmService {
  constructor(
    private readonly client: OpenAI,
    private readonly model: string,
    private readonly logger?: Logger
  ) {}

  async generateText(prompt: string): Promise<string> {
    this.logger?.debug("LLM text request started", { model: this.model, promptLength: prompt.length });
    const response = await this.client.responses.create({
      model: this.model,
      input: prompt,
    });
    this.logger?.debug("LLM text request completed", { model: this.model });

    return response.output_text.trim();
  }

  async generateJson<T>(prompt: string, schemaName: string, schema: JsonSchema): Promise<T> {
    this.logger?.debug("LLM JSON request started", {
      model: this.model,
      schemaName,
      promptLength: prompt.length,
    });
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
    this.logger?.debug("LLM JSON request completed", { model: this.model, schemaName });

    return JSON.parse(response.output_text) as T;
  }
}
