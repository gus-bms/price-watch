import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { URL } from "node:url";
import { DatabaseService } from "../database/database.service";
import { HttpFetcherService } from "../fetchers/http-fetcher.service";
import { GeminiService } from "../llm/gemini.service";
import { LlmKeyService } from "../llm/llm-key.service";
import { ParserGeneratorService } from "../llm/parser-generator.service";
import { PriceParserService } from "../parsers/price-parser.service";
import { type ParserConfig } from "../runner/types";
import { WatchItemsService } from "./watch-items.service";

type JsonValue =
  | undefined
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export async function startApiServer(): Promise<{ close: () => Promise<void> }> {
  const database = new DatabaseService();
  const itemsService = new WatchItemsService(database);
  const fetcher = new HttpFetcherService();
  const parser = new PriceParserService();
  const llmKeyService = new LlmKeyService(database);
  const geminiService = new GeminiService(llmKeyService);
  const parserGenerator = new ParserGeneratorService(geminiService, fetcher);

  const port = toPort(process.env.APP_PORT, 4000);
  const host = process.env.APP_HOST ?? "0.0.0.0";

  const server = createServer(async (request, response) => {
    setCorsHeaders(response);

    if (request.method === "OPTIONS") {
      response.writeHead(204).end();
      return;
    }

    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

    try {
      if (request.method === "GET" && url.pathname === "/api/health") {
        sendJson(response, 200, { ok: true });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/items") {
        const items = await itemsService.listItems();
        sendJson(response, 200, items);
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/items") {
        const payload = await readJsonBody(request);
        const normalized = normalizeItemPayload(payload, false);
        const id = normalizeOptionalString(payload.id) ?? randomUUID();

        await itemsService.createItem({
          id,
          name: normalized.name,
          url: normalized.url,
          targetPrice: normalized.targetPrice,
          currency: normalized.currency,
          size: normalized.size,
          patterns: normalized.patterns
        });

        sendJson(response, 201, { id });
        return;
      }

      if (request.method === "PUT" && url.pathname.startsWith("/api/items/")) {
        const id = decodeURIComponent(url.pathname.replace("/api/items/", ""));
        if (!id) {
          sendJson(response, 400, { error: "Item id is required" });
          return;
        }

        const payload = await readJsonBody(request);
        const normalized = normalizeItemPayload(payload, true);

        const updated = await itemsService.updateItem(id, {
          name: normalized.name,
          url: normalized.url,
          targetPrice: normalized.targetPrice,
          currency: normalized.currency,
          size: normalized.size,
          patterns: normalized.patterns
        });

        if (!updated) {
          sendJson(response, 404, { error: "Item not found" });
          return;
        }

        sendJson(response, 200, { ok: true });
        return;
      }

      if (request.method === "DELETE" && url.pathname.startsWith("/api/items/")) {
        const id = decodeURIComponent(url.pathname.replace("/api/items/", ""));
        if (!id) {
          sendJson(response, 400, { error: "Item id is required" });
          return;
        }

        const deleted = await itemsService.deleteItem(id);
        if (!deleted) {
          sendJson(response, 404, { error: "Item not found" });
          return;
        }

        response.writeHead(204).end();
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/check") {
        const payload = await readJsonBody(request);
        const itemId = normalizeOptionalString(payload.itemId);

        if (!itemId) {
          sendJson(response, 400, { error: "itemId is required" });
          return;
        }

        const item = await itemsService.getCheckableItem(itemId);
        if (!item) {
          sendJson(response, 404, { error: "Item not found" });
          return;
        }

        const runtimeConfig = await itemsService.getRuntimeConfig();
        const startedAt = Date.now();
        const parserErrors: string[] = [];
        let contentType: string | undefined;

        try {
          const fetched = await fetcher.fetchContent(item.url, {
            userAgent: runtimeConfig.userAgent,
            timeoutMs: runtimeConfig.timeoutMs
          });
          const body = fetched.body;
          contentType = fetched.contentType;

          for (const [index, parserCandidate] of item.parsers.entries()) {
            try {
              const parsedPrice = parser.parsePrice(
                body,
                toParserConfig(item.id, parserCandidate)
              );

              if (!isReasonablePrice(parsedPrice, item.currency)) {
                throw new Error("matched value failed sanity check");
              }

              const confidence = resolveConfidence(parserCandidate.tier, index);
              let verifiedByRecheck = false;

              if (confidence === "low") {
                const recheckFetched = await fetcher.fetchContent(item.url, {
                  userAgent: runtimeConfig.userAgent,
                  timeoutMs: runtimeConfig.timeoutMs
                });

                const recheckPrice = parser.parsePrice(
                  recheckFetched.body,
                  toParserConfig(item.id, parserCandidate)
                );

                if (!isReasonablePrice(recheckPrice, item.currency)) {
                  throw new Error("recheck value failed sanity check");
                }

                if (!isStableMatch(parsedPrice, recheckPrice, item.currency)) {
                  throw new Error("fallback match was not stable on recheck");
                }

                verifiedByRecheck = true;
              }

              const finishedAt = Date.now();

              await itemsService.recordCheckSuccess({
                itemId: item.id,
                startedAt,
                finishedAt,
                price: parsedPrice,
                confidence,
                verifiedByRecheck,
                matchedParserId: parserCandidate.id,
                responseContentType: contentType,
                triggerSource: "api_check"
              });

              sendJson(response, 200, {
                price: parsedPrice,
                matchedParser: {
                  type: parserCandidate.type,
                  pattern: parserCandidate.pattern,
                  flags: parserCandidate.flags,
                  path: parserCandidate.path,
                  tier: parserCandidate.tier
                },
                confidence,
                verifiedByRecheck
              });
              return;
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              parserErrors.push(message);
            }
          }

          throw new Error(parserErrors[parserErrors.length - 1] ?? "no parser candidates");
        } catch (error) {
          const finishedAt = Date.now();
          const message = error instanceof Error ? error.message : String(error);

          await itemsService.recordCheckFailure({
            itemId: item.id,
            startedAt,
            finishedAt,
            errorMessage: message,
            responseContentType: contentType,
            triggerSource: "api_check"
          });

          sendJson(response, 500, { error: message });
          return;
        }
      }

      // ── LLM 파서 분석 (SSE 스트림) ─────────────────────────────────────────
      if (request.method === "GET" && url.pathname === "/api/items/analyze-stream") {
        const targetUrl = url.searchParams.get("url");
        if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
          sendJson(response, 400, { error: "url query param is required (https://...)" });
          return;
        }

        // SSE 헤더
        response.writeHead(200, {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          "Access-Control-Allow-Origin": "*"
        });

        const sendEvent = (data: Record<string, unknown>): void => {
          response.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        try {
          await parserGenerator.generate(targetUrl, (progress) => {
            sendEvent(progress);
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          sendEvent({ step: "error", message, error: message });
        } finally {
          response.end();
        }

        return;
      }

      // ── LLM 파서 저장 (아이템에 LLM 생성 파서 적용) ──────────────────────
      if (request.method === "POST" && url.pathname.startsWith("/api/items/") && url.pathname.endsWith("/parsers/llm")) {
        const id = decodeURIComponent(
          url.pathname.replace("/api/items/", "").replace("/parsers/llm", "")
        );
        if (!id) {
          sendJson(response, 400, { error: "Item id is required" });
          return;
        }

        const payload = await readJsonBody(request);
        const pricePattern = requireString(payload.pricePattern, "pricePattern");
        const priceFlags = typeof payload.priceFlags === "string" ? payload.priceFlags : "gi";
        const stockPattern = typeof payload.stockPattern === "string" ? payload.stockPattern : null;
        const stockFlags = typeof payload.stockFlags === "string" ? payload.stockFlags : "i";
        const sizeStockPatterns = Array.isArray(payload.sizeStockPatterns)
          ? (payload.sizeStockPatterns as Array<{ size: string; pattern: string; flags: string }>)
          : [];

        await itemsService.saveLlmParsers({
          watchId: id,
          pricePattern,
          priceFlags,
          stockPattern,
          stockFlags,
          sizeStockPatterns
        });

        sendJson(response, 200, { ok: true });
        return;
      }

      // ── LLM API 키 관리 ─────────────────────────────────────────────────────
      if (request.method === "GET" && url.pathname === "/api/llm-keys") {
        const keys = await itemsService.listLlmApiKeys();
        sendJson(response, 200, keys);
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/llm-keys") {
        const payload = await readJsonBody(request);
        const label = requireString(payload.label, "label");
        const apiKey = requireString(payload.apiKey, "apiKey");
        const provider = "gemini" as const;

        const id = await itemsService.createLlmApiKey({ provider, label, apiKey });
        sendJson(response, 201, { id });
        return;
      }

      if (request.method === "DELETE" && url.pathname.startsWith("/api/llm-keys/")) {
        const idStr = url.pathname.replace("/api/llm-keys/", "");
        const id = Number(idStr);
        if (!Number.isInteger(id) || id <= 0) {
          sendJson(response, 400, { error: "Invalid id" });
          return;
        }

        const deleted = await itemsService.deleteLlmApiKey(id);
        if (!deleted) {
          sendJson(response, 404, { error: "Key not found" });
          return;
        }

        response.writeHead(204).end();
        return;
      }

      if (request.method === "PATCH" && url.pathname.startsWith("/api/llm-keys/")) {
        const idStr = url.pathname.replace("/api/llm-keys/", "");
        const id = Number(idStr);
        if (!Number.isInteger(id) || id <= 0) {
          sendJson(response, 400, { error: "Invalid id" });
          return;
        }

        const payload = await readJsonBody(request);
        const enabled = Boolean(payload.isEnabled);
        const updated = await itemsService.toggleLlmApiKey(id, enabled);

        if (!updated) {
          sendJson(response, 404, { error: "Key not found" });
          return;
        }

        sendJson(response, 200, { ok: true });
        return;
      }

      sendJson(response, 404, { error: "Not found" });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        sendJson(response, 409, { error: "Duplicate item id" });
        return;
      }

      if (error instanceof BadRequestError) {
        sendJson(response, 400, { error: error.message });
        return;
      }

      const message = error instanceof Error ? error.message : String(error);
      sendJson(response, 500, { error: message });
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });

  console.log(
    `[${new Date().toISOString()}] API server listening on http://${host}:${port}`
  );

  return {
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });

      await database.onModuleDestroy();
    }
  };
}

type NormalizedItemPayload = {
  name: string;
  url: string;
  targetPrice: number;
  currency: string;
  size?: string | undefined;
  patterns: string[];
};

function normalizeItemPayload(
  payload: Record<string, JsonValue>,
  allowMissingId: boolean
): NormalizedItemPayload {
  void allowMissingId;

  const name = requireString(payload.name, "name");
  const url = requireString(payload.url, "url");
  const currency = requireString(payload.currency, "currency");
  const size = normalizeOptionalString(payload.size);
  const targetPrice = Number(payload.targetPrice);

  if (!/^https?:\/\//i.test(url)) {
    throw new BadRequestError("URL must start with http:// or https://");
  }

  if (!Number.isFinite(targetPrice) || targetPrice <= 0) {
    throw new BadRequestError("Target price must be a positive number");
  }

  const parserValue = payload.parser;
  if (!isRecord(parserValue)) {
    throw new BadRequestError("parser is required");
  }

  const patternsValue = parserValue.patterns;
  if (!Array.isArray(patternsValue)) {
    throw new BadRequestError("parser.patterns must be an array");
  }

  const patterns = patternsValue
    .map((pattern) => (typeof pattern === "string" ? pattern.trim() : ""))
    .filter((pattern) => pattern.length > 0);

  if (patterns.length === 0) {
    throw new BadRequestError("At least one regex pattern is required");
  }

  return {
    name,
    url,
    targetPrice,
    currency,
    size,
    patterns
  };
}

function requireString(value: JsonValue | undefined, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new BadRequestError(`${fieldName} is required`);
  }

  return value.trim();
}

function normalizeOptionalString(value: JsonValue | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed;
}

function resolveConfidence(
  tier: "primary" | "secondary" | "fallback" | undefined,
  index: number
): "high" | "medium" | "low" {
  if (tier === "primary") {
    return "high";
  }

  if (tier === "secondary") {
    return "medium";
  }

  if (tier === "fallback") {
    return "low";
  }

  if (index === 0) {
    return "high";
  }

  if (index === 1) {
    return "medium";
  }

  return "low";
}

function isReasonablePrice(value: number, currency?: string): boolean {
  if (currency === "KRW" || currency === "JPY") {
    return value >= 100 && value <= 100_000_000;
  }

  return value >= 0.01 && value <= 1_000_000;
}

function isStableMatch(first: number, second: number, currency?: string): boolean {
  const baseAbsoluteTolerance =
    currency === "KRW" || currency === "JPY" ? 500 : 1;
  const relativeTolerance = Math.max(first, second) * 0.005;
  const tolerance = Math.max(baseAbsoluteTolerance, relativeTolerance);
  return Math.abs(first - second) <= tolerance;
}

function toParserConfig(
  itemId: string,
  parserCandidate: {
    type: "regex" | "jsonPath";
    pattern?: string | undefined;
    flags?: string | undefined;
    path?: string | undefined;
  }
): ParserConfig {
  if (parserCandidate.type === "regex") {
    if (!parserCandidate.pattern) {
      throw new Error(`Item '${itemId}' has regex parser without pattern`);
    }

    return {
      type: "regex",
      pattern: parserCandidate.pattern,
      flags: parserCandidate.flags ?? ""
    };
  }

  if (!parserCandidate.path) {
    throw new Error(`Item '${itemId}' has jsonPath parser without path`);
  }

  return {
    type: "jsonPath",
    path: parserCandidate.path
  };
}

async function readJsonBody(request: IncomingMessage): Promise<Record<string, JsonValue>> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    if (typeof chunk === "string") {
      chunks.push(Buffer.from(chunk));
    } else {
      chunks.push(chunk);
    }
  }

  const raw = Buffer.concat(chunks).toString("utf-8").trim();

  if (!raw) {
    return {};
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new BadRequestError("Invalid JSON body");
  }

  if (!isRecord(parsed)) {
    throw new BadRequestError("JSON body must be an object");
  }

  return parsed;
}

function setCorsHeaders(response: ServerResponse): void {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
}

function sendJson(
  response: ServerResponse,
  statusCode: number,
  body: Record<string, JsonValue> | JsonValue[]
): void {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(body));
}

function isRecord(value: unknown): value is Record<string, JsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toPort(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

class BadRequestError extends Error {}

function isDuplicateKeyError(error: unknown): error is { code: string } {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }

  const code = (error as { code?: unknown }).code;
  return code === "ER_DUP_ENTRY";
}
