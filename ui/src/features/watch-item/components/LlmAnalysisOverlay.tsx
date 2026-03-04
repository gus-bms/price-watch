import styles from "../../../App.module.css";
import { type LlmAnalysisProgress } from "../model/types";

type LlmAnalysisOverlayProps = {
  steps: LlmAnalysisProgress[];
  onCancel: () => void;
};

const STEP_LABELS: Record<string, string> = {
  html_fetch: "페이지 HTML 수집 중...",
  llm_request: "LLM 분석 요청 중...",
  llm_parse: "LLM 페이지 확인 중...",
  regex_gen: "정규식 저장 중...",
  done: "분석 완료",
  error: "오류 발생"
};

export function LlmAnalysisOverlay({ steps, onCancel }: LlmAnalysisOverlayProps) {
  const lastStep = steps[steps.length - 1];
  const isDone = lastStep?.step === "done";
  const isError = lastStep?.step === "error";
  const isFinished = isDone || isError;

  return (
    <div className={styles.overlay}>
      <div className={`${styles.modal} ${styles.llmOverlayModal}`} role="dialog" aria-modal="true">
        <div className={styles.llmOverlayHeader}>
          {!isFinished && <span className={styles.spinner} />}
          <h2 className={styles.llmOverlayTitle}>
            {isDone ? "LLM 분석 완료" : isError ? "분석 오류" : "LLM 분석 중..."}
          </h2>
        </div>

        <ol className={styles.llmStepList}>
          {steps.map((progress, index) => {
            const isLast = index === steps.length - 1;
            const stepClass =
              progress.step === "done"
                ? styles.llmStepDone
                : progress.step === "error"
                  ? styles.llmStepError
                  : isLast
                    ? styles.llmStepActive
                    : styles.llmStepDone;

            const icon =
              progress.step === "done"
                ? "✓"
                : progress.step === "error"
                  ? "✗"
                  : isLast
                    ? "…"
                    : "✓";

            return (
              <li key={index} className={`${styles.llmStep} ${stepClass}`}>
                <span className={styles.llmStepIcon}>{icon}</span>
                <span className={styles.llmStepMessage}>
                  {STEP_LABELS[progress.step] ?? progress.message}
                </span>
              </li>
            );
          })}
        </ol>

        {isError && lastStep?.error && (
          <p className={styles.llmOverlayError}>{lastStep.error}</p>
        )}

        {isDone && (
          <p className={styles.llmOverlaySuccess}>
            파서가 생성되었습니다. 아이템을 저장하면 적용됩니다.
          </p>
        )}

        <button
          className={isFinished ? styles.submitBtn : styles.deleteBtn}
          type="button"
          onClick={onCancel}
        >
          {isFinished ? "확인" : "취소"}
        </button>
      </div>
    </div>
  );
}
