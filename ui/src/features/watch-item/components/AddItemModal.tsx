import { useMemo, useState, type FormEvent } from "react";
import styles from "../../../App.module.css";
import { PARSER_PRESETS } from "../model/parser-presets";
import { dedupePatterns, parsePatternsFromText } from "../model/serializers";
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
      lastPrice: initialItem?.lastPrice,
      lastCheckedAt: initialItem?.lastCheckedAt,
      lastError: initialItem?.lastError,
      lastMatchedPattern: initialItem?.lastMatchedPattern,
      matchConfidence: initialItem?.matchConfidence,
      fallbackVerified: initialItem?.fallbackVerified
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
            <span className={styles.fieldLabel}>Custom regex patterns (one per line)</span>
            <textarea
              className={styles.textarea}
              value={customPatternsText}
              onChange={(event) => {
                setCustomPatternsText(event.target.value);
              }}
              rows={5}
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
