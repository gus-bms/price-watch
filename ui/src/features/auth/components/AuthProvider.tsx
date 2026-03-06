import { useCallback, useEffect, useState, type ReactNode } from "react";
import { fetchCurrentUser } from "../api/auth.api";
import { AuthContext, type AuthContextValue } from "../hooks/use-auth";
import { type AuthUser } from "../model/types";

const TOKEN_KEY = "pw_token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem(TOKEN_KEY),
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    let active = true;

    fetchCurrentUser(token)
      .then((userData) => {
        if (active) setUser(userData);
      })
      .catch(() => {
        if (active) {
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
          setUser(null);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  /** SSE "done" 이벤트 수신 후 OAuthCallback에서 직접 호출 */
  const completeLogin = useCallback((newToken: string, newUser: AuthUser) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const value: AuthContextValue = { user, token, loading, completeLogin, logout };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
