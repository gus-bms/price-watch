import { Injectable } from "@nestjs/common";
import { type RowDataPacket } from "mysql2/promise";
import { DatabaseService } from "../database/database.service";
import { type CheckConfidence } from "../runner/types";

export type WatchItemDto = {
  id: string;
  name: string;
  url: string;
  targetPrice: number;
  currency: string;
  parser: {
    type: "regex";
    patterns: string[];
  };
  lastPrice?: number | undefined;
  lastCheckedAt?: number | undefined;
  lastError?: string | undefined;
  lastMatchedPattern?: string | undefined;
  matchConfidence?: CheckConfidence | undefined;
  fallbackVerified?: boolean | undefined;
};

export type UpsertWatchItemInput = {
  id: string;
  name: string;
  url: string;
  targetPrice: number;
  currency: string;
  patterns: string[];
  intervalMinutes?: number;
};

export type ParserCandidate = {
  id: number;
  type: "regex" | "jsonPath";
  pattern?: string | undefined;
  flags?: string | undefined;
  path?: string | undefined;
  tier?: "primary" | "secondary" | "fallback" | undefined;
};

export type CheckableWatchItem = {
  id: string;
  name: string;
  url: string;
  currency?: string | undefined;
  targetPrice: number;
  parsers: ParserCandidate[];
};

export type CheckSuccessInput = {
  itemId: string;
  startedAt: number;
  finishedAt: number;
  price: number;
  confidence: CheckConfidence;
  verifiedByRecheck: boolean;
  matchedParserId?: number | undefined;
  errorMessage?: string | undefined;
  responseContentType?: string | undefined;
  triggerSource: "scheduled" | "manual" | "api_check";
};

export type CheckFailureInput = {
  itemId: string;
  startedAt: number;
  finishedAt: number;
  errorMessage: string;
  responseContentType?: string | undefined;
  triggerSource: "scheduled" | "manual" | "api_check";
};

type ItemRow = RowDataPacket & {
  id: string;
  name: string;
  url: string;
  target_price: number | string;
  currency: string | null;
  interval_minutes: number;
  last_price: number | string | null;
  last_checked_at: Date | string | null;
  last_error: string | null;
  matched_pattern: string | null;
  last_confidence: CheckConfidence | null;
  last_verified_by_recheck: number | boolean | null;
};

type ParserRow = RowDataPacket & {
  id: number;
  watch_id: string;
  parser_type: "regex" | "jsonPath";
  pattern: string | null;
  flags: string;
  json_path: string | null;
  tier: "primary" | "secondary" | "fallback" | null;
  position: number;
};

type CheckableItemRow = RowDataPacket & {
  id: string;
  name: string;
  url: string;
  target_price: number | string;
  currency: string | null;
};

type GlobalConfigRow = RowDataPacket & {
  default_interval_minutes: number;
  timeout_ms: number;
  user_agent: string;
};

@Injectable()
export class WatchItemsService {
  constructor(private readonly database: DatabaseService) {}

  async listItems(): Promise<WatchItemDto[]> {
    const itemRows = await this.database.queryRows<ItemRow[]>(
      `SELECT
        w.id,
        w.name,
        w.url,
        w.target_price,
        w.currency,
        w.interval_minutes,
        s.last_price,
        s.last_checked_at,
        s.last_error,
        p.pattern AS matched_pattern,
        s.last_confidence,
        s.last_verified_by_recheck
       FROM watch_item w
       LEFT JOIN watch_state s ON s.watch_id = w.id
       LEFT JOIN watch_parser p ON p.id = s.last_matched_parser_id
       WHERE w.enabled = 1
       ORDER BY w.created_at DESC, w.id DESC`
    );

    const parserMap = await this.loadParserMap(itemRows.map((row) => row.id));

    return itemRows.map((row) => ({
      id: row.id,
      name: row.name,
      url: row.url,
      targetPrice: Number(row.target_price),
      currency: row.currency ?? "USD",
      parser: {
        type: "regex",
        patterns: parserMap.get(row.id) ?? []
      },
      lastPrice: toNullableNumber(row.last_price),
      lastCheckedAt: toNullableMillis(row.last_checked_at),
      lastError: row.last_error ?? undefined,
      lastMatchedPattern: row.matched_pattern ?? undefined,
      matchConfidence: row.last_confidence ?? undefined,
      fallbackVerified:
        row.last_verified_by_recheck === null
          ? undefined
          : Boolean(row.last_verified_by_recheck)
    }));
  }

  async createItem(input: UpsertWatchItemInput): Promise<void> {
    const intervalMinutes =
      input.intervalMinutes ?? (await this.getDefaultIntervalMinutes());

    await this.database.withTransaction(async (connection) => {
      await connection.execute(
        `INSERT INTO watch_item (
          id,
          name,
          url,
          target_price,
          currency,
          interval_minutes,
          enabled
        ) VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [
          input.id,
          input.name,
          input.url,
          input.targetPrice,
          input.currency,
          intervalMinutes
        ]
      );

      await this.replaceParsers(connection, input.id, input.patterns);

      await connection.execute(
        `INSERT IGNORE INTO watch_state (watch_id, failures)
         VALUES (?, 0)`,
        [input.id]
      );
    });
  }

  async updateItem(id: string, input: Omit<UpsertWatchItemInput, "id">): Promise<boolean> {
    return this.database.withTransaction(async (connection) => {
      const result = await connection.execute(
        `UPDATE watch_item
         SET
           name = ?,
           url = ?,
           target_price = ?,
           currency = ?,
           updated_at = NOW(3)
         WHERE id = ?
           AND enabled = 1`,
        [input.name, input.url, input.targetPrice, input.currency, id]
      );

      if (result.affectedRows === 0) {
        return false;
      }

      await this.replaceParsers(connection, id, input.patterns);
      return true;
    });
  }

  async deleteItem(id: string): Promise<boolean> {
    const result = await this.database.execute(
      `DELETE FROM watch_item WHERE id = ?`,
      [id]
    );

    return result.affectedRows > 0;
  }

  async getCheckableItem(id: string): Promise<CheckableWatchItem | null> {
    const itemRows = await this.database.queryRows<CheckableItemRow[]>(
      `SELECT id, name, url, target_price, currency
       FROM watch_item
       WHERE id = ?
         AND enabled = 1
       LIMIT 1`,
      [id]
    );

    if (itemRows.length === 0) {
      return null;
    }

    const parserRows = await this.database.queryRows<ParserRow[]>(
      `SELECT
        id,
        watch_id,
        parser_type,
        pattern,
        flags,
        json_path,
        tier,
        position
       FROM watch_parser
       WHERE watch_id = ?
         AND enabled = 1
       ORDER BY position ASC`,
      [id]
    );

    if (parserRows.length === 0) {
      return null;
    }

    const row = itemRows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      name: row.name,
      url: row.url,
      currency: row.currency ?? undefined,
      targetPrice: Number(row.target_price),
      parsers: parserRows.map((parser) => ({
        id: Number(parser.id),
        type: parser.parser_type,
        pattern: parser.pattern ?? undefined,
        flags: parser.flags || undefined,
        path: parser.json_path ?? undefined,
        tier: parser.tier ?? undefined
      }))
    };
  }

  async getRuntimeConfig(): Promise<{
    timeoutMs: number;
    userAgent: string;
  }> {
    const rows = await this.database.queryRows<GlobalConfigRow[]>(
      `SELECT default_interval_minutes, timeout_ms, user_agent
       FROM watch_global_config
       WHERE id = 1
       LIMIT 1`
    );

    if (rows.length === 0) {
      return {
        timeoutMs: 15_000,
        userAgent: "price-watch/0.1 (+local)"
      };
    }

    const firstRow = rows[0];
    if (!firstRow) {
      return {
        timeoutMs: 15_000,
        userAgent: "price-watch/0.1 (+local)"
      };
    }

    return {
      timeoutMs: Number(firstRow.timeout_ms),
      userAgent: firstRow.user_agent
    };
  }

  async recordCheckSuccess(input: CheckSuccessInput): Promise<void> {
    await this.database.withTransaction(async (connection) => {
      await connection.execute(
        `INSERT INTO watch_state (
          watch_id,
          failures,
          last_error,
          last_price,
          last_checked_at,
          last_matched_parser_id,
          last_confidence,
          last_verified_by_recheck,
          updated_at
        ) VALUES (?, 0, NULL, ?, ?, ?, ?, ?, NOW(3))
        ON DUPLICATE KEY UPDATE
          failures = 0,
          last_error = NULL,
          last_price = VALUES(last_price),
          last_checked_at = VALUES(last_checked_at),
          last_matched_parser_id = VALUES(last_matched_parser_id),
          last_confidence = VALUES(last_confidence),
          last_verified_by_recheck = VALUES(last_verified_by_recheck),
          updated_at = NOW(3)`,
        [
          input.itemId,
          input.price,
          new Date(input.finishedAt),
          input.matchedParserId ?? null,
          input.confidence,
          input.verifiedByRecheck
        ]
      );

      await connection.execute(
        `INSERT INTO watch_check_run (
          watch_id,
          trigger_source,
          started_at,
          finished_at,
          matched_parser_id,
          parsed_price,
          confidence,
          verified_by_recheck,
          error_message,
          response_content_type,
          success,
          duration_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        [
          input.itemId,
          input.triggerSource,
          new Date(input.startedAt),
          new Date(input.finishedAt),
          input.matchedParserId ?? null,
          input.price,
          input.confidence,
          input.verifiedByRecheck,
          input.errorMessage ?? null,
          input.responseContentType ?? null,
          Math.max(0, input.finishedAt - input.startedAt)
        ]
      );
    });
  }

  async recordCheckFailure(input: CheckFailureInput): Promise<void> {
    await this.database.withTransaction(async (connection) => {
      await connection.execute(
        `INSERT INTO watch_state (
          watch_id,
          failures,
          last_error,
          last_checked_at,
          updated_at
        ) VALUES (?, 1, ?, ?, NOW(3))
        ON DUPLICATE KEY UPDATE
          failures = failures + 1,
          last_error = VALUES(last_error),
          last_checked_at = VALUES(last_checked_at),
          updated_at = NOW(3)`,
        [input.itemId, input.errorMessage, new Date(input.finishedAt)]
      );

      await connection.execute(
        `INSERT INTO watch_check_run (
          watch_id,
          trigger_source,
          started_at,
          finished_at,
          error_message,
          response_content_type,
          success,
          duration_ms
        ) VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
        [
          input.itemId,
          input.triggerSource,
          new Date(input.startedAt),
          new Date(input.finishedAt),
          input.errorMessage,
          input.responseContentType ?? null,
          Math.max(0, input.finishedAt - input.startedAt)
        ]
      );
    });
  }

  private async loadParserMap(watchIds: string[]): Promise<Map<string, string[]>> {
    const parserMap = new Map<string, string[]>();

    if (watchIds.length === 0) {
      return parserMap;
    }

    const placeholders = watchIds.map(() => "?").join(", ");
    const parserRows = await this.database.queryRows<ParserRow[]>(
      `SELECT
        id,
        watch_id,
        parser_type,
        pattern,
        flags,
        json_path,
        tier,
        position
       FROM watch_parser
       WHERE enabled = 1
         AND parser_type = 'regex'
         AND watch_id IN (${placeholders})
       ORDER BY watch_id ASC, position ASC`,
      watchIds
    );

    for (const row of parserRows) {
      if (!row.pattern) {
        continue;
      }

      const current = parserMap.get(row.watch_id) ?? [];
      current.push(row.pattern);
      parserMap.set(row.watch_id, current);
    }

    return parserMap;
  }

  private async replaceParsers(
    connection: {
      execute(sql: string, params?: (string | number | boolean | Date | null)[]): Promise<{ affectedRows: number }>;
    },
    watchId: string,
    patterns: string[]
  ): Promise<void> {
    await connection.execute(`DELETE FROM watch_parser WHERE watch_id = ?`, [watchId]);

    for (const [index, pattern] of patterns.entries()) {
      await connection.execute(
        `INSERT INTO watch_parser (
          watch_id,
          position,
          tier,
          parser_type,
          pattern,
          flags,
          json_path,
          enabled
        ) VALUES (?, ?, ?, 'regex', ?, '', NULL, 1)`,
        [watchId, index, resolveTier(index), pattern]
      );
    }
  }

  private async getDefaultIntervalMinutes(): Promise<number> {
    const rows = await this.database.queryRows<GlobalConfigRow[]>(
      `SELECT default_interval_minutes, timeout_ms, user_agent
       FROM watch_global_config
       WHERE id = 1
       LIMIT 1`
    );

    if (rows.length === 0) {
      return 5;
    }

    const firstRow = rows[0];
    if (!firstRow) {
      return 5;
    }

    return Math.max(1, Number(firstRow.default_interval_minutes));
  }
}

function resolveTier(index: number): "primary" | "secondary" | "fallback" {
  if (index === 0) {
    return "primary";
  }

  if (index === 1) {
    return "secondary";
  }

  return "fallback";
}

function toNullableNumber(value: number | string | null): number | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return parsed;
}

function toNullableMillis(value: Date | string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const timestamp =
    value instanceof Date ? value.getTime() : new Date(value).getTime();

  if (!Number.isFinite(timestamp)) {
    return undefined;
  }

  return timestamp;
}
