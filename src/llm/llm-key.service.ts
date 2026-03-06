import { Injectable } from "@nestjs/common";
import type { RowDataPacket } from "mysql2/promise";
import { DatabaseService } from "../database/database.service";

interface LlmApiKeyRow extends RowDataPacket {
  id: number;
  provider: "gemini";
  label: string;
  api_key: string;
}

@Injectable()
export class LlmKeyService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * 활성화된 키 중 가장 오래전에 사용된 키를 선택 (라운드로빈).
   * last_used_at 을 즉시 갱신하여 다음 호출이 다른 키를 선택하도록 함.
   */
  async acquireKey(provider: "gemini" = "gemini"): Promise<{ id: number; apiKey: string } | null> {
    const rows = await this.db.queryRows<LlmApiKeyRow[]>(
      `SELECT id, api_key
       FROM llm_api_key
       WHERE provider = ? AND is_enabled = TRUE AND quota_error_at IS NULL
       ORDER BY last_used_at ASC
       LIMIT 1`,
      [provider]
    );

    if (rows.length === 0 || !rows[0]) return null;

    const row = rows[0];

    await this.db.execute(
      `UPDATE llm_api_key SET last_used_at = NOW(3) WHERE id = ?`,
      [row.id]
    );

    return { id: row.id, apiKey: row.api_key };
  }

  /** quota 초과 시 해당 키를 일시적으로 비활성화 */
  async markQuotaError(keyId: number): Promise<void> {
    await this.db.execute(
      `UPDATE llm_api_key SET quota_error_at = NOW(3) WHERE id = ?`,
      [keyId]
    );
  }
}
