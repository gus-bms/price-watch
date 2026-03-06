export type AuthUser = {
  id: number;
  nickname: string;
  profileImageUrl: string | null;
};

export type AuthLoginStep =
  | "code_check"
  | "token_exchange"
  | "profile_fetch"
  | "user_sync"
  | "done"
  | "error";

export type AuthLoginProgress = {
  step: AuthLoginStep;
  message: string;
  token?: string;
  user?: AuthUser;
  error?: string;
};
