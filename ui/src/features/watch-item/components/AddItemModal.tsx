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
  const [step, setStep] = useState<1 | 2 | 3>(mode === "edit" ? 3 : 1);
  const [name, setName] = useState(initialItem?.name ?? "");
  const [url, setUrl] = useState(initialItem?.url ?? "");
  const [targetPrice, setTargetPrice] = useState(
    initialItem?.targetPrice ? String(initialItem.targetPrice) : ""
  );
  const [currency, setCurrency] = useState(initialItem?.currency ?? "KRW");
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

  function handleCancelLlm() {
    cancelLlm?.();
    setLlmAnalyzing(false);
    setLlmSteps([]);
  }

  function handleNextStep1(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("상품명을 입력해주세요."); return; }
    if (!/^https?:\/\//i.test(url.trim())) { setError("URL은 http:// 또는 https:// 로 시작해야 합니다."); return; }
    setError("");
    setStep(2);
  }

  function handleNextStep2(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLlmSteps([]);
    setLlmResult(null);
    setLlmAnalyzing(true);
    
    const targetSize = size.trim() || undefined;
    
    const cancel = streamLlmAnalysis(url.trim(), targetSize, (progress) => {
      setLlmSteps((prev) => [...prev, progress]);
      
      if (progress.step === "done" && progress.data) {
        setLlmResult(progress.data);
        if (progress.data.testRun?.currentPrice && !targetPrice) {
          setTargetPrice(String(progress.data.testRun.currentPrice));
        }
      }
      
      if (progress.step === "done" || progress.step === "error") {
        setLlmAnalyzing(false);
        if (progress.step === "done") {
          setStep(3);
        }
      }
    });
    setCancelLlm(() => cancel);
  }

  function handleSubmitStep3(event: FormEvent) {
    event.preventDefault();
    setError("");
    
    const trimmedName = name.trim();
    const trimmedUrl = url.trim();
    const trimmedCurrency = currency.trim() || "USD";
    const trimmedSize = size.trim() || undefined;
    
    let parsedPrice = Number(targetPrice);
    
    // 타겟 프라이스가 없고, 품절(재입고 등록) 모드라면 기본값 0 할당
    if (llmResult?.testRun?.isOutOfStock) {
        if (!targetPrice) {
            parsedPrice = llmResult.testRun.currentPrice || 0;
        }
    }

    if (!trimmedName) { setError("Name is required"); return; }
    if (!/^https?:\/\//i.test(trimmedUrl)) { setError("URL error"); return; }
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) { 
        setError("유효한 목표 금액을 입력해주세요 (재입고 모드인 경우 0 입력 가능)"); 
        return; 
    }
    
    // LLM 분석이 성공했다면 결과의 정규식을 커스텀 패턴으로 자동 주입
    let finalPatterns = allPatterns;
    if (llmResult && finalPatterns.length === 0) {
        finalPatterns = [llmResult.pricePattern];
    }
    
    if (finalPatterns.length === 0) { setError("적어도 하나의 파싱 정규식이 필요합니다."); return; }

    const submittedItem: WatchItem = {
      id: initialItem?.id ?? crypto.randomUUID(),
      name: trimmedName, url: trimmedUrl, targetPrice: parsedPrice,
      currency: trimmedCurrency, size: trimmedSize,
      parser: { type: "regex", patterns: finalPatterns },
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

  if (llmAnalyzing || (llmSteps.length > 0 && !llmResult && step === 2)) {
    const lastStep = llmSteps[llmSteps.length - 1];
    const isFinished = lastStep?.step === "done" || lastStep?.step === "error";
    if (!isFinished) return <LlmAnalysisOverlay steps={llmSteps} onCancel={handleCancelLlm} />;
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            {mode === "edit" ? "추적 아이템 수정" : `아이템 등록 (${step}/3)`}
          </h2>
          <button className={styles.modalClose} type="button" onClick={onClose}>x</button>
        </div>

        {step === 1 && (
          <form className={styles.form} onSubmit={handleNextStep1}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>상품명</span>
              <input className={styles.input} value={name} onChange={(e) => { setName(e.target.value); }} placeholder="Belmar Jacket (Blue S)" autoFocus />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>상품 URL</span>
              <input className={styles.input} value={url} onChange={(e) => { setUrl(e.target.value); }} placeholder="https://example.com/product" type="url" />
            </label>
            {error && <p className={styles.formError}>{error}</p>}
            <button className={styles.submitBtn} type="submit" style={{ marginTop: "1.5rem" }}>다음 ➜</button>
          </form>
        )}

        {step === 2 && (
          <form className={styles.form} onSubmit={handleNextStep2}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>사이즈 (Optional)</span>
              <p style={{ margin: "0 0 10px 0", fontSize: "0.85rem", color: "#666", lineHeight: 1.4 }}>
                특정 옵션(예: M, 270 등)의 재고 유무를 파악하려면 해당 텍스트를 입력하세요. 입력하지 않으면 전체 재고를 추적합니다.
              </p>
              <input className={styles.input} value={size} onChange={(e) => { setSize(e.target.value); }} placeholder="M, 270, L ..." autoFocus />
            </label>
            {error && <p className={styles.formError}>{error}</p>}
            <div className={styles.fieldRow} style={{ marginTop: "1.5rem" }}>
              <button className={`${styles.submitBtn} ${styles.fieldFlex}`} style={{ background: "#666", flex: 0.3 }} type="button" onClick={() => setStep(1)}>이전</button>
              <button className={`${styles.submitBtn} ${styles.fieldFlex}`} type="submit">상품 정보 분석 시작</button>
            </div>
          </form>
        )}

        {step === 3 && (
          <form className={styles.form} onSubmit={handleSubmitStep3}>
            {llmResult?.testRun?.isOutOfStock ? (
              <div style={{ background: "#fee2e2", padding: "1rem", borderRadius: "8px", border: "1px solid #fca5a5", marginBottom: "1rem" }}>
                <h3 style={{ color: "#991b1b", margin: "0 0 0.5rem 0", fontSize: "1rem" }}>🚨 품절 상태 감지됨</h3>
                <p style={{ margin: 0, color: "#7f1d1d", fontSize: "0.9rem", lineHeight: 1.5 }}>
                  현재 해당 옵션({size || "전체"})은 <b>품절(Sold Out)</b> 상태입니다.<br/>
                  목표 가격 달성과 관계없이 재입고 시 알림이 전송되는 <b>[재입고 감지 모드]</b>로 동작합니다.
                </p>
              </div>
            ) : (
              <div style={{ marginBottom: "1rem", background: "#f0fdf4", padding: "1rem", borderRadius: "8px", border: "1px solid #86efac" }}>
                 <p style={{ margin: 0, color: "#166534", fontWeight: 600, fontSize: "1.1rem" }}>
                   {llmResult?.testRun?.currentPrice ? `현재 발견된 가격: ₩${llmResult.testRun.currentPrice.toLocaleString()}` : "✅ 대상 품목 추적이 준비되었습니다."}
                 </p>
                 <p style={{ margin: "0.5rem 0 0 0", color: "#15803d", fontSize: "0.9rem" }}>아래에 알림을 받을 <b>목표 금액</b>을 설정해 주세요.</p>
              </div>
            )}

            {!llmResult?.testRun?.isOutOfStock && (
              <div className={styles.fieldRow}>
                <label className={`${styles.field} ${styles.fieldFlex}`}>
                  <span className={styles.fieldLabel}>목표 금액 (Target Price)</span>
                  <input className={styles.input} value={targetPrice} onChange={(e) => { setTargetPrice(e.target.value); }} placeholder="목표가 입력" type="number" min="0" step="0.01" />
                </label>
                <label className={`${styles.field} ${styles.fieldFlex}`} style={{ maxWidth: '100px' }}>
                  <span className={styles.fieldLabel}>통화</span>
                  <input className={styles.input} value={currency} onChange={(e) => { setCurrency(e.target.value); }} placeholder="KRW" />
                </label>
              </div>
            )}
            
            <details style={{ marginTop: "1rem", fontSize: "0.85rem" }}>
              <summary style={{ cursor: "pointer", color: "#666" }}>고급 파서 설정 ▾</summary>
              <div style={{ marginTop: "0.5rem" }}>
                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>사전 설정 프리셋</span>
                    <div className={styles.presetList} style={{ maxHeight: "150px" }}>
                      {PARSER_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          className={`${styles.presetCard} ${selectedPresetIds.includes(preset.id) ? styles.presetCardSelected : ""}`}
                          type="button"
                          onClick={() => {
                              setSelectedPresetIds((current) =>
                                  current.includes(preset.id) ? current.filter((v) => v !== preset.id) : [...current, preset.id]
                              );
                              setCurrency(preset.currency);
                          }}
                        >
                          <span className={styles.presetLabel}>{preset.label}</span>
                        </button>
                      ))}
                    </div>
                  </label>

                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Custom regex patterns (한 줄에 하나씩)</span>
                    <textarea className={styles.textarea} value={customPatternsText} onChange={(e) => { setCustomPatternsText(e.target.value); }} rows={3} />
                  </label>
              </div>
            </details>

            {error && <p className={styles.formError}>{error}</p>}

            <div className={styles.fieldRow} style={{ marginTop: "1.5rem" }}>
              {mode === "create" && <button className={`${styles.submitBtn} ${styles.fieldFlex}`} style={{ background: "#666", flex: 0.3 }} type="button" onClick={() => setStep(2)}>이전</button>}
              <button className={`${styles.submitBtn} ${styles.fieldFlex}`} type="submit">
                {mode === "edit" ? "변경사항 저장" : llmResult?.testRun?.isOutOfStock ? "재입고 추적 등록하기" : "가격 추적 등록하기"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
