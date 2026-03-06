export type JsonSchema = {
  type: "object";
  additionalProperties: boolean;
  properties: Record<string, { type: string }>;
  required: string[];
};

export interface LlmService {
  generateText(prompt: string): Promise<string>;
  generateJson<T>(prompt: string, schemaName: string, schema: JsonSchema): Promise<T>;
}
