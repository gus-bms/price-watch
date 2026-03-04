import { Injectable } from "@nestjs/common";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { LlmKeyService } from "./llm-key.service";

@Injectable()
export class GeminiService {
  constructor(private readonly llmKeyService: LlmKeyService) {}

  /**
   * Gemini에 프롬프트를 전송하고 텍스트 응답을 반환.
   * quota 초과 시 키를 비활성화하고 다음 키로 재시도 (최대 3회).
   */
  async generate(prompt: string, maxRetries = 3): Promise<string> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const keyEntry = await this.llmKeyService.acquireKey("gemini");

      if (!keyEntry) {
        throw new Error("사용 가능한 Gemini API 키가 없습니다. 설정에서 키를 추가해주세요.");
      }

      try {
        const genAI = new GoogleGenerativeAI(keyEntry.apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(prompt);
        return result.response.text();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        const isQuotaError =
          message.includes("RESOURCE_EXHAUSTED") ||
          message.includes("quota") ||
          message.includes("429");

        if (isQuotaError) {
          await this.llmKeyService.markQuotaError(keyEntry.id);
          continue;
        }

        throw err;
      }
    }

    throw new Error("모든 Gemini API 키의 quota가 소진되었습니다.");
  }
}
