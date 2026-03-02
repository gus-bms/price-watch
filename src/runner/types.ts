export type RegexParser = {
  type: "regex";
  pattern: string;
  flags?: string | undefined;
};

export type JsonPathParser = {
  type: "jsonPath";
  path: string;
};

export type ParserConfig = RegexParser | JsonPathParser;

export type CheckConfidence = "high" | "medium" | "low";

export type CheckTriggerSource = "scheduled" | "manual" | "api_check";

export type GlobalConfig = {
  defaultIntervalMinutes: number;
  timeoutMs: number;
  userAgent: string;
  maxBackoffMinutes: number;
  minNotifyIntervalMinutes: number;
};

export type WatchItem = {
  id: string;
  name: string;
  url: string;
  targetPrice: number;
  currency?: string | undefined;
  parser: ParserConfig;
  intervalMinutes: number;
};

export type WatchConfig = {
  global: GlobalConfig;
  items: WatchItem[];
};

export type ItemState = {
  failures?: number | undefined;
  lastError?: string | undefined;
  lastPrice?: number | undefined;
  lastCheckedAt?: number | undefined;
  lastNotifiedAt?: number | undefined;
  lastNotifiedPrice?: number | undefined;
};

export type RunnerState = {
  items: Record<string, ItemState>;
};

export type RunnerContext = {
  global: GlobalConfig;
  state: RunnerState;
};
