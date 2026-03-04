import { useMemo, useState, type FormEvent } from "react";
import styles from "../../../App.module.css";
import { saveLlmParsers, streamLlmAnalysis } from "../api/watch-items.api";
import { PARSER_PRESETS } from "../model/parser-presets";
import { dedupePatterns, parsePatternsFromText } from "../model/serializers";
import { type GeneratedParsers, type LlmAnalysisProgress, type WatchItem } from "../model/types";
import { LlmAnalysisOverlay } from "./LlmAnalysisOverlay";

type AddItemModalProps = {
  mode: "create" | "edit";
  initialItem: WatchItem | null;
  onSubmit: (item: WatchItem) => void;
  onClose: () => void;
};

export function AddItemModal({ mode, initialItem, onSubmit, onClose }: AddItemModalProps) {
  const [name, setName] = useState(initialItem?.name ?? "");
  const [url, setUrl] = useState(initialItem?.url ?? "");
  const [targetPrice, setTargetPrice] = useState(
    initialItem?.targetPrice ? String(initialItem.targetPrice) : ""
  );
  const [currency, setCurrency] = useState(initialItem?.currency ?? "USD");
  const [size, setSize] = useState(initialItem?.size ?? "");
  const [selectedPresetIds, setSelectedPresetIds] = useState<string[]>([]);
  const [customPatternsText, setCustomPatternsText] = useState(
    initialItem?.parser.patterns.join("\n") ?? ""
  );
  const [error, setError] = useState("");
  const [llmSteps, setLlmSteps] = useState<LlmAnalysisProgress[]>([]);
  const [llmAnalyzing, setLlmAnalyzing] = useState(false);
  const [llmResult, setLlmResult] = useState<GeneratedParsers | null>(null);
  const [cancelLlm, setCancelLlm] = useState<(() => void) | null>(null);

  const presetPatterns = useMemo(
    () => PARSER_PRESETS.filter((p) => selectedPresetIds.includes(p.id)).flatMap((p) => p.patterns),
    [selectedPresetIds]
  );
  const allPatterns = useMemo(
    () => dedupePatterns([...presetPatterns, ...parsePatternsFromText(customPatternsText)]),
    [customPatternsText, presetPatterns]
  );

  function togglePreset(presetId: string, presetCurrency: string) {
    setSelectedPresetIds((current) =>
      current.includes(presetId) ? current.filter((v) => v !== presetId) : [...current, presetId]
    );
    if (mode === "create") setCurrency(presetCurrency);
  }

  function handleStartLlmAnalysis() {
    const trimmedUrl = url.trim();
    if (!/^https?:\/\//i.test(trimmedUrl)) {
      setError("LLM 분석을 시작하려면 먼저 URL을 입력해주세요.");
      return;
    }
    setError("");
    setLlmSteps([]);
    setLlmResult(null);
    setLlmAnalyzing(true);
    const cancel = streamLlmAnalysis(trimmedUrl, (progress) => {
      setLlmSteps((prev) => [...prev, progress]);
      if (progress.step === "done" && progress.data) setLlmResult(progress.data);
      if (progress.step === "done" || progress.step === "error") setLlmAnalyzing(false);
    });
    setCancelLlm(() => cancel);
  }

  function handleCancelLlm() {
    cancelLlm?.();
    setLlmAnalyzing(false);
    setLlmSteps([]);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const trimmedName = name.trim();
    const trimmedUrl = url.trim();
    const parsedPrice = Number(targetPrice);
    const trimmedCurrency = currency.trim() || "USD";
    const trimmedSize = size.trim() || undefined;
    if (!trimmedName) { setError("Name is required"); return; }
    if (!/^https?:\/\//i.test(trimmedUrl)) { setError("URL must start with http:// or https://"); return; }
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) { setError("Target price must be a positive number"); return; }
    if (allPatterns.length === 0) { setError("At least one regex pattern is required"); return; }

    const submittedItem: WatchItem = {
      id: initialItem?.id ?? crypto.randomUUID(),
      name: trimmedName, url: trimmedUrl, targetPrice: parsedPrice,
      currency: trimmedCurrency, size: trimmedSize,
      parser: { type: "regex", patterns: allPatterns },
      lastPrice: initialItem?.lastPrice, lastCheckedAt: initialItem?.lastCheckedAt,
      lastError: initialItem?.lastError, lastMatchedPattern: initialItem?.lastMatchedPattern,
      matchConfidence: initialItem?.matchConfidence, fallbackVerified: initialItem?.fallbackVerified
    };

    if (llmResult) {
      void saveLlmParsers(submittedItem.id, llmResult).catch((err) => {
        console.warn("LLM parser save failed:", err instanceof Error ? err.message : String(err));
      });
    }
    onSubmit(submittedItem);
  }

  if (llmAnalyzing || (llmSteps.length > 0 && !llmResult)) {
    const lastStep = llmSteps[llmSteps.length - 1];
    const isFinished = lastStep?.step === "done" || lastStep?.step === "error";
    if (!isFinished) return <LlmAnalysisOverlay steps={llmSteps} onCancel={handleCancelLlm} />;
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            {mode === "edit" ? "Edit tracked item" : "Add tracked item"}
          </h2>
          <button className={styles.modalClose} type="button" onClick={onClose}>
            x
          </button>
        </div>

        <div className={styles.presetList}>
          {PARSER_PRESETS.map((preset) => (
            <button
              key={preset.id}
              className={`${styles.presetCard} ${selectedPresetIds.includes(preset.id) ? styles.presetCardSelected : ""}`}
              type="button"
              onClick={() => { togglePreset(preset.id, preset.currency); }}
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
            <input className={styles.input} value={name} onChange={(e) => { setName(e.target.value); }} placeholder="Belmar Jacket (Blue S)" />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Product URL</span>
            <div className={styles.urlRow}>
              <input className={styles.input} value={url} onChange={(e) => { setUrl(e.target.value); }} placeholder="https://example.com/product" type="url" />
              <button className={styles.llmAnalyzeBtn} type="button" onClick={handleStartLlmAnalysis}>LLM 분석</button>
            </div>
          </label>

          {llmResult && (
            <div className={styles.llmResultBanner}>
              <span>LLM 파서 생성 완료</span>
              <span className={styles.llmResultDetail}>
                {"가격: /" + llmResult.pricePattern + "/"}
                {llmResult.stockPattern ? " | 품절: /" + llmResult.stockPattern + "/" : ""}
                {llmResult.sizeStockPatterns.length > 0 ? " | 사이즈: " + llmResult.sizeStockPatterns.map((s) => s.size).join(", ") : ""}
              </span>
              <button className={styles.deleteBtn} type="button" onClick={() => { setLlmResult(null); }} style={{ padding: "0 0.5rem" }}>x</button>
            </div>
          )}

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Target price</span>
            <input className={styles.input} value={targetPrice} onChange={(e) => { setTargetPrice(e.target.value); }} placeholder="200" type="number" min="0" step="0.01" />
          </label>

          <div className={styles.fieldRow}>
            <label className={`${styles.field} ${styles.fieldFlex}`}>
              <span className={styles.fieldLabel}>Currency</span>
              <input className={styles.input} value={currency} onChange={(e) => { setCurrency(e.target.value); }} placeholder="USD" />
            </label>
            <label className={`${styles.field} ${styles.fieldFlex}`}>
              <span className={styles.fieldLabel}>Size (optional)</span>
              <input className={styles.input} value={size} onChange={(e) => { setSize(e.target.value); }} placeholder="M, L, 270 ..." />
            </label>
          </div>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Custom regex patterns (one per line)</span>
            <textarea className={styles.textarea} value={customPatternsText} onChange={(e) => { setCustomPatternsText(e.target.value); }} rows={5} />
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
