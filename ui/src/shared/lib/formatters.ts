export function formatMoney(value: number, currency?: string): string {
  if (!currency) {
    return value.toLocaleString("en-US");
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency
    }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

export function formatTime(timestamp: number): string {
  const diff = Date.now() - timestamp;

  if (diff < 60_000) {
    return "just now";
  }

  if (diff < 3_600_000) {
    return `${Math.floor(diff / 60_000)}m ago`;
  }

  if (diff < 86_400_000) {
    return `${Math.floor(diff / 3_600_000)}h ago`;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(timestamp));
}
