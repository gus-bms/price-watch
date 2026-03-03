import { useCallback, useEffect, useState } from "react";
import {
  checkWatchItem,
  createWatchItem,
  deleteWatchItem,
  listWatchItems,
  updateWatchItem
} from "../api/watch-items.api";
import { type WatchItem } from "../model/types";

export function useWatchItems() {
  const [items, setItems] = useState<WatchItem[]>([]);
  const [checking, setChecking] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reloadItems = useCallback(async () => {
    const nextItems = await listWatchItems();
    setItems(nextItems);
  }, []);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        await reloadItems();
      } catch (error) {
        if (!active) {
          return;
        }

        setLoadError(error instanceof Error ? error.message : String(error));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [reloadItems]);

  const handleCreateItem = useCallback(
    async (item: WatchItem) => {
      await createWatchItem(item);
      await reloadItems();
    },
    [reloadItems]
  );

  const handleUpdateItem = useCallback(
    async (item: WatchItem) => {
      await updateWatchItem(item);
      await reloadItems();
    },
    [reloadItems]
  );

  const handleDeleteItem = useCallback(
    async (itemId: string) => {
      await deleteWatchItem(itemId);
      await reloadItems();
    },
    [reloadItems]
  );

  const handleCheckItem = useCallback(async (itemId: string) => {
    setChecking((prev) => new Set(prev).add(itemId));

    try {
      const parsed = await checkWatchItem(itemId);
      const now = Date.now();

      setItems((current) =>
        current.map((item) => {
          if (item.id !== itemId) return item;

          if (parsed.soldOut) {
            // 품절 확인 → Sold Out 배지 즉시 표시
            return {
              ...item,
              lastCheckedAt: now,
              lastError: undefined,
              lastInStock: false
            };
          }

          return {
            ...item,
            lastPrice: parsed.price,
            lastCheckedAt: now,
            lastError: undefined,
            lastMatchedPattern: parsed.matchedPattern,
            matchConfidence: parsed.confidence,
            fallbackVerified: parsed.verifiedByRecheck,
            // stock 패턴이 있고 인스톡이 확인된 경우만 lastInStock 갱신
            ...(parsed.inStock === true ? { lastInStock: true } : {})
          };
        })
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      setItems((current) =>
        current.map((item) =>
          item.id === itemId
            ? {
                ...item,
                lastCheckedAt: Date.now(),
                lastError: message,
                matchConfidence: undefined,
                fallbackVerified: undefined
              }
            : item
        )
      );
    } finally {
      setChecking((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  }, []);

  return {
    items,
    checking,
    loading,
    loadError,
    reloadItems,
    createItem: handleCreateItem,
    updateItem: handleUpdateItem,
    deleteItem: handleDeleteItem,
    checkItem: handleCheckItem
  };
}
