import { type IncomingMessage } from "node:http";
import { URL } from "node:url";
import { type AuthService } from "./auth.service";

export type AuthenticatedUser = {
  userId: number;
};

export function extractUser(
  request: IncomingMessage,
  authService: AuthService,
): AuthenticatedUser | null {
  const header = request.headers.authorization;
  let tokenString: string | undefined;

  if (header && header.startsWith("Bearer ")) {
    tokenString = header.slice(7);
  }

  // SSE fallback: EventSource does not support custom headers
  if (!tokenString) {
    const url = new URL(
      request.url ?? "/",
      `http://${request.headers.host ?? "localhost"}`,
    );
    tokenString = url.searchParams.get("token") ?? undefined;
  }

  if (!tokenString) {
    return null;
  }

  try {
    const payload = authService.verifyJwt(tokenString);
    return { userId: payload.sub };
  } catch {
    return null;
  }
}
