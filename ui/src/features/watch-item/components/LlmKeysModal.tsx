import { useEffect, useState, type FormEvent } from "react";
import styles from "../../../App.module.css";
import {
  createLlmApiKey,
  deleteLlmApiKey,
  listLlmApiKeys,
  toggleLlmApiKey
} from "../api/watch-items.api";
import { type LlmApiKey } from "../model/types";

type LlmKeysModalProps = {
  onClose: () => void;
};

export function LlmKeysModal({ onClose }: LlmKeysModalProps) {
  const [keys, setKeys] = useState<LlmApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void listLlmApiKeys()
      .then(setKeys)
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    setError("");

    const trimLabel = label.trim();
    const trimKey = apiKey.trim();

    if (!trimLabel || !trimKey) {
      setError("라벨과 API 키를 모두 입력해주세요.");
      return;
    }

    setSubmitting(true);

    try {
      await createLlmApiKey(trimLabel, trimKey);
      const updated = await listLlmApiKeys();
      setKeys(updated);
      setLabel("");
      setApiKey("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteLlmApiKey(id);
      setKeys((current) => current.filter((k) => k.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleToggle(key: LlmApiKey) {
    try {
      await toggleLlmApiKey(key.id, !key.isEnabled);
      setKeys((current) =>
        current.map((k) =>
          k.id === key.id ? { ...k, isEnabled: !k.isEnabled, quotaErrorAt: undefined } : k
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Gemini API 키 관리</h2>
          <button className={styles.modalClose} type="button" onClick={onClose}>
            ×
          </button>
        </div>

        {loading ? (
          <p style={{ padding: "1rem", color: "var(--color-muted)" }}>불러오는 중...</p>
        ) : (
          <div className={styles.llmKeyList}>
            {keys.length === 0 ? (
              <p style={{ color: "var(--color-muted)", fontSize: "0.85rem" }}>
                등록된 키가 없습니다.
              </p>
            ) : (
              keys.map((key) => (
                <div key={key.id} className={styles.llmKeyRow}>
                  <div className={styles.llmKeyInfo}>
                    <span className={styles.llmKeyLabel}>{key.label}</span>
                    <span
                      className={`${styles.badge} ${
                        key.quotaErrorAt
                          ? styles.badgeRed
                          : key.isEnabled
                            ? styles.badgeGreen
                            : ""
                      }`}
                    >
                      {key.quotaErrorAt ? "Quota 초과" : key.isEnabled ? "활성" : "비활성"}
                    </span>
                  </div>
                  <div className={styles.llmKeyActions}>
                    <button
                      className={styles.editBtn}
                      type="button"
                      onClick={() => { void handleToggle(key); }}
                    >
                      {key.isEnabled ? "비활성화" : "활성화"}
                    </button>
                    <button
                      className={styles.deleteBtn}
                      type="button"
                      onClick={() => { void handleDelete(key.id); }}
                      aria-label="Delete key"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        <form className={styles.form} onSubmit={(e) => { void handleAdd(e); }}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>라벨 (식별용)</span>
            <input
              className={styles.input}
              value={label}
              onChange={(e) => { setLabel(e.target.value); }}
              placeholder="gemini-free-01"
            />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>API 키</span>
            <input
              className={styles.input}
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); }}
              placeholder="AIza..."
              type="password"
            />
          </label>

          {error && <p className={styles.formError}>{error}</p>}

          <button className={styles.submitBtn} type="submit" disabled={submitting}>
            {submitting ? <span className={styles.spinner} /> : "키 추가"}
          </button>
        </form>
      </div>
    </div>
  );
}
