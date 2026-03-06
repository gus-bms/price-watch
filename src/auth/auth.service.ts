import jwt from "jsonwebtoken";
import { type RowDataPacket } from "mysql2/promise";
import { type DatabaseService } from "../database/database.service";

export type KakaoTokens = {
  accessToken: string;
  refreshToken?: string;
};

export type KakaoProfile = {
  kakaoId: number;
  nickname: string;
  profileImageUrl: string | null;
};

export type UserRow = RowDataPacket & {
  id: number;
  kakao_id: number;
  nickname: string | null;
  profile_image_url: string | null;
};

export type JwtPayload = {
  sub: number;
  iat: number;
  exp: number;
};

export class AuthService {
  private readonly jwtSecret: string;
  private readonly jwtExpiresIn: string;
  private readonly kakaoClientId: string;
  private readonly kakaoClientSecret: string;

  constructor(private readonly database: DatabaseService) {
    this.jwtSecret = process.env.JWT_SECRET ?? "dev-jwt-secret";
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN ?? "7d";
    this.kakaoClientId = process.env.KAKAO_CLIENT_ID ?? "";
    this.kakaoClientSecret = process.env.KAKAO_CLIENT_SECRET ?? "";
  }

  async exchangeKakaoCode(code: string, redirectUri: string): Promise<KakaoTokens> {
    const params = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: this.kakaoClientId,
      redirect_uri: redirectUri,
      code,
    });

    if (this.kakaoClientSecret) {
      params.set("client_secret", this.kakaoClientSecret);
    }

    const response = await fetch("https://kauth.kakao.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const data = (await response.json()) as Record<string, unknown>;

    if (!response.ok) {
      const errorMsg =
        typeof data.error_description === "string"
          ? data.error_description
          : "Kakao token exchange failed";
      throw new Error(errorMsg);
    }

    return {
      accessToken: data.access_token as string,
      refreshToken: (data.refresh_token as string) ?? undefined,
    };
  }

  async getKakaoProfile(accessToken: string): Promise<KakaoProfile> {
    const response = await fetch("https://kapi.kakao.com/v2/user/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const data = (await response.json()) as Record<string, unknown>;

    if (!response.ok) {
      throw new Error("Failed to fetch Kakao profile");
    }

    const kakaoId = data.id as number;
    const kakaoAccount = data.kakao_account as Record<string, unknown> | undefined;
    const profile = kakaoAccount?.profile as Record<string, unknown> | undefined;

    return {
      kakaoId,
      nickname: (profile?.nickname as string) ?? "사용자",
      profileImageUrl: (profile?.profile_image_url as string) ?? null,
    };
  }

  async findOrCreateUser(
    kakaoId: number,
    nickname: string,
    profileImageUrl: string | null,
  ): Promise<UserRow> {
    await this.database.execute(
      `INSERT INTO \`user\` (kakao_id, nickname, profile_image_url)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         nickname = VALUES(nickname),
         profile_image_url = VALUES(profile_image_url),
         updated_at = NOW(3)`,
      [kakaoId, nickname, profileImageUrl],
    );

    const rows = await this.database.queryRows<UserRow[]>(
      `SELECT id, kakao_id, nickname, profile_image_url
       FROM \`user\`
       WHERE kakao_id = ?
       LIMIT 1`,
      [kakaoId],
    );

    if (rows.length === 0 || !rows[0]) {
      throw new Error("Failed to create or find user");
    }

    return rows[0];
  }

  async getUserById(userId: number): Promise<UserRow | null> {
    const rows = await this.database.queryRows<UserRow[]>(
      `SELECT id, kakao_id, nickname, profile_image_url
       FROM \`user\`
       WHERE id = ?
       LIMIT 1`,
      [userId],
    );

    return rows[0] ?? null;
  }

  signJwt(userId: number): string {
    const expiresInMs = parseExpiresIn(this.jwtExpiresIn);
    return jwt.sign({ sub: userId }, this.jwtSecret, {
      expiresIn: expiresInMs,
    });
  }

  verifyJwt(token: string): JwtPayload {
    const decoded = jwt.verify(token, this.jwtSecret);
    if (typeof decoded === "string") {
      throw new Error("Invalid token");
    }
    return decoded as unknown as JwtPayload;
  }
}

function parseExpiresIn(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value);
  if (!match) return 7 * 24 * 60 * 60; // default 7 days in seconds
  const num = Number(match[1]);
  switch (match[2]) {
    case "s": return num;
    case "m": return num * 60;
    case "h": return num * 60 * 60;
    case "d": return num * 24 * 60 * 60;
    default: return 7 * 24 * 60 * 60;
  }
}
