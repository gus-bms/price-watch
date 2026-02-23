import { Injectable } from "@nestjs/common";
import { readFile } from "node:fs/promises";
import {
  type GlobalConfig,
  type JsonPathParser,
  type ParserConfig,
  type RegexParser,
  type WatchConfig,
  type WatchItem
} from "../runner/types";

const DEFAULT_GLOBAL: GlobalConfig = {
  defaultIntervalMinutes: 5,
  timeoutMs: 15_000,
  userAgent: "price-watch/0.1 (+local)",
  maxBackoffMinutes: 60,
  minNotifyIntervalMinutes: 60
};

@Injectable()
export class ConfigService {
  async loadConfig(configPath: string): Promise<WatchConfig> {
    const raw = await readFile(configPath, "utf-8");
    const parsed = this.parseConfigRoot(raw);
    const global = this.normalizeGlobal(parsed.global);
    const items = this.normalizeItems(parsed.items, global);
    return { global, items };
  }

  private parseConfigRoot(raw: string): {
    global?: unknown;
    items?: unknown;
  } {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      throw new Error("config root must be an object");
    }

    return {
      global: parsed.global,
      items: parsed.items
    };
  }

  private normalizeGlobal(input: unknown): GlobalConfig {
    if (input === undefined) {
      return { ...DEFAULT_GLOBAL };
    }

    if (!isRecord(input)) {
      throw new Error("config.global must be an object");
    }

    const defaultIntervalMinutes = toPositiveNumber(
      input.defaultIntervalMinutes,
      "global.defaultIntervalMinutes",
      DEFAULT_GLOBAL.defaultIntervalMinutes
    );

    const timeoutMs = toPositiveNumber(
      input.timeoutMs,
      "global.timeoutMs",
      DEFAULT_GLOBAL.timeoutMs
    );

    const userAgent =
      input.userAgent === undefined
        ? DEFAULT_GLOBAL.userAgent
        : toNonEmptyString(input.userAgent, "global.userAgent");

    const maxBackoffMinutes = toPositiveNumber(
      input.maxBackoffMinutes,
      "global.maxBackoffMinutes",
      DEFAULT_GLOBAL.maxBackoffMinutes
    );

    const minNotifyIntervalMinutes = toPositiveNumber(
      input.minNotifyIntervalMinutes,
      "global.minNotifyIntervalMinutes",
      DEFAULT_GLOBAL.minNotifyIntervalMinutes
    );

    return {
      defaultIntervalMinutes,
      timeoutMs,
      userAgent,
      maxBackoffMinutes,
      minNotifyIntervalMinutes
    };
  }

  private normalizeItems(
    items: unknown,
    global: GlobalConfig
  ): WatchItem[] {
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("config.items must be a non-empty array");
    }

    const seen = new Set<string>();

    return items.map((item, index) => {
      if (!isRecord(item)) {
        throw new Error(`items[${index}] must be an object`);
      }

      const id = toNonEmptyString(item.id, `items[${index}].id`);
      if (seen.has(id)) {
        throw new Error(
          `items[${index}].id must be unique (duplicate: ${id})`
        );
      }
      seen.add(id);

      const url = toNonEmptyString(item.url, `items[${index}].url`);
      if (!/^https?:\/\//i.test(url)) {
        throw new Error(`items[${index}].url must be a valid http(s) URL`);
      }

      const targetPrice = toFiniteNumber(
        item.targetPrice,
        `items[${index}].targetPrice`
      );

      const parser = this.normalizeParser(item.parser, index);

      const intervalMinutes = toPositiveNumber(
        item.intervalMinutes,
        `items[${index}].intervalMinutes`,
        global.defaultIntervalMinutes
      );

      const name =
        item.name === undefined
          ? id
          : toNonEmptyString(item.name, `items[${index}].name`);

      const currency =
        item.currency === undefined
          ? undefined
          : toNonEmptyString(item.currency, `items[${index}].currency`);

      return {
        id,
        name,
        url,
        targetPrice,
        currency,
        parser,
        intervalMinutes
      };
    });
  }

  private normalizeParser(parser: unknown, index: number): ParserConfig {
    if (!isRecord(parser)) {
      throw new Error(`items[${index}].parser is required`);
    }

    const parserType = toNonEmptyString(parser.type, `items[${index}].parser.type`);

    if (parserType === "regex") {
      const pattern = toNonEmptyString(
        parser.pattern,
        `items[${index}].parser.pattern`
      );
      const flags =
        parser.flags === undefined
          ? ""
          : toStringValue(parser.flags, `items[${index}].parser.flags`);

      const regexParser: RegexParser = {
        type: "regex",
        pattern,
        flags
      };

      return regexParser;
    }

    if (parserType === "jsonPath") {
      const path = toNonEmptyString(parser.path, `items[${index}].parser.path`);

      const jsonPathParser: JsonPathParser = {
        type: "jsonPath",
        path
      };

      return jsonPathParser;
    }

    throw new Error(
      `items[${index}].parser.type must be 'regex' or 'jsonPath'`
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toStringValue(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string`);
  }
  return value;
}

function toNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} is required`);
  }
  return value.trim();
}

function toFiniteNumber(value: unknown, fieldName: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${fieldName} must be a number`);
  }
  return parsed;
}

function toPositiveNumber(
  value: unknown,
  fieldName: string,
  fallback: number
): number {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} must be > 0`);
  }

  return parsed;
}
