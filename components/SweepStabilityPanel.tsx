import type { SweepSummary } from "@/lib/sweepMetrics";

/** Where each entrant changed its answer between runs of the exact same
 * question — the per-question detail behind the table's 穩定度 column. */
export function SweepStabilityPanel({ summary }: { summary: SweepSummary }) {
  const entrants = summary.entrants.filter((e) => e.stability !== null);
  if (entrants.length === 0) return null;

  const ranked = [...entrants].sort(
    (a, b) =>
      b.stability!.consistent / b.stability!.total - a.stability!.consistent / a.stability!.total
  );

  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
      <div className="space-y-1">
        <h3 className="text-sm font-medium">回應穩定度（每篇重複 {summary.repeats} 次）</h3>
        <p className="text-xs text-[var(--text-muted)]">
          同一題問 {summary.repeats} 次，只要一次不同即不穩定（只計成功的回應）。穩定不等於正確。
        </p>
      </div>

      <div className="space-y-2">
        {ranked.map((entrant) => {
          const { consistent, total, unstable } = entrant.stability!;
          return (
            <details key={entrant.id} className="border-t border-[var(--border)] pt-2">
              <summary className="text-sm cursor-pointer flex flex-wrap items-center gap-2">
                <span className={entrant.isJev ? "font-medium" : ""}>{entrant.displayName}</span>
                <span className="font-mono-data text-xs text-[var(--text-muted)]">
                  {consistent}/{total} 題完全一致（{((consistent / total) * 100).toFixed(0)}%）
                </span>
                {unstable.length === 0 && (
                  <span className="inline-block rounded px-2 py-0.5 text-xs bg-[var(--accent-soft)] border border-[var(--accent-soft-border)]">
                    每次都一樣
                  </span>
                )}
              </summary>

              {unstable.length > 0 && (
                <table className="w-full text-xs mt-2">
                  <thead>
                    <tr className="text-[var(--text-muted)]">
                      <th className="text-left font-normal py-1 pr-3">文章</th>
                      <th className="text-left font-normal py-1 pr-3">維度</th>
                      <th className="text-left font-normal py-1">{summary.repeats} 次的答案</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unstable.map((item) => (
                      <tr key={`${item.articleId}-${item.dimension}`} className="border-t border-[var(--border)]">
                        <td className="py-1.5 pr-3 max-w-[16rem] truncate" title={item.textPreview}>
                          {item.textPreview}
                        </td>
                        <td className="py-1.5 pr-3 whitespace-nowrap text-[var(--text-muted)]">
                          {item.dimensionLabel}
                        </td>
                        <td className="py-1.5">
                          <div className="flex flex-wrap gap-1">
                            {item.distribution.map((d) => (
                              <span
                                key={d.label}
                                className="inline-block rounded px-1.5 py-0.5 border border-[var(--border)] font-mono-data"
                              >
                                {d.label} ×{d.count}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </details>
          );
        })}
      </div>
    </div>
  );
}
