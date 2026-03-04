import { useMemo, useState } from "react";
import styles from "./App.module.css";
import { AddItemModal } from "./features/watch-item/components/AddItemModal";
import { LlmKeysModal } from "./features/watch-item/components/LlmKeysModal";
import { WatchItemCard } from "./features/watch-item/components/WatchItemCard";
import { useWatchItems } from "./features/watch-item/hooks/use-watch-items";
import { type WatchItem } from "./features/watch-item/model/types";

export default function App() {
  const {
    items,
    checking,
    loading,
    loadError,
    createItem,
    updateItem,
    deleteItem,
    checkItem
  } = useWatchItems();

  const [showForm, setShowForm] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [showLlmKeys, setShowLlmKeys] = useState(false);

  const editingItem = useMemo(
    () => editingItemId ? items.find((item) => item.id === editingItemId) ?? null : null,
    [editingItemId, items]
  );

  const belowTarget = useMemo(
    () => items.filter((item) => item.lastPrice !== undefined && item.lastPrice <= item.targetPrice).length,
    [items]
  );
  const withErrors = useMemo(() => items.filter((item) => item.lastError).length, [items]);
  const outOfStock = useMemo(
    () => items.filter((item) => item.isOutOfStock === true).length,
    [items]
  );

  function openCreateModal() { setEditingItemId(null); setShowForm(true); }
  function openEditModal(itemId: string) { setEditingItemId(itemId); setShowForm(true); }
  function closeModal() { setShowForm(false); setEditingItemId(null); }

  function handleSubmit(item: WatchItem) {
    const action = editingItemId ? updateItem(item) : createItem(item);
    void action.then(() => { closeModal(); }).catch((error) => {
      window.alert(error instanceof Error ? error.message : String(error));
    });
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.shell}>Loading...</div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.logo}>Price Watch</h1>
            <p className={styles.tagline}>React UI + MySQL-backed API</p>
            {loadError && <p className={styles.errorMsg}>{loadError}</p>}
          </div>
          <div className={styles.headerActions}>
            <button className={styles.llmKeysBtn} onClick={() => { setShowLlmKeys(true); }} type="button">
              Gemini 키
            </button>
            <button className={styles.addBtn} onClick={openCreateModal} type="button">
              <span className={styles.addIcon}>+</span>
              Add item
            </button>
          </div>
        </header>

        {items.length > 0 && (
          <div className={styles.stats}>
            <div className={styles.stat}>
              <span className={styles.statValue}>{items.length}</span>
              <span className={styles.statLabel}>Tracking</span>
            </div>
            <div className={styles.stat}>
              <span className={`${styles.statValue} ${styles.statGreen}`}>{belowTarget}</span>
              <span className={styles.statLabel}>Below target</span>
            </div>
            <div className={styles.stat}>
              <span className={`${styles.statValue} ${outOfStock > 0 ? styles.statRed : ""}`}>{outOfStock}</span>
              <span className={styles.statLabel}>품절</span>
            </div>
            <div className={styles.stat}>
              <span className={`${styles.statValue} ${withErrors > 0 ? styles.statRed : ""}`}>{withErrors}</span>
              <span className={styles.statLabel}>Errors</span>
            </div>
          </div>
        )}

        {items.length === 0 ? (
          <div className={styles.empty}>
            <h2 className={styles.emptyTitle}>No items yet</h2>
            <p className={styles.emptyText}>Add a product URL and parser pattern to start tracking.</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {items.map((item) => (
              <WatchItemCard
                key={item.id}
                item={item}
                checking={checking.has(item.id)}
                onCheck={(itemId) => { void checkItem(itemId); }}
                onEdit={openEditModal}
                onDelete={(itemId) => { void deleteItem(itemId); }}
              />
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <AddItemModal
          mode={editingItemId ? "edit" : "create"}
          initialItem={editingItem}
          onSubmit={handleSubmit}
          onClose={closeModal}
        />
      )}

      {showLlmKeys && <LlmKeysModal onClose={() => { setShowLlmKeys(false); }} />}
    </div>
  );
}
