import styles from "../../../App.module.css";
import { formatMoney, formatTime } from "../../../shared/lib/formatters";
import { type WatchItem } from "../model/types";

type WatchItemCardProps = {
  item: WatchItem;
  checking: boolean;
  onCheck: (itemId: string) => void;
  onEdit: (itemId: string) => void;
  onDelete: (itemId: string) => void;
};

export function WatchItemCard({
  item,
  checking,
  onCheck,
  onEdit,
  onDelete
}: WatchItemCardProps) {
  const isSoldOut = item.lastInStock === false;

  const badgeClassName = `${styles.badge} ${
    isSoldOut
      ? styles.badgeRed
      : item.lastError
        ? styles.badgeRed
        : item.lastPrice !== undefined && item.lastPrice <= item.targetPrice
          ? styles.badgeGreen
          : ""
  }`;

  const badgeText = isSoldOut
    ? "Sold Out"
    : item.lastError
      ? "Error"
      : item.lastPrice !== undefined && item.lastPrice <= item.targetPrice
        ? "Below target"
        : "Watching";

  return (
    <article className={`${styles.card} ${isSoldOut || item.lastError ? styles.cardError : ""}`}>
      <div className={styles.cardTop}>
        <h3 className={styles.cardName}>{item.name}</h3>
        <span className={badgeClassName}>{badgeText}</span>
      </div>

      <div className={`${styles.prices} ${isSoldOut ? styles.pricesDimmed : ""}`}>
        <div className={styles.priceCol}>
          <span className={styles.priceLabel}>Current</span>
          <span className={styles.priceCurrent}>
            {isSoldOut || item.lastPrice === undefined
              ? "--"
              : formatMoney(item.lastPrice, item.currency)}
          </span>
        </div>
        <div className={styles.priceDivider} />
        <div className={styles.priceCol}>
          <span className={styles.priceLabel}>Target</span>
          <span className={styles.priceTarget}>{formatMoney(item.targetPrice, item.currency)}</span>
        </div>
      </div>

      <div className={styles.cardBody}>
        {isSoldOut && (
          <p className={styles.matchNoteWarn}>
            재고 없음 — 재입고 시 알림을 보냅니다
          </p>
        )}

        {!isSoldOut && item.lastError && (
          <p className={styles.errorMsg}>{item.lastError}</p>
        )}

        {!isSoldOut && item.matchConfidence === "low" && (
          <p className={styles.matchNoteWarn}>
            Fallback pattern matched{item.fallbackVerified ? " (rechecked)" : ""}
          </p>
        )}

        {!isSoldOut && item.matchConfidence === "medium" && (
          <p className={styles.matchNoteInfo}>Secondary pattern matched</p>
        )}

        <div className={styles.cardMeta}>
          <span>{item.lastCheckedAt ? `Checked ${formatTime(item.lastCheckedAt)}` : "Not checked yet"}</span>
          <span className={styles.parserHint}>
            {item.lastMatchedPattern
              ? `Matched: /${item.lastMatchedPattern}/`
              : `${item.parser.patterns.length} pattern(s)`}
            {item.stockPatterns.length > 0 && ` · ${item.stockPatterns.length} stock pattern(s)`}
          </span>
        </div>
      </div>

      <div className={styles.cardActions}>
        <button
          className={styles.checkBtn}
          onClick={() => {
            onCheck(item.id);
          }}
          disabled={checking}
          type="button"
        >
          {checking ? <span className={styles.spinner} /> : "Check now"}
        </button>

        <a className={styles.linkBtn} href={item.url} target="_blank" rel="noreferrer">
          Visit
        </a>

        <button
          className={styles.editBtn}
          onClick={() => {
            onEdit(item.id);
          }}
          type="button"
        >
          Edit
        </button>

        <button
          className={styles.deleteBtn}
          onClick={() => {
            onDelete(item.id);
          }}
          type="button"
          aria-label="Delete item"
        >
          ×
        </button>
      </div>
    </article>
  );
}
