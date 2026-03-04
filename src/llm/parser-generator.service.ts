import { Injectable } from "@nestjs/common";
import { GeminiService } from "./gemini.service";
import { HttpFetcherService } from "../fetchers/http-fetcher.service";

export type AnalysisStep =
  | "html_fetch"
  | "llm_request"
  | "llm_parse"
  | "regex_gen"
  | "done"
  | "error";

export type AnalysisProgress = {
  step: AnalysisStep;
  message: string;
  data?: GeneratedParsers;
  error?: string;
};

export type SizeStockPattern = {
  size: string;
  pattern: string;
  flags: string;
};

export type GeneratedParsers = {
  pricePattern: string;
  priceFlags: string;
  stockPattern: string | null;
  stockFlags: string;
  sizeStockPatterns: SizeStockPattern[];
};

const USER_AGENT = "price-watch/0.1 (+local)";
const TIMEOUT_MS = 15000;
/** HTML을 Gemini에 보낼 때 잘라낼 최대 문자 수 (토큰 절약) */
const HTML_MAX_CHARS = 30000;

@Injectable()
export class ParserGeneratorService {
  constructor(
    private readonly gemini: GeminiService,
    private readonly fetcher: HttpFetcherService
  ) {}

  /**
   * URL의 HTML을 fetch하고 Gemini로 파서 정규식을 생성한다.
   * progress 콜백으로 단계별 진행 상태를 전달한다.
   */
  async generate(
    url: string,
    onProgress: (progress: AnalysisProgress) => void
  ): Promise<GeneratedParsers> {
    // 1단계: HTML 수집
    onProgress({ step: "html_fetch", message: "페이지 HTML 수집 중..." });
    let html: string;

    try {
      const result = await this.fetcher.fetchContent(url, {
        userAgent: USER_AGENT,
        timeoutMs: TIMEOUT_MS
      });
      html = result.body;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      onProgress({ step: "error", message: "페이지 수집 실패", error: message });
      throw new Error(`HTML fetch 실패: ${message}`);
    }

    // HTML 트리밍 (script/style 태그 제거 후 길이 제한)
    const trimmedHtml = trimHtml(html, HTML_MAX_CHARS);

    // 2단계: LLM 요청
    onProgress({ step: "llm_request", message: "LLM 분석 요청 중..." });

    const prompt = buildPrompt(url, trimmedHtml);
    let rawResponse: string;

    try {
      rawResponse = await this.gemini.generate(prompt);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      onProgress({ step: "error", message: "LLM 요청 실패", error: message });
      throw new Error(`Gemini 요청 실패: ${message}`);
    }

    // 3단계: 응답 파싱
    onProgress({ step: "llm_parse", message: "LLM 응답 확인 중..." });

    let parsers: GeneratedParsers;

    try {
      parsers = parseGeminiResponse(rawResponse);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      onProgress({ step: "error", message: "LLM 응답 파싱 실패", error: message });
      throw new Error(`응답 파싱 실패: ${message}`);
    }

    // 4단계: 정규식 생성 완료
    onProgress({ step: "regex_gen", message: "정규식 생성 완료, 저장 중..." });
    onProgress({ step: "done", message: "파서 생성 완료", data: parsers });

    return parsers;
  }
}

// ── 내부 헬퍼 ──────────────────────────────────────────────────────────────

function trimHtml(html: string, maxChars: number): string {
  // script/style 태그와 내용 제거
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");

  if (cleaned.length > maxChars) {
    cleaned = cleaned.slice(0, maxChars) + "\n<!-- ... (truncated) -->";
  }

  return cleaned;
}

function buildPrompt(url: string, html: string): string {
  return `You are a web scraping expert. Analyze the following HTML from "${url}" and extract regex patterns for price and stock information.

Return ONLY a valid JSON object with this exact structure (no markdown, no explanation):
{
  "pricePattern": "<regex to capture price, use capture group 1>",
  "priceFlags": "gi",
  "stockPattern": "<regex to detect out-of-stock state, or null if not detectable>",
  "stockFlags": "i",
  "sizeStockPatterns": [
    {
      "size": "<size label, e.g. S, M, L, XL, 270, 275>",
      "pattern": "<regex to detect if this size is in stock>",
      "flags": "i"
    }
  ]
}

Rules:
- pricePattern must have exactly one capture group containing the numeric price
- stockPattern: the regex should MATCH when the item is OUT OF STOCK (e.g. matches "품절", "sold out", "out of stock")
- sizeStockPatterns: list all detectable sizes; each pattern should MATCH when that size is IN STOCK
- If size information is not present in the HTML, return an empty array for sizeStockPatterns
- All patterns must be valid JavaScript regex syntax

HTML:
${html}`;
}

function parseGeminiResponse(raw: string): GeneratedParsers {
  // 마크다운 코드블록 제거
  const cleaned = raw
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  // JSON 객체 추출
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error("JSON 형식의 응답을 찾을 수 없음");
  }

  const parsed = JSON.parse(jsonMatch[0]) as Partial<GeneratedParsers>;

  if (!parsed.pricePattern || typeof parsed.pricePattern !== "string") {
    throw new Error("pricePattern 누락");
  }

  return {
    pricePattern: parsed.pricePattern,
    priceFlags: parsed.priceFlags ?? "gi",
    stockPattern: parsed.stockPattern ?? null,
    stockFlags: parsed.stockFlags ?? "i",
    sizeStockPatterns: Array.isArray(parsed.sizeStockPatterns)
      ? parsed.sizeStockPatterns
      : []
  };
}
