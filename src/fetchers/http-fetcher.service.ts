import { Injectable } from "@nestjs/common";

export type FetchOptions = {
  userAgent: string;
  timeoutMs: number;
};

export type FetchResult = {
  body: string;
  contentType: string;
};

@Injectable()
export class HttpFetcherService {
  async fetchContent(url: string, options: FetchOptions): Promise<FetchResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "user-agent": options.userAgent
        },
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const body = await response.text();
      const contentType = response.headers.get("content-type") ?? "";
      return { body, contentType };
    } finally {
      clearTimeout(timeout);
    }
  }
}
