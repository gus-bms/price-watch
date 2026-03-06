import { Inject, Injectable } from "@nestjs/common";
import { type RowDataPacket } from "mysql2/promise";
import { DatabaseService } from "../database/database.service";
import {
  type GlobalConfig,
  type ParserConfig,
  type SizeStockParser,
  type WatchConfig,
  type WatchItem,
} from "../runner/types";

const DEFAULT_GLOBAL: GlobalConfig = {
  defaultIntervalMinutes: 5,
  timeoutMs: 15_000,
  userAgent: "price-watch/0.1 (+local)",
  maxBackoffMinutes: 60,
  minNotifyIntervalMinutes: 60,
};

@Injectable()
export class ConfigService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  async loadConfig(): Promise<WatchConfig> {
    const globalRows = await this.database.queryRows<GlobalRow[]>(
      `SELECT
        default_interval_minutes,
        timeout_ms,
        user_agent,
        max_backoff_minutes,
        min_notify_interval_minutes
       FROM watch_global_config
       WHERE id = 1
       LIMIT 1`,
    );

    const itemRows = await this.database.queryRows<ItemRow[]>(
      `SELECT
        id,
        name,
        url,
        target_price,
        currency,
        size,
        interval_minutes
       FROM watch_item
       WHERE enabled = 1
       ORDER BY created_at ASC, id ASC`,
    );

    if (itemRows.length === 0) {
      console.warn(
        "[Config] watch_item table has no enabled rows. Waiting for items to be added.",
      );
    }

    const watchIds = itemRows.map((row) => row.id);
    const parserRows = await this.loadParsers(watchIds);

    // parser_kind 별로 분류
    const priceParserByWatchId = new Map<string, ParserConfig>();
    const stockParserByWatchId = new Map<
      string,
      { pattern: string; flags: string }
    >();
    const sizeStockParsersByWatchId = new Map<string, SizeStockParser[]>();

    for (const row of parserRows) {
      if (
        row.parser_kind === "price" &&
        !priceParserByWatchId.has(row.watch_id)
      ) {
        priceParserByWatchId.set(row.watch_id, toParserConfig(row));
      } else if (
        row.parser_kind === "stock" &&
        !stockParserByWatchId.has(row.watch_id) &&
        row.pattern
      ) {
        stockParserByWatchId.set(row.watch_id, {
          pattern: row.pattern,
          flags: row.flags,
        });
      } else if (
        row.parser_kind === "size_stock" &&
        row.pattern &&
        row.target_size
      ) {
        const existing = sizeStockParsersByWatchId.get(row.watch_id) ?? [];
        existing.push({
          size: row.target_size,
          pattern: row.pattern,
          flags: row.flags,
        });
        sizeStockParsersByWatchId.set(row.watch_id, existing);
      } else if (
        row.parser_kind === "price" &&
        !priceParserByWatchId.has(row.watch_id)
      ) {
        // fallback: parser_kind 없는 기존 파서는 price로 취급
        priceParserByWatchId.set(row.watch_id, toParserConfig(row));
      }
    }

    const firstGlobalRow = globalRows[0];
    const global = firstGlobalRow
      ? toGlobalConfig(firstGlobalRow)
      : { ...DEFAULT_GLOBAL };
    assertGlobalConfig(global);

    const items: WatchItem[] = itemRows.map((row) => {
      const parser = priceParserByWatchId.get(row.id);

      if (!parser) {
        throw new Error(
          `watch_item '${row.id}' does not have an enabled price parser`,
        );
      }

      const targetPrice = Number(row.target_price);
      const intervalMinutes = Number(row.interval_minutes);

      if (!Number.isFinite(targetPrice)) {
        throw new Error(`watch_item '${row.id}' has invalid target_price`);
      }

      if (!Number.isFinite(intervalMinutes) || intervalMinutes <= 0) {
        throw new Error(`watch_item '${row.id}' has invalid interval_minutes`);
      }

      return {
        id: row.id,
        name: row.name,
        url: row.url,
        targetPrice,
        currency: row.currency ?? undefined,
        size: row.size ?? undefined,
        parser,
        stockParser: stockParserByWatchId.get(row.id),
        sizeStockParsers: sizeStockParsersByWatchId.get(row.id),
        intervalMinutes,
      };
    });

    return { global, items };
  }

  private async loadParsers(watchIds: string[]): Promise<ParserRow[]> {
    if (watchIds.length === 0) {
      return [];
    }

    const placeholders = watchIds.map(() => "?").join(", ");

    return this.database.queryRows<ParserRow[]>(
      `SELECT
        watch_id,
        parser_type,
        parser_kind,
        pattern,
        flags,
        json_path,
        target_size,
        position
       FROM watch_parser
       WHERE enabled = 1
         AND watch_id IN (${placeholders})
       ORDER BY watch_id ASC, position ASC`,
      watchIds,
    );
  }
}

type GlobalRow = RowDataPacket & {
  default_interval_minutes: number;
  timeout_ms: number;
  user_agent: string;
  max_backoff_minutes: number;
  min_notify_interval_minutes: number;
};

type ItemRow = RowDataPacket & {
  id: string;
  name: string;
  url: string;
  target_price: number | string;
  currency: string | null;
  size: string | null;
  interval_minutes: number;
};

type ParserRow = RowDataPacket & {
  watch_id: string;
  parser_type: "regex" | "jsonPath";
  parser_kind: "price" | "stock" | "size_stock";
  pattern: string | null;
  flags: string;
  json_path: string | null;
  target_size: string | null;
  position: number;
};

function toGlobalConfig(row: GlobalRow): GlobalConfig {
  return {
    defaultIntervalMinutes: Number(row.default_interval_minutes),
    timeoutMs: Number(row.timeout_ms),
    userAgent: row.user_agent,
    maxBackoffMinutes: Number(row.max_backoff_minutes),
    minNotifyIntervalMinutes: Number(row.min_notify_interval_minutes),
  };
}

function toParserConfig(row: ParserRow): ParserConfig {
  if (row.parser_type === "regex") {
    if (!row.pattern) {
      throw new Error(
        `watch_item '${row.watch_id}' has regex parser without pattern`,
      );
    }

    return {
      type: "regex",
      pattern: row.pattern,
      flags: row.flags || "",
    };
  }

  if (!row.json_path) {
    throw new Error(
      `watch_item '${row.watch_id}' has jsonPath parser without path`,
    );
  }

  return {
    type: "jsonPath",
    path: row.json_path,
  };
}

function toPositiveNumber(
  value: number,
  fieldName: string,
  fallback: number,
): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} must be > 0`);
  }

  return parsed;
}

function assertGlobalConfig(config: GlobalConfig): void {
  toPositiveNumber(
    config.defaultIntervalMinutes,
    "global.defaultIntervalMinutes",
    DEFAULT_GLOBAL.defaultIntervalMinutes,
  );
  toPositiveNumber(
    config.timeoutMs,
    "global.timeoutMs",
    DEFAULT_GLOBAL.timeoutMs,
  );
  toPositiveNumber(
    config.maxBackoffMinutes,
    "global.maxBackoffMinutes",
    DEFAULT_GLOBAL.maxBackoffMinutes,
  );
  toPositiveNumber(
    config.minNotifyIntervalMinutes,
    "global.minNotifyIntervalMinutes",
    DEFAULT_GLOBAL.minNotifyIntervalMinutes,
  );
  if (!config.userAgent.trim()) {
    throw new Error("global.userAgent is required");
  }
}
