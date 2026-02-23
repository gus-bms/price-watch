export type ParserInput = {
  type: "regex" | "jsonPath";
  pattern?: string;
  flags?: string;
  path?: string;
  tier?: "primary" | "secondary" | "fallback";
};

export type CheckRequest = {
  url: string;
  parser?: ParserInput;
  parsers?: ParserInput[];
  timeoutMs?: number;
  userAgent?: string;
  currency?: string;
};

export type CheckResult = {
  price: number;
  matchedParser: ParserInput;
  confidence: "high" | "medium" | "low";
  verifiedByRecheck: boolean;
};

export async function checkPriceFromUrl(request: CheckRequest): Promise<CheckResult> {
  const timeoutMs = Number(request.timeoutMs ?? 15000);
  const userAgent = request.userAgent ?? "price-watch-ui/0.1 (+local)";
  const parserCandidates = normalizeParsers(request);
  const body = await fetchBody(request.url, userAgent, timeoutMs);
  const parserErrors: string[] = [];

  for (const [index, parser] of parserCandidates.entries()) {
    try {
      const price = parsePrice(body, parser);

      if (!isReasonablePrice(price, request.currency)) {
        throw new Error("matched value failed sanity check");
      }

      const confidence = resolveConfidence(parser, index);

      let verifiedByRecheck = false;
      if (confidence === "low") {
        const recheckBody = await fetchBody(request.url, userAgent, timeoutMs);
        const recheckPrice = parsePrice(recheckBody, parser);
        if (!isReasonablePrice(recheckPrice, request.currency)) {
          throw new Error("recheck value failed sanity check");
        }
        if (!isStableMatch(price, recheckPrice, request.currency)) {
          throw new Error("fallback match was not stable on recheck");
        }
        verifiedByRecheck = true;
      }

      return {
        price,
        matchedParser: parser,
        confidence,
        verifiedByRecheck
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      parserErrors.push(message);
    }
  }

  throw new Error(parserErrors[parserErrors.length - 1] ?? "no parser candidates");
}

function normalizeParsers(request: CheckRequest) {
  if (Array.isArray(request.parsers) && request.parsers.length > 0) {
    return request.parsers;
  }

  if (request.parser) {
    return [request.parser];
  }

  throw new Error("parser is required");
}

async function fetchBody(url: string, userAgent: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "user-agent": userAgent
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function resolveConfidence(
  parser: ParserInput,
  index: number
): "high" | "medium" | "low" {
  if (parser.tier === "primary") {
    return "high";
  }

  if (parser.tier === "secondary") {
    return "medium";
  }

  if (parser.tier === "fallback") {
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

function isStableMatch(first: number, second: number, currency?: string) {
  const baseAbsoluteTolerance =
    currency === "KRW" || currency === "JPY" ? 500 : 1;
  const relativeTolerance = Math.max(first, second) * 0.005;
  const tolerance = Math.max(baseAbsoluteTolerance, relativeTolerance);
  return Math.abs(first - second) <= tolerance;
}

function isReasonablePrice(value: number, currency?: string) {
  if (currency === "KRW" || currency === "JPY") {
    return value >= 100 && value <= 100_000_000;
  }

  return value >= 0.01 && value <= 1_000_000;
}

function parsePrice(body: string, parser: ParserInput) {
  if (parser.type === "regex") {
    const pattern = parser.pattern ?? "";
    if (!pattern) {
      throw new Error("regex pattern is required");
    }
    const regex = new RegExp(pattern, parser.flags ?? "");
    const match = regex.exec(body);
    if (!match || !match[1]) {
      throw new Error("regex parser did not match a price");
    }
    return toNumber(match[1]);
  }

  if (parser.type === "jsonPath") {
    const path = parser.path ?? "";
    if (!path) {
      throw new Error("jsonPath path is required");
    }
    const data = JSON.parse(body) as unknown;
    const value = getByPath(data, path);
    if (value === undefined || value === null) {
      throw new Error("jsonPath parser did not find a value");
    }
    return toNumber(value);
  }

  throw new Error(`unsupported parser type: ${parser.type}`);
}

function toNumber(value: unknown) {
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

function getByPath(obj: unknown, pathValue: string) {
  const parts = pathValue
    .split(".")
    .flatMap((part) => part.split(/\[(\d+)\]/).filter(Boolean));

  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (Array.isArray(current) && isIndex(part)) {
      current = current[Number(part)];
      continue;
    }

    if (typeof current === "object" && Object.hasOwn(current, part)) {
      current = (current as Record<string, unknown>)[part];
      continue;
    }

    return undefined;
  }

  return current;
}

function isIndex(value: string) {
  return /^[0-9]+$/.test(value);
}
