import { createContext, useContext } from "react";
import { type AuthUser } from "../model/types";

export type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  /** SSE 로그인 완료 후 token·user를 직접 주입 */
  completeLogin: (token: string, user: AuthUser) => void;
  logout: () => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
