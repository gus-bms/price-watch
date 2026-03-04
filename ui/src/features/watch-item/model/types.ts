export type MatchConfidence = "high" | "medium" | "low";

export type RegexParser = {
  type: "regex";
  patterns: string[];
};

export type WatchItem = {
  id: string;
  name: string;
  url: string;
  targetPrice: number;
  currency: string;
  size?: string;
  parser: RegexParser;
  lastPrice?: number;
  lastCheckedAt?: number;
  lastError?: string;
  lastMatchedPattern?: string;
  matchConfidence?: MatchConfidence;
  fallbackVerified?: boolean;
  isOutOfStock?: boolean;
  sizeStockJson?: Record<string, boolean>;
};

export type ParserPreset = {
  id: string;
  label: string;
  description: string;
  currency: string;
  patterns: string[];
};

export type CheckSuccess = {
  price: number;
  matchedPattern?: string;
  confidence: MatchConfidence;
  verifiedByRecheck: boolean;
};

export type LlmApiKey = {
  id: number;
  provider: "gemini";
  label: string;
  isEnabled: boolean;
  lastUsedAt?: number;
  quotaErrorAt?: number;
  createdAt: number;
};

export type LlmAnalysisStep =
  | "html_fetch"
  | "llm_request"
  | "llm_parse"
  | "regex_gen"
  | "done"
  | "error";

export type LlmAnalysisProgress = {
  step: LlmAnalysisStep;
  message: string;
  data?: GeneratedParsers;
  error?: string;
};

export type GeneratedParsers = {
  pricePattern: string;
  priceFlags: string;
  stockPattern: string | null;
  stockFlags: string;
  sizeStockPatterns: Array<{ size: string; pattern: string; flags: string }>;
};
