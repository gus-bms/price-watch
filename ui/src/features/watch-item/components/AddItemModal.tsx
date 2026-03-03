import { useMemo, useState, type FormEvent } from "react";
import styles from "../../../App.module.css";
import { PARSER_PRESETS } from "../model/parser-presets";
import { dedupePatterns, parsePatternsFromText } from "../model/serializers";
import { STOCK_PRESETS } from "../model/stock-presets";
import { type WatchItem } from "../model/types";

type AddItemModalProps = {
  mode: "create" | "edit";
  initialItem: WatchItem | null;
  onSubmit: (item: WatchItem) => void;
  onClose: () => void;
};

export function AddItemModal({
  mode,
  initialItem,
  onSubmit,
  onClose
}: AddItemModalProps) {
  const [name, setName] = useState(initialItem?.name ?? "");
  const [url, setUrl] = useState(initialItem?.url ?? "");
  const [targetPrice, setTargetPrice] = useState(
    initialItem?.targetPrice ? String(initialItem.targetPrice) : ""
  );
  const [currency, setCurrency] = useState(initialItem?.currency ?? "USD");
  const [selectedPresetIds, setSelectedPresetIds] = useState<string[]>([]);
  const [customPatternsText, setCustomPatternsText] = useState(
    initialItem?.parser.patterns.join("\n") ?? ""
  );
  const [selectedStockPresetIds, setSelectedStockPresetIds] = useState<string[]>([]);
  const [customStockPatternsText, setCustomStockPatternsText] = useState(
    initialItem?.stockPatterns.join("\n") ?? ""
  );
  const [error, setError] = useState("");

  const presetPatterns = useMemo(
    () =>
      PARSER_PRESETS
        .filter((preset) => selectedPresetIds.includes(preset.id))
        .flatMap((preset) => preset.patterns),
    [selectedPresetIds]
  );

  const allPatterns = useMemo(
    () => dedupePatterns([...presetPatterns, ...parsePatternsFromText(customPatternsText)]),
    [customPatternsText, presetPatterns]
  );

  const stockPresetPatterns = useMemo(
    () =>
      STOCK_PRESETS
        .filter((preset) => selectedStockPresetIds.includes(preset.id))
        .flatMap((preset) => preset.patterns),
    [selectedStockPresetIds]
  );

  const allStockPatterns = useMemo(
    () => dedupePatterns([...stockPresetPatterns, ...parsePatternsFromText(customStockPatternsText)]),
    [customStockPatternsText, stockPresetPatterns]
  );

  function togglePreset(presetId: string, presetCurrency: string) {
    setSelectedPresetIds((current) =>
      current.includes(presetId)
        ? current.filter((value) => value !== presetId)
        : [...current, presetId]
    );

    if (mode === "create") {
      setCurrency(presetCurrency);
    }
  }

  function toggleStockPreset(presetId: string) {
    setSelectedStockPresetIds((current) =>
      current.includes(presetId)
        ? current.filter((value) => value !== presetId)
        : [...current, presetId]
    );
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    const trimmedName = name.trim();
    const trimmedUrl = url.trim();
    const parsedPrice = Number(targetPrice);
    const trimmedCurrency = currency.trim() || "USD";

    if (!trimmedName) {
      setError("Name is required");
      return;
    }

    if (!/^https?:\/\//i.test(trimmedUrl)) {
      setError("URL must start with http:// or https://");
      return;
    }

    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setError("Target price must be a positive number");
      return;
    }

    if (allPatterns.length === 0) {
      setError("At least one regex pattern is required");
      return;
    }

    onSubmit({
      id: initialItem?.id ?? crypto.randomUUID(),
      name: trimmedName,
      url: trimmedUrl,
      targetPrice: parsedPrice,
      currency: trimmedCurrency,
      parser: { type: "regex", patterns: allPatterns },
      stockPatterns: allStockPatterns,
      lastPrice: initialItem?.lastPrice,
      lastCheckedAt: initialItem?.lastCheckedAt,
      lastError: initialItem?.lastError,
      lastMatchedPattern: initialItem?.lastMatchedPattern,
      matchConfidence: initialItem?.matchConfidence,
      fallbackVerified: initialItem?.fallbackVerified,
      lastInStock: initialItem?.lastInStock
    });
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            {mode === "edit" ? "Edit tracked item" : "Add tracked item"}
          </h2>
          <button className={styles.modalClose} type="button" onClick={onClose}>
            ×
          </button>
        </div>

        {/* 가격 패턴 프리셋 */}
        <div className={styles.presetList}>
          {PARSER_PRESETS.map((preset) => (
            <button
              key={preset.id}
              className={`${styles.presetCard} ${
                selectedPresetIds.includes(preset.id) ? styles.presetCardSelected : ""
              }`}
              type="button"
              onClick={() => {
                togglePreset(preset.id, preset.currency);
              }}
            >
              <div className={styles.presetTop}>
                <span className={styles.presetLabel}>{preset.label}</span>
                <span className={styles.presetExample}>{preset.currency}</span>
              </div>
              <span className={styles.presetDesc}>{preset.description}</span>
            </button>
          ))}
        </div>

        {/* 재입고 감지 패턴 프리셋 */}
        <div className={styles.stockPresetHeader}>
          <span className={styles.stockPresetTitle}>재입고 감지 패턴</span>
          <span className={styles.stockPresetSubtitle}>품절 표시를 감지하면 가격 체크를 건너뜁니다</span>
        </div>
        <div className={styles.presetList}>
          {STOCK_PRESETS.map((preset) => (
            <button
              key={preset.id}
              className={`${styles.presetCard} ${styles.presetCardStock} ${
                selectedStockPresetIds.includes(preset.id) ? styles.presetCardSelected : ""
              }`}
              type="button"
              onClick={() => {
                toggleStockPreset(preset.id);
              }}
            >
              <div className={styles.presetTop}>
                <span className={styles.presetLabel}>{preset.label}</span>
                <span className={styles.presetExample}>{preset.patterns.length}개</span>
              </div>
              <span className={styles.presetDesc}>{preset.description}</span>
            </button>
          ))}
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.selectedPresetBanner}>
            <span className={styles.presetBannerLabel}>{allPatterns.length} pattern(s)</span>
            <span className={styles.presetBannerDesc}>Patterns are tested in order.</span>
          </div>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Product name</span>
            <input
              className={styles.input}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
              }}
              placeholder="Belmar Jacket (Blue S)"
            />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Product URL</span>
            <input
              className={styles.input}
              value={url}
              onChange={(event) => {
                setUrl(event.target.value);
              }}
              placeholder="https://example.com/product"
              type="url"
            />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Target price</span>
            <input
              className={styles.input}
              value={targetPrice}
              onChange={(event) => {
                setTargetPrice(event.target.value);
              }}
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
              onChange={(event) => {
                setCurrency(event.target.value);
              }}
              placeholder="USD"
            />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Custom 가격 패턴 (한 줄에 하나)</span>
            <textarea
              className={styles.textarea}
              value={customPatternsText}
              onChange={(event) => {
                setCustomPatternsText(event.target.value);
              }}
              rows={4}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Custom 재입고 감지 패턴 (한 줄에 하나)</span>
            <textarea
              className={styles.textarea}
              value={customStockPatternsText}
              onChange={(event) => {
                setCustomStockPatternsText(event.target.value);
              }}
              placeholder={"품절\n일시품절\nsold out"}
              rows={3}
            />
          </label>

          {error && <p className={styles.formError}>{error}</p>}

          <button className={styles.submitBtn} type="submit">
            {mode === "edit" ? "Save changes" : "Start tracking"}
          </button>
        </form>
      </div>
    </div>
  );
}
