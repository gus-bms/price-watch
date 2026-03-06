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

export function WatchItemCard({ item, checking, onCheck, onEdit, onDelete }: WatchItemCardProps) {
  const isOutOfStock = item.isOutOfStock === true;
  const isBelowTarget = item.lastPrice !== undefined && item.lastPrice <= item.targetPrice && !isOutOfStock;

  const badgeClassName = `${styles.badge} ${
    item.lastError
      ? styles.badgeRed
      : isOutOfStock
        ? styles.badgeRed
        : isBelowTarget
          ? styles.badgeGreen
          : ""
  }`;

  const badgeText = item.lastError
    ? "오류"
    : isOutOfStock
      ? "재입고 대기중"
      : isBelowTarget
        ? "목표가 도달!"
        : "가격 추적중";

  // 사이즈별 재고 요약
  const sizeStockSummary = item.sizeStockJson
    ? Object.entries(item.sizeStockJson)
        .map(([s, inStock]) => `${s}:${inStock ? "O" : "X"}`)
        .join(" ")
    : null;

  const cardClassName = `${styles.card} ${item.lastError ? styles.cardError : isOutOfStock ? styles.cardSoldOut : ""}`;

  return (
    <article className={cardClassName}>
      <button
        className={`${styles.deleteBtn} ${styles.cardDeleteBtn}`}
        onClick={() => { onDelete(item.id); }}
        type="button"
        aria-label="Delete item"
      >
        ×
      </button>

      <div className={styles.cardTop}>
        <div>
          <h3 className={styles.cardName}>{item.name}</h3>
          {item.size && (
            <span className={styles.sizeTag}>사이즈: {item.size}</span>
          )}
        </div>
        <span className={badgeClassName}>{badgeText}</span>
      </div>

      <div className={styles.prices}>
        <div className={styles.priceCol}>
          <span className={styles.priceLabel}>Current</span>
          <span className={styles.priceCurrent}>
            {item.lastPrice !== undefined ? formatMoney(item.lastPrice, item.currency) : "--"}
          </span>
        </div>
        <div className={styles.priceDivider} />
        <div className={styles.priceCol}>
          <span className={styles.priceLabel}>Target</span>
          <span className={styles.priceTarget}>{formatMoney(item.targetPrice, item.currency)}</span>
        </div>
      </div>

      {sizeStockSummary && (
        <p className={styles.sizeStockRow}>
          <span className={styles.sizeStockLabel}>재고</span>
          <span className={styles.sizeStockValue}>{sizeStockSummary}</span>
        </p>
      )}

      {item.lastError && <p className={styles.errorMsg}>{item.lastError}</p>}

      <div className={styles.cardMeta}>
        <span>{item.lastCheckedAt ? `Checked ${formatTime(item.lastCheckedAt)}` : "Not checked yet"}</span>
        <span className={styles.parserHint}>
          {item.lastMatchedPattern
            ? `Matched: /${item.lastMatchedPattern}/`
            : `${item.parser.patterns.length} pattern(s)`}
        </span>
      </div>

      {item.matchConfidence === "low" && (
        <p className={styles.matchNoteWarn}>
          Fallback pattern matched{item.fallbackVerified ? " (rechecked)" : ""}
        </p>
      )}
      {item.matchConfidence === "medium" && (
        <p className={styles.matchNoteInfo}>Secondary pattern matched</p>
      )}

      <div className={styles.cardActions}>
        <button
          className={styles.checkBtn}
          onClick={() => { onCheck(item.id); }}
          disabled={checking}
          type="button"
        >
          {checking ? <span className={styles.spinner} /> : "Check now"}
        </button>

        <a className={styles.linkBtn} href={item.url} target="_blank" rel="noreferrer">
          Visit
        </a>

        <button className={styles.editBtn} onClick={() => { onEdit(item.id); }} type="button">
          Edit
        </button>
      </div>
    </article>
  );
}
