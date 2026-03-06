import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { streamKakaoLogin } from "../api/auth.api";
import { useAuth } from "../hooks/use-auth";
import { type AuthLoginProgress } from "../model/types";
import styles from "./OAuthCallback.module.css";

const STEP_LABELS: Record<string, string> = {
  code_check:     "인증 코드 확인 중...",
  token_exchange: "카카오 토큰 교환 중...",
  profile_fetch:  "프로필 정보 가져오는 중...",
  user_sync:      "계정 동기화 중...",
  done:           "로그인 완료!",
  error:          "오류 발생",
};

export function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { completeLogin } = useAuth();
  const [steps, setSteps] = useState<AuthLoginProgress[]>([]);
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    const code = searchParams.get("code");
    const errorParam = searchParams.get("error");

    if (errorParam || !code) {
      setSteps([{
        step: "error",
        message: errorParam ?? "인증 코드를 받지 못했습니다.",
        error: errorParam ?? "인증 코드를 받지 못했습니다.",
      }]);
      return;
    }

    const redirectUri = `${window.location.origin}/oauth/callback`;

    const stop = streamKakaoLogin(code, redirectUri, (progress) => {
      setSteps((prev) => [...prev, progress]);

      if (progress.step === "done" && progress.token && progress.user) {
        completeLogin(progress.token, progress.user);
        // "완료" 메시지를 잠깐 보여주고 이동
        setTimeout(() => navigate("/", { replace: true }), 800);
      }
    });

    return stop;
  }, [searchParams, completeLogin, navigate]);

  const lastStep = steps[steps.length - 1];
  const isError = lastStep?.step === "error";
  const isDone = lastStep?.step === "done";
  const isFinished = isError || isDone;

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          {!isFinished && <span className={styles.spinner} />}
          <h2 className={styles.title}>
            {isDone
              ? "로그인 완료"
              : isError
                ? "로그인 실패"
                : "카카오 로그인 중..."}
          </h2>
        </div>

        {steps.length > 0 && (
          <ol className={styles.stepList}>
            {steps.map((progress, index) => {
              const isLast = index === steps.length - 1;
              const stepClass =
                progress.step === "error"
                  ? styles.stepError
                  : progress.step === "done" || !isLast
                    ? styles.stepDone
                    : styles.stepActive;

              const icon =
                progress.step === "error"
                  ? "✗"
                  : progress.step === "done" || !isLast
                    ? "✓"
                    : "…";

              return (
                <li key={index} className={`${styles.step} ${stepClass}`}>
                  <span className={styles.stepIcon}>{icon}</span>
                  <span className={styles.stepMessage}>
                    {STEP_LABELS[progress.step] ?? progress.message}
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        {isError && lastStep?.error && (
          <p className={styles.errorMsg}>{lastStep.error}</p>
        )}

        {isError && (
          <a href="/login" className={styles.retryBtn}>
            다시 시도
          </a>
        )}
      </div>
    </div>
  );
}
