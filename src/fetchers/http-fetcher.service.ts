import { existsSync } from "node:fs";
import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { chromium, type Browser } from "playwright-core";

export type FetchOptions = {
  userAgent: string;
  timeoutMs: number;
};

export type FetchResult = {
  body: string;
  contentType: string;
};

export class HttpFetchError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly statusText: string,
    readonly contentType: string,
    readonly server?: string | undefined,
    readonly pageTitle?: string | undefined,
    readonly antiBotDetected = false
  ) {
    super(message);
    this.name = "HttpFetchError";
  }
}

@Injectable()
export class HttpFetcherService implements OnModuleDestroy {
  private browserPromise: Promise<Browser> | undefined;

  async fetchContent(url: string, options: FetchOptions): Promise<FetchResult> {
    try {
      return await this.fetchWithHttp(url, options);
    } catch (error) {
      const fetchError = toHttpFetchError(error);
      if (!shouldAttemptBrowserFallback(fetchError)) {
        throw fetchError;
      }

      console.warn(
        `[Fetcher] Browser fallback for ${url} after ${fetchError.message}`
      );

      try {
        const browserResult = await this.fetchWithBrowser(url, options);
        console.log(`[Fetcher] Browser fallback succeeded for ${url}`);
        return browserResult;
      } catch (browserError) {
        if (shouldAttemptMirrorFallback(url, fetchError, browserError)) {
          console.warn(`[Fetcher] Remote mirror fallback for ${url}`);
          try {
            const mirrorResult = await this.fetchWithMirror(url, options);
            console.log(`[Fetcher] Remote mirror fallback succeeded for ${url}`);
            return mirrorResult;
          } catch (mirrorError) {
            throw combineFetchErrors(fetchError, browserError, mirrorError);
          }
        }

        throw combineFetchErrors(fetchError, browserError);
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.close();
  }

  async close(): Promise<void> {
    const browserPromise = this.browserPromise;
    this.browserPromise = undefined;

    if (!browserPromise) {
      return;
    }

    const browser = await browserPromise;
    await browser.close();
  }

  private async fetchWithHttp(
    url: string,
    options: FetchOptions
  ): Promise<FetchResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: buildHttpHeaders(options.userAgent),
        signal: controller.signal
      });

      const contentType = response.headers.get("content-type") ?? "";
      const server = response.headers.get("server") ?? undefined;
      const body = await response.text();
      const pageTitle = extractPageTitle(body);
      const antiBotDetected = isAntiBotBlock(body, pageTitle);

      if (antiBotDetected) {
        throw new HttpFetchError(
          `HTTP ${response.status} ${response.statusText} [anti-bot block]${pageTitle ? ` - ${pageTitle}` : ""}`,
          response.status,
          response.statusText,
          contentType,
          server,
          pageTitle,
          true
        );
      }

      if (!response.ok) {
        const titlePart = pageTitle ? ` - ${pageTitle}` : "";

        throw new HttpFetchError(
          `HTTP ${response.status} ${response.statusText}${titlePart}`,
          response.status,
          response.statusText,
          contentType,
          server,
          pageTitle,
          false
        );
      }

      return { body, contentType };
    } finally {
      clearTimeout(timeout);
    }
  }

  private async fetchWithBrowser(
    url: string,
    options: FetchOptions
  ): Promise<FetchResult> {
    const browser = await this.getBrowser();
    const browserUserAgent = resolveBrowserUserAgent(options.userAgent);
    const context = await browser.newContext({
      locale: "ko-KR",
      timezoneId: "Asia/Seoul",
      viewport: { width: 1365, height: 900 },
      ...(browserUserAgent ? { userAgent: browserUserAgent } : {}),
    });

    await context.setExtraHTTPHeaders({
      "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", {
        get: () => undefined,
      });
    });

    const page = await context.newPage();

    try {
      const response = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: options.timeoutMs,
      });

      await page
        .waitForLoadState("networkidle", {
          timeout: Math.min(5_000, options.timeoutMs),
        })
        .catch(() => undefined);

      const body = await page.content();
      const pageTitle = await page.title();
      const status = response?.status() ?? 200;
      const statusText = response?.statusText() ?? "OK";
      const contentType = response?.headers()["content-type"] ?? "text/html";
      const antiBotDetected = isAntiBotBlock(body, pageTitle);

      if (antiBotDetected || status >= 400) {
        throw new HttpFetchError(
          `Browser fetch HTTP ${status} ${statusText}${antiBotDetected ? " [anti-bot block]" : ""}${pageTitle ? ` - ${pageTitle}` : ""}`,
          status,
          statusText,
          contentType,
          response?.headers().server,
          pageTitle,
          antiBotDetected
        );
      }

      return { body, contentType };
    } finally {
      await context.close();
    }
  }

  private async getBrowser(): Promise<Browser> {
    if (this.browserPromise) {
      return this.browserPromise;
    }

    const executablePath = resolveBrowserExecutablePath();

    const launchPromise = chromium.launch({
      executablePath,
      headless: true,
      args: [
        "--disable-blink-features=AutomationControlled",
        "--disable-dev-shm-usage",
        "--disable-setuid-sandbox",
        "--no-first-run",
        "--no-sandbox",
      ],
    });

    this.browserPromise = launchPromise;

    const browser = await launchPromise;
    browser.on("disconnected", () => {
      if (this.browserPromise === launchPromise) {
        this.browserPromise = undefined;
      }
    });

    return browser;
  }

  private async fetchWithMirror(
    url: string,
    options: FetchOptions
  ): Promise<FetchResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

    try {
      const response = await fetch(toMirrorUrl(url), {
        method: "GET",
        headers: {
          "accept": "text/plain, text/markdown;q=0.9, */*;q=0.8",
          "x-no-cache": "1",
        },
        signal: controller.signal,
      });

      const body = await response.text();
      const contentType = response.headers.get("content-type") ?? "text/plain; charset=utf-8";

      if (!response.ok) {
        throw new HttpFetchError(
          `Mirror fetch HTTP ${response.status} ${response.statusText}`,
          response.status,
          response.statusText,
          contentType
        );
      }

      return {
        body: transformMirrorBody(url, body),
        contentType: "text/html; charset=utf-8",
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

const DEFAULT_BROWSER_PATHS = [
  process.env.BROWSER_EXECUTABLE_PATH,
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter((value): value is string => Boolean(value));

function buildHttpHeaders(userAgent: string): Record<string, string> {
  return {
    "user-agent": userAgent,
    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    "cache-control": "no-cache",
    "pragma": "no-cache",
  };
}

function shouldAttemptMirrorFallback(
  url: string,
  fetchError: HttpFetchError,
  browserError: unknown
): boolean {
  if (!isRalphLaurenUrl(url)) {
    return false;
  }

  if (!shouldAttemptBrowserFallback(fetchError)) {
    return false;
  }

  const browserFetchError = browserError instanceof HttpFetchError
    ? browserError
    : toHttpFetchError(browserError);

  return (
    browserFetchError.antiBotDetected ||
    browserFetchError.status === 307 ||
    browserFetchError.status === 403 ||
    browserFetchError.status === 0
  );
}

function resolveBrowserUserAgent(userAgent: string): string | undefined {
  if (/^price-watch\//i.test(userAgent)) {
    return undefined;
  }

  return userAgent;
}

function resolveBrowserExecutablePath(): string {
  const executablePath = DEFAULT_BROWSER_PATHS.find((candidate) =>
    existsSync(candidate)
  );

  if (!executablePath) {
    throw new Error(
      `No browser executable found. Checked: ${DEFAULT_BROWSER_PATHS.join(", ")}`
    );
  }

  return executablePath;
}

function shouldAttemptBrowserFallback(error: HttpFetchError): boolean {
  return (
    error.antiBotDetected ||
    error.status === 307 ||
    error.status === 401 ||
    error.status === 403 ||
    error.status === 429 ||
    error.status === 503
  );
}

function toHttpFetchError(error: unknown): HttpFetchError {
  if (error instanceof HttpFetchError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  return new HttpFetchError(message, 0, "", "", undefined, undefined, false);
}

function combineFetchErrors(
  primaryError: HttpFetchError,
  browserError: unknown,
  mirrorError?: unknown
): HttpFetchError {
  const browserMessage =
    browserError instanceof Error ? browserError.message : String(browserError);
  const mirrorMessage =
    mirrorError === undefined
      ? ""
      : ` | remote mirror failed: ${mirrorError instanceof Error ? mirrorError.message : String(mirrorError)}`;

  return new HttpFetchError(
    `${primaryError.message} | browser fallback failed: ${browserMessage}${mirrorMessage}`,
    primaryError.status,
    primaryError.statusText,
    primaryError.contentType,
    primaryError.server,
    primaryError.pageTitle,
    primaryError.antiBotDetected
  );
}

function extractPageTitle(body: string): string | undefined {
  const match = body.match(/<title[^>]*>([^<]+)</i);
  return match?.[1]?.trim() || undefined;
}

function isAntiBotBlock(body: string, pageTitle?: string): boolean {
  return /px-captcha|perimeterx/i.test(body) || /access to this page has been denied/i.test(pageTitle ?? "");
}

function isRalphLaurenUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname === "www.ralphlauren.co.kr" || hostname.endsWith(".ralphlauren.co.kr");
  } catch {
    return false;
  }
}

function toMirrorUrl(url: string): string {
  return `https://r.jina.ai/http://${url}`;
}

function transformMirrorBody(url: string, markdown: string): string {
  if (isRalphLaurenUrl(url)) {
    return buildRalphLaurenMirrorHtml(url, markdown);
  }

  return `<html><body><pre>${escapeHtml(markdown)}</pre></body></html>`;
}

function buildRalphLaurenMirrorHtml(url: string, markdown: string): string {
  const titleMatch = markdown.match(/^Title:\s*(.+)$/m);
  const title = titleMatch?.[1]?.trim() || "Ralph Lauren Product";
  const sizeItems = extractRalphLaurenMirrorSizeItems(markdown);

  const sizeHtml = sizeItems
    .map(({ size, label, outOfStock }) =>
      `<li class="variations-attribute selectable${outOfStock ? " out tooltip has-tooltip" : ""}"><a data-selected="${escapeHtmlAttr(size)}">${escapeHtml(label)}</a>${outOfStock ? '<div class="nis-tooltip tooltip-content"><div class="nis-wrapper"><span class="sold-out">일시적으로 품절되었습니다.</span><br/><span class="description">품절</span></div></div>' : ""}</li>`
    )
    .join("");

  return [
    "<!doctype html>",
    "<html lang=\"ko\">",
    "<head>",
    `<title>${escapeHtml(title)}</title>`,
    "</head>",
    "<body>",
    `<main data-source="jina-mirror">${escapeHtml(markdown)}</main>`,
    sizeHtml ? `<ul class="mirror-size-list">${sizeHtml}</ul>` : "",
    "</body>",
    "</html>",
  ].join("");
}

function extractRalphLaurenMirrorSizeItems(markdown: string): Array<{
  size: string;
  label: string;
  outOfStock: boolean;
}> {
  const items: Array<{ size: string; label: string; outOfStock: boolean }> = [];
  const regex = /^\s*\*\s+\[(?<label>[^\]]+)\]\((?<link>https:\/\/[^\s)]+Product-Variation[^\s)]*)[^)]*\)(?<tail>[^\n]*)/gm;

  for (const match of markdown.matchAll(regex)) {
    const label = match.groups?.label?.trim();
    const link = match.groups?.link?.trim();
    const tail = match.groups?.tail?.trim() ?? "";

    if (!label || !link) {
      continue;
    }

    const size = extractPrimarySizeFromVariationUrl(link) ?? extractSizeFromLabel(label);
    if (!size) {
      continue;
    }

    const afterMatch = markdown.slice(match.index ?? 0, (match.index ?? 0) + match[0].length + 40);
    const outOfStock = /일시적으로 품절되었습니다|품절|not available/i.test(`${tail}\n${afterMatch}`);
    items.push({ size, label, outOfStock });
  }

  return dedupeSizeItems(items);
}

function extractPrimarySizeFromVariationUrl(link: string): string | undefined {
  try {
    const parsed = new URL(link);
    for (const [key, value] of parsed.searchParams.entries()) {
      if (/primarysize/i.test(key) && value.trim()) {
        return decodeURIComponent(value).trim();
      }
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function extractSizeFromLabel(label: string): string | undefined {
  const firstToken = label.split("/")[0]?.trim();
  return firstToken || undefined;
}

function dedupeSizeItems(
  items: Array<{ size: string; label: string; outOfStock: boolean }>
): Array<{ size: string; label: string; outOfStock: boolean }> {
  const bySize = new Map<string, { size: string; label: string; outOfStock: boolean }>();

  for (const item of items) {
    if (!bySize.has(item.size)) {
      bySize.set(item.size, item);
    }
  }

  return [...bySize.values()];
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeHtmlAttr(value: string): string {
  return escapeHtml(value).replaceAll('"', "&quot;");
}
