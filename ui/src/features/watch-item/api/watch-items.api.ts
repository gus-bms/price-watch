import {
  extractErrorMessage,
  itemToPayload,
  normalizeLlmKeys,
  normalizeItems,
  parseCheckSuccess
} from "../model/serializers";
import {
  type CheckSuccess,
  type GeneratedParsers,
  type LlmApiKey,
  type LlmAnalysisProgress,
  type WatchItem
} from "../model/types";

// When VITE_API_BASE_URL is empty (""), relative URLs are used — ideal for
// production nginx reverse proxy (/api/* → backend:4000).
// When running locally without Docker, falls back to http://localhost:4000.
const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ??
  "http://localhost:4000";

export async function listWatchItems(): Promise<WatchItem[]> {
  const response = await fetch(`${API_BASE}/api/items`);
  const data = await safeJson(response);

  if (!response.ok) {
    throw new Error(extractErrorMessage(data, "Failed to load items"));
  }

  return normalizeItems(data);
}

export async function createWatchItem(item: WatchItem): Promise<void> {
  const response = await fetch(`${API_BASE}/api/items`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(itemToPayload(item))
  });

  const data = await safeJson(response);

  if (!response.ok) {
    throw new Error(extractErrorMessage(data, "Failed to create item"));
  }
}

export async function updateWatchItem(item: WatchItem): Promise<void> {
  const response = await fetch(`${API_BASE}/api/items/${encodeURIComponent(item.id)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(itemToPayload(item))
  });

  const data = await safeJson(response);

  if (!response.ok) {
    throw new Error(extractErrorMessage(data, "Failed to update item"));
  }
}

export async function deleteWatchItem(itemId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/items/${encodeURIComponent(itemId)}`, {
    method: "DELETE"
  });

  if (!response.ok && response.status !== 404) {
    const data = await safeJson(response);
    throw new Error(extractErrorMessage(data, "Failed to delete item"));
  }
}

export async function checkWatchItem(itemId: string): Promise<CheckSuccess> {
  const response = await fetch(`${API_BASE}/api/check`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ itemId })
  });

  const data = await safeJson(response);

  if (!response.ok) {
    throw new Error(extractErrorMessage(data, "Check failed"));
  }

  return parseCheckSuccess(data);
}

export async function saveLlmParsers(
  itemId: string,
  parsers: GeneratedParsers
): Promise<void> {
  const response = await fetch(
    `${API_BASE}/api/items/${encodeURIComponent(itemId)}/parsers/llm`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsers)
    }
  );

  const data = await safeJson(response);

  if (!response.ok) {
    throw new Error(extractErrorMessage(data, "Failed to save LLM parsers"));
  }
}

export function streamLlmAnalysis(
  url: string,
  size: string | undefined,
  onProgress: (progress: LlmAnalysisProgress) => void
): () => void {
  const sizeParam = size ? `&size=${encodeURIComponent(size)}` : "";
  const es = new EventSource(
    `${API_BASE}/api/items/analyze-stream?url=${encodeURIComponent(url)}${sizeParam}`
  );

  es.onmessage = (event: MessageEvent<string>) => {
    try {
      const progress = JSON.parse(event.data) as LlmAnalysisProgress;
      onProgress(progress);

      if (progress.step === "done" || progress.step === "error") {
        es.close();
      }
    } catch {
      // 파싱 실패는 무시
    }
  };

  es.onerror = () => {
    onProgress({ step: "error", message: "연결이 끊어졌습니다." });
    es.close();
  };

  return () => {
    es.close();
  };
}

export async function listLlmApiKeys(): Promise<LlmApiKey[]> {
  const response = await fetch(`${API_BASE}/api/llm-keys`);
  const data = await safeJson(response);

  if (!response.ok) {
    throw new Error(extractErrorMessage(data, "Failed to load LLM keys"));
  }

  return normalizeLlmKeys(data);
}

export async function createLlmApiKey(label: string, apiKey: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/llm-keys`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ provider: "gemini", label, apiKey })
  });

  const data = await safeJson(response);

  if (!response.ok) {
    throw new Error(extractErrorMessage(data, "Failed to create LLM key"));
  }
}

export async function deleteLlmApiKey(id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/api/llm-keys/${id}`, {
    method: "DELETE"
  });

  if (!response.ok && response.status !== 404) {
    const data = await safeJson(response);
    throw new Error(extractErrorMessage(data, "Failed to delete LLM key"));
  }
}

export async function toggleLlmApiKey(id: number, isEnabled: boolean): Promise<void> {
  const response = await fetch(`${API_BASE}/api/llm-keys/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ isEnabled })
  });

  const data = await safeJson(response);

  if (!response.ok) {
    throw new Error(extractErrorMessage(data, "Failed to update LLM key"));
  }
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}
