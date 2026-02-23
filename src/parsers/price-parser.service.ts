import { Injectable } from "@nestjs/common";
import { type ParserConfig } from "../runner/types";

@Injectable()
export class PriceParserService {
  parsePrice(body: string, parser: ParserConfig): number {
    if (parser.type === "regex") {
      const regex = new RegExp(parser.pattern, parser.flags ?? "");
      const match = regex.exec(body);
      if (!match || !match[1]) {
        throw new Error("regex parser did not match a price");
      }
      return toNumber(match[1]);
    }

    if (parser.type === "jsonPath") {
      const data: unknown = JSON.parse(body);
      const value = getByPath(data, parser.path);
      if (value === undefined || value === null) {
        throw new Error("jsonPath parser did not find a value");
      }
      return toNumber(value);
    }

    throw new Error(`unsupported parser type: ${String(parser)}`);
  }
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    throw new Error("price value must be a string or number");
  }

  const cleaned = value.replace(/[^0-9.-]/g, "");
  const numberValue = Number(cleaned);

  if (!Number.isFinite(numberValue)) {
    throw new Error(`unable to parse price from '${value}'`);
  }

  return numberValue;
}

function getByPath(data: unknown, pathValue: string): unknown {
  const parts = pathValue
    .split(".")
    .flatMap((part) => part.split(/\[(\d+)\]/).filter(Boolean));

  let current: unknown = data;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (Array.isArray(current) && isIndex(part)) {
      current = current[Number(part)];
      continue;
    }

    if (isRecord(current) && Object.hasOwn(current, part)) {
      current = current[part];
      continue;
    }

    return undefined;
  }

  return current;
}

function isIndex(value: string): boolean {
  return /^[0-9]+$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
