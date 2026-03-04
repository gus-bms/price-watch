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

export type SizeStockParser = {
  size: string;
  pattern: string;
  flags: string;
};

export type WatchItem = {
  id: string;
  name: string;
  url: string;
  targetPrice: number;
  currency?: string | undefined;
  /** 감시할 사이즈 (optional). 설정 시 해당 사이즈의 재입고를 추적. */
  size?: string | undefined;
  parser: ParserConfig;
  /** 품절 여부 감지 정규식 (매칭 시 품절) */
  stockParser?: { pattern: string; flags: string } | undefined;
  /** 사이즈별 재고 파서 목록 */
  sizeStockParsers?: SizeStockParser[] | undefined;
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
  isOutOfStock?: boolean | undefined;
  sizeStockJson?: Record<string, boolean> | undefined;
};

export type RunnerState = {
  items: Record<string, ItemState>;
};

export type RunnerContext = {
  global: GlobalConfig;
  state: RunnerState;
};
