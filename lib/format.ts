export function formatUsd(value: number): string {
  if (value !== 0 && Math.abs(value) < 0.01) {
    return `$${value.toFixed(6)}`;
  }
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

/** How much cheaper the lower of two costs is, as a percentage of the higher
 * one — i.e. "switching from the pricier option saves you X%". */
export function formatSavingsPercent(costA: number, costB: number): string {
  const lower = Math.min(costA, costB);
  const higher = Math.max(costA, costB);
  if (higher === 0) return "0%";
  return `${(((higher - lower) / higher) * 100).toFixed(1)}%`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}秒`;
  if (ms < 3_600_000) return `${(ms / 60_000).toFixed(1)}分鐘`;
  if (ms < 86_400_000) return `${(ms / 3_600_000).toFixed(1)}小時`;
  return `${(ms / 86_400_000).toFixed(1)}天`;
}
