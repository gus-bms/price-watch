export type RegexParser = {
  type: "regex";
  pattern: string;
  flags?: string;
};

export type JsonPathParser = {
  type: "jsonPath";
  path: string;
};

export type ParserConfig = RegexParser | JsonPathParser;

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
  currency?: string;
  parser: ParserConfig;
  intervalMinutes: number;
};

export type WatchConfig = {
  global: GlobalConfig;
  items: WatchItem[];
};

export type ItemState = {
  failures?: number;
  lastError?: string;
  lastPrice?: number;
  lastCheckedAt?: number;
  lastNotifiedAt?: number;
  lastNotifiedPrice?: number;
};

export type RunnerState = {
  items: Record<string, ItemState>;
};

export type RunnerContext = {
  global: GlobalConfig;
  state: RunnerState;
  statePath: string;
};
