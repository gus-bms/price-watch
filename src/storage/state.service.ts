import { Inject, Injectable } from "@nestjs/common";
import { type RowDataPacket } from "mysql2/promise";
import { DatabaseService } from "../database/database.service";
import {
  type CheckConfidence,
  type CheckTriggerSource,
  type ItemState,
  type RunnerState
} from "../runner/types";

type StateRow = RowDataPacket & {
  watch_id: string;
  failures: number;
  last_error: string | null;
  last_price: number | string | null;
  last_checked_at: Date | string | null;
  last_notified_at: Date | string | null;
  last_notified_price: number | string | null;
};

type CheckRunInput = {
  watchId: string;
  triggerSource: CheckTriggerSource;
  startedAt: number;
  finishedAt: number;
  success: boolean;
  parsedPrice?: number | undefined;
  confidence?: CheckConfidence | undefined;
  verifiedByRecheck?: boolean | undefined;
  errorMessage?: string | undefined;
  responseContentType?: string | undefined;
  httpStatus?: number | undefined;
};

type NotificationInput = {
  watchId: string;
  price: number;
  targetPriceSnapshot: number;
  currency?: string | undefined;
  channel?: "console" | undefined;
  status?: "sent" | "failed" | "skipped" | undefined;
  message?: string | undefined;
  errorMessage?: string | undefined;
};

@Injectable()
export class StateService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async loadState(itemIds: string[]): Promise<RunnerState> {
    if (itemIds.length === 0) {
      return { items: {} };
    }

    const placeholders = itemIds.map(() => "?").join(", ");
    const rows = await this.database.queryRows<StateRow[]>(
      `SELECT
        watch_id,
        failures,
        last_error,
        last_price,
        last_checked_at,
        last_notified_at,
        last_notified_price
       FROM watch_state
       WHERE watch_id IN (${placeholders})`,
      itemIds
    );

    const items: RunnerState["items"] = {};

    for (const row of rows) {
      items[row.watch_id] = {
        failures: Number(row.failures || 0),
        lastError: row.last_error ?? undefined,
        lastPrice: toNullableNumber(row.last_price),
        lastCheckedAt: toNullableMillis(row.last_checked_at),
        lastNotifiedAt: toNullableMillis(row.last_notified_at),
        lastNotifiedPrice: toNullableNumber(row.last_notified_price)
      };
    }

    return { items };
  }

  async saveItemState(watchId: string, state: ItemState): Promise<void> {
    await this.database.execute(
      `INSERT INTO watch_state (
        watch_id,
        failures,
        last_error,
        last_price,
        last_checked_at,
        last_notified_at,
        last_notified_price,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(3))
      ON DUPLICATE KEY UPDATE
        failures = VALUES(failures),
        last_error = VALUES(last_error),
        last_price = VALUES(last_price),
        last_checked_at = VALUES(last_checked_at),
        last_notified_at = VALUES(last_notified_at),
        last_notified_price = VALUES(last_notified_price),
        updated_at = NOW(3)`,
      [
        watchId,
        Number(state.failures ?? 0),
        state.lastError ?? null,
        state.lastPrice ?? null,
        toDate(state.lastCheckedAt),
        toDate(state.lastNotifiedAt),
        state.lastNotifiedPrice ?? null
      ]
    );
  }

  async recordCheckRun(input: CheckRunInput): Promise<void> {
    await this.database.execute(
      `INSERT INTO watch_check_run (
        watch_id,
        trigger_source,
        started_at,
        finished_at,
        parsed_price,
        confidence,
        verified_by_recheck,
        error_message,
        success,
        duration_ms,
        response_content_type,
        http_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.watchId,
        input.triggerSource,
        new Date(input.startedAt),
        new Date(input.finishedAt),
        input.parsedPrice ?? null,
        input.confidence ?? null,
        input.verifiedByRecheck ?? null,
        input.errorMessage ?? null,
        input.success,
        Math.max(0, input.finishedAt - input.startedAt),
        input.responseContentType ?? null,
        input.httpStatus ?? null
      ]
    );
  }

  async recordNotification(input: NotificationInput): Promise<void> {
    await this.database.execute(
      `INSERT INTO watch_notification (
        watch_id,
        price,
        target_price_snapshot,
        currency,
        channel,
        status,
        message,
        error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.watchId,
        input.price,
        input.targetPriceSnapshot,
        input.currency ?? null,
        input.channel ?? "console",
        input.status ?? "sent",
        input.message ?? null,
        input.errorMessage ?? null
      ]
    );
  }

  getItemState(state: RunnerState, id: string): ItemState {
    const current = state.items[id];
    if (current) {
      return current;
    }

    const next: ItemState = {};
    state.items[id] = next;
    return next;
  }
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

function toDate(timestamp: number | undefined): Date | null {
  if (timestamp === undefined) {
    return null;
  }

  return new Date(timestamp);
}
