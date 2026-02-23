import { Injectable } from "@nestjs/common";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { type ItemState, type RunnerState } from "../runner/types";

@Injectable()
export class StateService {
  async loadState(statePath: string): Promise<RunnerState> {
    try {
      const raw = await readFile(statePath, "utf-8");
      return parseState(raw);
    } catch (error: unknown) {
      const code = isErrnoException(error) ? error.code : undefined;
      if (code === "ENOENT") {
        return { items: {} };
      }
      throw error;
    }
  }

  async saveState(statePath: string, state: RunnerState): Promise<void> {
    await mkdir(dirname(statePath), { recursive: true });
    await writeFile(statePath, JSON.stringify(state, null, 2), "utf-8");
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

function parseState(raw: string): RunnerState {
  const parsed: unknown = JSON.parse(raw);
  if (!isRecord(parsed)) {
    return { items: {} };
  }

  const items = parsed.items;
  if (!isRecord(items)) {
    return { items: {} };
  }

  const normalized: RunnerState["items"] = {};

  for (const [key, value] of Object.entries(items)) {
    if (!isRecord(value)) {
      continue;
    }

    const itemState: ItemState = {};

    if (typeof value.failures === "number" && Number.isFinite(value.failures)) {
      itemState.failures = value.failures;
    }

    if (typeof value.lastError === "string") {
      itemState.lastError = value.lastError;
    }

    if (typeof value.lastPrice === "number" && Number.isFinite(value.lastPrice)) {
      itemState.lastPrice = value.lastPrice;
    }

    if (
      typeof value.lastCheckedAt === "number" &&
      Number.isFinite(value.lastCheckedAt)
    ) {
      itemState.lastCheckedAt = value.lastCheckedAt;
    }

    if (
      typeof value.lastNotifiedAt === "number" &&
      Number.isFinite(value.lastNotifiedAt)
    ) {
      itemState.lastNotifiedAt = value.lastNotifiedAt;
    }

    if (
      typeof value.lastNotifiedPrice === "number" &&
      Number.isFinite(value.lastNotifiedPrice)
    ) {
      itemState.lastNotifiedPrice = value.lastNotifiedPrice;
    }

    normalized[key] = itemState;
  }

  return { items: normalized };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === "object" && error !== null && "code" in error;
}
