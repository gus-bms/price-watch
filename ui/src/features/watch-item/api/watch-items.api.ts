import {
  extractErrorMessage,
  itemToPayload,
  normalizeItems,
  parseCheckSuccess
} from "../model/serializers";
import { type CheckSuccess, type WatchItem } from "../model/types";

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ||
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

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}
