import { type AuthLoginProgress, type AuthUser } from "../model/types";

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ??
  "http://localhost:4000";

export type LoginResponse = {
  token: string;
  user: AuthUser;
};

/** SSE 스트리밍 카카오 로그인 — LLM 분석 패턴과 동일 */
export function streamKakaoLogin(
  code: string,
  redirectUri: string,
  onProgress: (progress: AuthLoginProgress) => void,
): () => void {
  const params = new URLSearchParams({ code, redirectUri });
  const es = new EventSource(`${API_BASE}/api/auth/kakao/stream?${params.toString()}`);

  es.onmessage = (event: MessageEvent<string>) => {
    try {
      const progress = JSON.parse(event.data) as AuthLoginProgress;
      onProgress(progress);

      if (progress.step === "done" || progress.step === "error") {
        es.close();
      }
    } catch {
      // 파싱 실패 무시
    }
  };

  es.onerror = () => {
    onProgress({ step: "error", message: "서버 연결이 끊어졌습니다." });
    es.close();
  };

  return () => {
    es.close();
  };
}

export async function fetchCurrentUser(token: string): Promise<AuthUser> {
  const response = await fetch(`${API_BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    throw new Error((data?.error as string) ?? "Failed to fetch user");
  }

  return data as unknown as AuthUser;
}
