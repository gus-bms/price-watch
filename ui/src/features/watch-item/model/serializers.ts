import { type CheckSuccess, type LlmApiKey, type MatchConfidence, type WatchItem } from "./types";

type WatchItemPayload = {
  id: string;
  name: string;
  url: string;
  targetPrice: number;
  currency: string;
  size?: string;
  parser: {
    type: "regex";
    patterns: string[];
  };
};

export function normalizeItems(value: unknown): WatchItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }

    const id = toOptionalString(item.id);
    const name = toOptionalString(item.name);
    const url = toOptionalString(item.url);
    const targetPrice = Number(item.targetPrice);

    if (!id || !name || !url || !Number.isFinite(targetPrice)) {
      return [];
    }

    const parser = item.parser;
    if (!isRecord(parser) || parser.type !== "regex" || !Array.isArray(parser.patterns)) {
      return [];
    }

    const patterns = parser.patterns
      .map((pattern) => (typeof pattern === "string" ? pattern.trim() : ""))
      .filter((pattern) => pattern.length > 0);

    let sizeStockJson: Record<string, boolean> | undefined;
    if (isRecord(item.sizeStockJson)) {
      sizeStockJson = item.sizeStockJson as Record<string, boolean>;
    }

    return [
      {
        id,
        name,
        url,
        targetPrice,
        currency: toOptionalString(item.currency) ?? "USD",
        size: toOptionalString(item.size),
        parser: { type: "regex", patterns },
        lastPrice: toOptionalNumber(item.lastPrice),
        lastCheckedAt: toOptionalNumber(item.lastCheckedAt),
        lastError: toOptionalString(item.lastError),
        lastMatchedPattern: toOptionalString(item.lastMatchedPattern),
        matchConfidence: toConfidence(item.matchConfidence),
        fallbackVerified:
          typeof item.fallbackVerified === "boolean"
            ? item.fallbackVerified
            : undefined,
        isOutOfStock:
          typeof item.isOutOfStock === "boolean" ? item.isOutOfStock : undefined,
        sizeStockJson
      }
    ];
  });
}

export function itemToPayload(item: WatchItem): WatchItemPayload {
  return {
    id: item.id,
    name: item.name,
    url: item.url,
    targetPrice: item.targetPrice,
    currency: item.currency,
    size: item.size,
    parser: {
      type: "regex",
      patterns: item.parser.patterns
    }
  };
}

export function normalizeLlmKeys(value: unknown): LlmApiKey[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((row) => {
    if (!isRecord(row)) return [];
    const id = Number(row.id);
    const label = toOptionalString(row.label);
    if (!Number.isInteger(id) || !label) return [];

    return [
      {
        id,
        provider: "gemini" as const,
        label,
        isEnabled: Boolean(row.isEnabled),
        lastUsedAt: toOptionalNumber(row.lastUsedAt),
        quotaErrorAt: toOptionalNumber(row.quotaErrorAt),
        createdAt: toOptionalNumber(row.createdAt) ?? Date.now()
      }
    ];
  });
}

export function parseCheckSuccess(value: unknown): CheckSuccess {
  if (!isRecord(value)) {
    throw new Error("Invalid check response");
  }

  const price = Number(value.price);
  const confidence = toConfidence(value.confidence);
  const verifiedByRecheck = Boolean(value.verifiedByRecheck);

  if (!Number.isFinite(price) || !confidence) {
    throw new Error("Invalid check response payload");
  }

  const matchedParser = value.matchedParser;
  const matchedPattern =
    isRecord(matchedParser) && typeof matchedParser.pattern === "string"
      ? matchedParser.pattern
      : undefined;

  return {
    price,
    matchedPattern,
    confidence,
    verifiedByRecheck
  };
}

export function extractErrorMessage(payload: unknown, fallback: string): string {
  if (isRecord(payload) && typeof payload.error === "string" && payload.error.trim()) {
    return payload.error;
  }

  return fallback;
}

export function parsePatternsFromText(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function dedupePatterns(patterns: string[]): string[] {
  return [...new Set(patterns)];
}

function toOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed;
}

function toOptionalNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return parsed;
}

function toConfidence(value: unknown): MatchConfidence | undefined {
  if (value === "high" || value === "medium" || value === "low") {
    return value;
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
