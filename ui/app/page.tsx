"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./page.module.css";

type WatchItem = {
  id: string;
  name: string;
  url: string;
  targetPrice: number;
  currency: string;
  parser: { type: "regex"; patterns: string[] };
  lastPrice?: number;
  lastCheckedAt?: number;
  lastError?: string;
  lastMatchedPattern?: string;
  matchConfidence?: "high" | "medium" | "low";
  fallbackVerified?: boolean;
};

const STORAGE_KEY = "price-watch-items";

type ParserPreset = {
  id: string;
  label: string;
  description: string;
  currency: string;
  patterns: string[];
  example: string;
};

const PARSER_PRESETS: ParserPreset[] = [
  {
    id: "usd-dollar-sign",
    label: "USD ($)",
    description: "Matches $123.45 or $1,234.00",
    currency: "USD",
    patterns: ["\\$([0-9,.]+)", "price[^0-9$]*\\$([0-9,.]+)"],
    example: "$215.00",
  },
  {
    id: "krw-product-page",
    label: "KRW product page",
    description: "판매가, 원, won, KRW formatting with fallback patterns",
    currency: "KRW",
    patterns: [
      "판매가[^0-9₩원]*₩?\\s*([0-9,]+)",
      "판매가[^0-9]*([0-9,]+)\\s*원",
      "\\u20a9\\s*([0-9,]+)",
      "([0-9,]+)\\s*원",
      "KRW[^0-9]*([0-9,]+)"
    ],
    example: "판매가 215,000원",
  },
  {
    id: "krw-price-number",
    label: "KRW numeric fallback",
    description: "Generic KRW numeric matches with won text or symbol",
    currency: "KRW",
    patterns: ["([0-9]{1,3}(?:,[0-9]{3})+)\\s*원", "\\u20a9\\s*([0-9,]+)"],
    example: "215,000원",
  },
  {
    id: "usd-product-name",
    label: "USD label + price",
    description: "Product name or price label followed by $price",
    currency: "USD",
    patterns: ["[\\s\\S]*?\\$([0-9,.]+)", "(?:price|판매가)[^0-9$]*\\$([0-9,.]+)"],
    example: "Jacket $215.00",
  },
  {
    id: "eur-symbol",
    label: "EUR",
    description: "Matches 123,45 or 1.234,00 followed by a euro sign",
    currency: "EUR",
    patterns: ["([0-9.,]+)\\s*\\u20ac", "\\u20ac\\s*([0-9.,]+)"],
    example: "199,99 EUR",
  },
  {
    id: "gbp-symbol",
    label: "GBP",
    description: "Matches pound sign followed by price",
    currency: "GBP",
    patterns: ["\\u00a3([0-9,.]+)"],
    example: "GBP 149.99",
  },
  {
    id: "jpy-yen",
    label: "JPY",
    description: "Matches yen sign followed by price",
    currency: "JPY",
    patterns: ["\\u00a5([0-9,]+)"],
    example: "JPY 29,800",
  },
  {
    id: "cny-yuan",
    label: "CNY",
    description: "Matches yuan sign followed by price",
    currency: "CNY",
    patterns: ["\\u00a5([0-9,.]+)"],
    example: "CNY 1,299.00",
  },
  {
    id: "json-price-field",
    label: "JSON (price field)",
    description: "Matches \"price\":123 or \"price\":\"123\" in JSON",
    currency: "USD",
    patterns: ["\"price\"\\s*:\\s*\"?([0-9,.]+)", "\"salePrice\"\\s*:\\s*\"?([0-9,.]+)"],
    example: "JSON API",
  },
  {
    id: "generic-number",
    label: "Generic number",
    description: "Use as last fallback only",
    currency: "USD",
    patterns: ["([0-9]{1,3}(?:,[0-9]{3})+(?:\\.[0-9]+)?)"],
    example: "1,234.56",
  },
];

function loadItems(): WatchItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<
      Partial<WatchItem> & {
        parser?: { type?: string; pattern?: string; patterns?: string[] };
      }
    >;
    const normalized: WatchItem[] = [];

    for (const item of parsed) {
      const patterns = Array.isArray(item.parser?.patterns)
        ? item.parser.patterns.filter(
            (pattern) => typeof pattern === "string" && pattern.trim()
          )
        : typeof item.parser?.pattern === "string" && item.parser.pattern.trim()
          ? [item.parser.pattern.trim()]
          : [];

      const targetPrice = Number(item.targetPrice);

      if (
        !item.id ||
        !item.name ||
        !item.url ||
        !Number.isFinite(targetPrice) ||
        patterns.length === 0
      ) {
        continue;
      }

      normalized.push({
        id: item.id,
        name: item.name,
        url: item.url,
        targetPrice,
        currency: item.currency ?? "USD",
        parser: { type: "regex", patterns },
        lastPrice: item.lastPrice,
        lastCheckedAt: item.lastCheckedAt,
        lastError: item.lastError,
        lastMatchedPattern: item.lastMatchedPattern,
        matchConfidence: item.matchConfidence,
        fallbackVerified: item.fallbackVerified
      });
    }

    return normalized;
  } catch {
    return [];
  }
}

function saveItems(items: WatchItem[]) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export default function HomePage() {
  const [items, setItems] = useState<WatchItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [checking, setChecking] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setItems(loadItems());
    setMounted(true);
  }, []);

  const persist = useCallback(
    (next: WatchItem[]) => {
      setItems(next);
      saveItems(next);
    },
    [],
  );

  function handleAdd(item: WatchItem) {
    persist([item, ...items]);
    setShowForm(false);
    setEditingItemId(null);
  }

  function handleUpdate(item: WatchItem) {
    persist(items.map((current) => (current.id === item.id ? item : current)));
    setShowForm(false);
    setEditingItemId(null);
  }

  function handleDelete(id: string) {
    persist(items.filter((i) => i.id !== id));
  }

  function handleEdit(id: string) {
    setEditingItemId(id);
    setShowForm(true);
  }

  async function handleCheck(id: string) {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    setChecking((prev) => new Set(prev).add(id));

    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: item.url,
          parsers: item.parser.patterns.map((pattern, index) => ({
            type: "regex",
            pattern,
            tier:
              index === 0
                ? "primary"
                : index === 1
                  ? "secondary"
                  : "fallback"
          })),
          currency: item.currency
        }),
      });
      const data = await res.json();

      persist(
        items.map((i) =>
          i.id === id
            ? {
                ...i,
                lastPrice: data.error ? i.lastPrice : data.price,
                lastCheckedAt: Date.now(),
                lastError: data.error ?? undefined,
                lastMatchedPattern: data.error ? undefined : data.matchedParser?.pattern,
                matchConfidence: data.error ? undefined : data.confidence,
                fallbackVerified: data.error
                  ? undefined
                  : Boolean(data.verifiedByRecheck),
              }
            : i,
        ),
      );
    } catch (err) {
      persist(
        items.map((i) =>
          i.id === id
            ? {
                ...i,
                lastCheckedAt: Date.now(),
                lastError: err instanceof Error ? err.message : String(err),
                matchConfidence: undefined,
                fallbackVerified: undefined,
              }
            : i,
        ),
      );
    } finally {
      setChecking((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  if (!mounted) return null;

  const belowTarget = items.filter(
    (i) => i.lastPrice !== undefined && i.lastPrice <= i.targetPrice,
  ).length;
  const withErrors = items.filter((i) => i.lastError).length;

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.logo}>Price Watch</h1>
            <p className={styles.tagline}>
              Track prices. Get notified when they drop.
            </p>
          </div>
          <button
            className={styles.addBtn}
            onClick={() => {
              setEditingItemId(null);
              setShowForm(true);
            }}
            type="button"
          >
            <span className={styles.addIcon}>+</span>
            Add item
          </button>
        </header>

        {items.length > 0 && (
          <div className={styles.stats}>
            <div className={styles.stat}>
              <span className={styles.statValue}>{items.length}</span>
              <span className={styles.statLabel}>Tracking</span>
            </div>
            <div className={styles.stat}>
              <span className={`${styles.statValue} ${styles.statGreen}`}>
                {belowTarget}
              </span>
              <span className={styles.statLabel}>Below target</span>
            </div>
            <div className={styles.stat}>
              <span
                className={`${styles.statValue} ${withErrors > 0 ? styles.statRed : ""}`}
              >
                {withErrors}
              </span>
              <span className={styles.statLabel}>Errors</span>
            </div>
          </div>
        )}

        {items.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>
              <svg width="56" height="56" viewBox="0 0 56 56" fill="none" role="img" aria-label="Empty state illustration">
                <rect x="4" y="12" width="48" height="32" rx="6" stroke="var(--ink-dim)" strokeWidth="2" />
                <path d="M4 22h48M20 32h16" stroke="var(--ink-dim)" strokeWidth="2" strokeLinecap="round" />
                <circle cx="44" cy="12" r="8" fill="var(--accent)" opacity="0.8" />
                <path d="M41.5 12h5M44 9.5v5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <h2 className={styles.emptyTitle}>No items yet</h2>
            <p className={styles.emptyText}>
              Add a product link to start tracking its price.
            </p>
            <button
              className={styles.addBtn}
              onClick={() => {
                setEditingItemId(null);
                setShowForm(true);
              }}
              type="button"
            >
              <span className={styles.addIcon}>+</span>
              Add your first item
            </button>
          </div>
        ) : (
          <div className={styles.grid}>
            {items.map((item) => (
              <article
                key={item.id}
                className={`${styles.card} ${item.lastError ? styles.cardError : ""}`}
              >
                <div className={styles.cardTop}>
                  <h3 className={styles.cardName}>{item.name}</h3>
                  <span
                    className={`${styles.badge} ${
                      item.lastError
                        ? styles.badgeRed
                        : item.lastPrice !== undefined && item.lastPrice <= item.targetPrice
                          ? styles.badgeGreen
                          : ""
                    }`}
                  >
                    {item.lastError
                      ? "Error"
                      : item.lastPrice !== undefined && item.lastPrice <= item.targetPrice
                        ? "Below target"
                        : "Watching"}
                  </span>
                </div>

                <div className={styles.prices}>
                  <div className={styles.priceCol}>
                    <span className={styles.priceLabel}>Current</span>
                    <span className={styles.priceCurrent}>
                      {item.lastPrice !== undefined
                        ? formatMoney(item.lastPrice, item.currency)
                        : "--"}
                    </span>
                  </div>
                  <div className={styles.priceDivider} />
                  <div className={styles.priceCol}>
                    <span className={styles.priceLabel}>Target</span>
                    <span className={styles.priceTarget}>
                      {formatMoney(item.targetPrice, item.currency)}
                    </span>
                  </div>
                </div>

                {item.lastError && (
                  <p className={styles.errorMsg}>{item.lastError}</p>
                )}

                <div className={styles.cardMeta}>
                  <span>
                    {item.lastCheckedAt
                      ? `Checked ${formatTime(item.lastCheckedAt)}`
                      : "Not checked yet"}
                  </span>
                  <span className={styles.parserHint}>
                    {item.lastMatchedPattern
                      ? `Matched: /${item.lastMatchedPattern}/`
                      : `${item.parser.patterns.length} pattern(s)`}
                  </span>
                </div>

                {item.matchConfidence === "low" && (
                  <p className={styles.matchNoteWarn}>
                    Fallback pattern matched{item.fallbackVerified ? " (rechecked)" : ""}
                  </p>
                )}

                {item.matchConfidence === "medium" && (
                  <p className={styles.matchNoteInfo}>Secondary pattern matched</p>
                )}

                <div className={styles.cardActions}>
                  <button
                    className={styles.checkBtn}
                    onClick={() => handleCheck(item.id)}
                    disabled={checking.has(item.id)}
                    type="button"
                  >
                    {checking.has(item.id) ? (
                      <span className={styles.spinner} />
                    ) : (
                      "Check now"
                    )}
                  </button>
                  <a
                    className={styles.linkBtn}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Visit
                  </a>
                  <button
                    className={styles.editBtn}
                    onClick={() => handleEdit(item.id)}
                    type="button"
                  >
                    Edit
                  </button>
                  <button
                    className={styles.deleteBtn}
                    onClick={() => handleDelete(item.id)}
                    type="button"
                    aria-label="Delete item"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" role="img" aria-label="Delete">
                      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <AddItemModal
          mode={editingItemId ? "edit" : "create"}
          initialItem={editingItemId ? items.find((item) => item.id === editingItemId) ?? null : null}
          onAdd={handleAdd}
          onUpdate={handleUpdate}
          onClose={() => {
            setShowForm(false);
            setEditingItemId(null);
          }}
        />
      )}
    </div>
  );
}

function AddItemModal({
  mode,
  initialItem,
  onAdd,
  onUpdate,
  onClose,
}: {
  mode: "create" | "edit";
  initialItem: WatchItem | null;
  onAdd: (item: WatchItem) => void;
  onUpdate: (item: WatchItem) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<"preset" | "details">(
    mode === "edit" ? "details" : "preset"
  );
  const [selectedPresetIds, setSelectedPresetIds] = useState<string[]>([]);
  const [name, setName] = useState(initialItem?.name ?? "");
  const [url, setUrl] = useState(initialItem?.url ?? "");
  const [targetPrice, setTargetPrice] = useState(
    initialItem?.targetPrice ? String(initialItem.targetPrice) : ""
  );
  const [currency, setCurrency] = useState(initialItem?.currency ?? "USD");
  const [customPatternsText, setCustomPatternsText] = useState(
    initialItem?.parser.patterns.join("\n") ?? ""
  );
  const [error, setError] = useState("");

  const selectedPresetPatterns = PARSER_PRESETS
    .filter((preset) => selectedPresetIds.includes(preset.id))
    .flatMap((preset) => preset.patterns);

  const allPatterns = dedupePatterns([
    ...selectedPresetPatterns,
    ...parsePatternsFromText(customPatternsText)
  ]);

  function handlePickPreset(preset: ParserPreset) {
    setSelectedPresetIds((current) =>
      current.includes(preset.id)
        ? current.filter((id) => id !== preset.id)
        : [...current, preset.id]
    );
    if (!initialItem) {
      setCurrency(preset.currency);
    }
  }

  function handleNext() {
    if (selectedPresetIds.length === 0 && parsePatternsFromText(customPatternsText).length === 0) {
      setError("Choose at least one preset or add one custom regex pattern.");
      return;
    }
    setError("");
    setStep("details");
  }

  function handleBack() {
    setStep("preset");
    setError("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    if (!/^https?:\/\//i.test(url)) {
      setError("URL must start with http:// or https://");
      return;
    }

    const price = Number(targetPrice);
    if (!Number.isFinite(price) || price <= 0) {
      setError("Target price must be a positive number");
      return;
    }

    if (allPatterns.length === 0) {
      setError("At least one regex pattern is required");
      return;
    }

    const nextItem: WatchItem = {
      id: initialItem?.id ?? crypto.randomUUID(),
      name: name.trim(),
      url: url.trim(),
      targetPrice: price,
      currency: currency.trim() || "USD",
      parser: { type: "regex", patterns: allPatterns },
      lastPrice: initialItem?.lastPrice,
      lastCheckedAt: initialItem?.lastCheckedAt,
      lastError: initialItem?.lastError,
      lastMatchedPattern: initialItem?.lastMatchedPattern
    };

    if (mode === "edit") {
      onUpdate(nextItem);
      return;
    }

    onAdd(nextItem);
  }

  function closeOverlay() {
    onClose();
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Add item modal" onClick={closeOverlay} onKeyDown={(e) => { if (e.key === "Escape") closeOverlay(); }}>
      <div className={styles.modal} role="document" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          {step === "details" && (
            <button className={styles.backBtn} onClick={handleBack} type="button" aria-label="Back">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" role="img" aria-label="Back arrow">
                <path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          <h2 className={styles.modalTitle}>
            {step === "preset" ? "Choose price parser set" : mode === "edit" ? "Edit tracked item" : "Item details"}
          </h2>
          <button
            className={styles.modalClose}
            onClick={closeOverlay}
            type="button"
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" role="img" aria-label="Close">
              <path d="M5 5l10 10M15 5l-10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {step === "preset" ? (
          <div className={styles.presetList}>
            {PARSER_PRESETS.map((preset) => (
              <button
                key={preset.id}
                className={`${styles.presetCard} ${selectedPresetIds.includes(preset.id) ? styles.presetCardSelected : ""}`}
                onClick={() => handlePickPreset(preset)}
                type="button"
              >
                <div className={styles.presetTop}>
                  <span className={styles.presetLabel}>{preset.label}</span>
                  <span className={styles.presetExample}>{preset.example}</span>
                </div>
                <span className={styles.presetDesc}>{preset.description}</span>
              </button>
            ))}
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Custom regex patterns (one per line)</span>
              <textarea
                className={styles.textarea}
                value={customPatternsText}
                onChange={(e) => setCustomPatternsText(e.target.value)}
                placeholder="판매가[^0-9]*([0-9,]+)원"
                rows={5}
              />
            </label>
            {error && <p className={styles.formError}>{error}</p>}
            <button className={styles.submitBtn} type="button" onClick={handleNext}>
              Continue
            </button>
          </div>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.selectedPresetBanner}>
              <span className={styles.presetBannerLabel}>{allPatterns.length} regex pattern(s)</span>
              <span className={styles.presetBannerDesc}>The checker will try these patterns in order until one matches.</span>
            </div>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Product name</span>
              <input
                className={styles.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Belmar Jacket (Blue S)"
              />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Product URL</span>
              <input
                className={styles.input}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/product"
                type="url"
              />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Target price</span>
              <input
                className={styles.input}
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                placeholder="200"
                type="number"
                min="0"
                step="0.01"
              />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Currency</span>
              <input
                className={styles.input}
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                placeholder="KRW"
              />
            </label>

            {error && <p className={styles.formError}>{error}</p>}

            <button className={styles.submitBtn} type="submit">
              {mode === "edit" ? "Save changes" : "Start tracking"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function parsePatternsFromText(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function dedupePatterns(patterns: string[]) {
  return [...new Set(patterns)];
}

function formatMoney(value: number, currency?: string) {
  if (!currency) return value.toLocaleString("en-US");
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

function formatTime(ts: number) {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "short", timeStyle: "short" }).format(new Date(ts));
}
