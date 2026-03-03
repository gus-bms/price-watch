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
  parser: RegexParser;
  stockPatterns: string[];
  lastPrice?: number;
  lastCheckedAt?: number;
  lastError?: string;
  lastMatchedPattern?: string;
  matchConfidence?: MatchConfidence;
  fallbackVerified?: boolean;
  lastInStock?: boolean;
};

export type ParserPreset = {
  id: string;
  label: string;
  description: string;
  currency: string;
  patterns: string[];
};

export type CheckSuccess =
  | { soldOut: true; inStock: false }
  | {
      soldOut: false;
      inStock: true | null;
      price: number;
      matchedPattern?: string;
      confidence: MatchConfidence;
      verifiedByRecheck: boolean;
    };
