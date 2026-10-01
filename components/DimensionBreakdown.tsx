import type { ConfusionMatrix, DimensionCorrectness } from "@/lib/dimensionMetrics";
import { MetricComparisonTable, type MetricRowData } from "@/components/MetricComparisonTable";

function percent(matches: number, total: number): string {
  return `${matches}/${total}（${((matches / total) * 100).toFixed(0)}%）`;
}

/** One provider's matrix: rows are the correct answer, columns are what the
 * provider said. The diagonal is "got it right" — a matrix that isn't
 * concentrated on the diagonal is the interesting one. */
function Matrix({ matrix, side }: { matrix: ConfusionMatrix; side: "jev" | "gemini" }) {
  const cells = side === "jev" ? matrix.jev : matrix.gemini;
  const maxCount = Math.max(1, ...cells.map((c) => c.count));

  return (
    <div className="min-w-0">
      <p className="text-xs text-[var(--text-muted)] mb-1.5">
        {side === "jev" ? "Jev" : "Gemini"}
      </p>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="text-[var(--text-muted)]">
            <th className="text-left font-normal p-1">正確＼判斷</th>
            {matrix.categories.map((category) => (
              <th key={category} className="font-normal p-1 text-center whitespace-nowrap">
                {category}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.categories.map((actual) => (
            <tr key={actual}>
              <td className="p-1 text-[var(--text-muted)] whitespace-nowrap">{actual}</td>
              {matrix.categories.map((predicted) => {
                const count = cells.find((c) => c.actual === actual && c.predicted === predicted)?.count ?? 0;
                const isDiagonal = actual === predicted;
                // Empty cells stay plain so the populated ones carry the signal;
                // intensity scales with count against the matrix's own busiest
                // cell. The floor is high because the light-mode tints are
                // already pale — fading them further would make a count of 1
                // indistinguishable from an empty cell.
                const style =
                  count === 0
                    ? { borderColor: "var(--border)" }
                    : {
                        backgroundColor: isDiagonal ? "var(--accent-soft)" : "var(--neutral-flag)",
                        borderColor: isDiagonal ? "var(--accent-soft-border)" : "var(--neutral-flag-border)",
                        opacity: 0.7 + 0.3 * (count / maxCount),
                      };
                return (
                  <td key={predicted} className="p-0.5">
                    <div
                      className="rounded border text-center py-1 font-mono-data"
                      style={style}
                    >
                      {count || "·"}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Per-dimension correctness plus a confusion matrix per dimension — the
 * aggregate number alone can't tell you *which* dimension a provider is losing
 * on, or which pair of categories it keeps mixing up. */
export function DimensionBreakdown({
  breakdown,
  confusionMatrices,
}: {
  breakdown: DimensionCorrectness[];
  confusionMatrices: ConfusionMatrix[];
}) {
  if (breakdown.length === 0) return null;

  const rows: MetricRowData[] = breakdown.map((d) => ({
    label: `${d.label}${d.goldenCoverage > 0 ? `（${d.goldenCoverage} 筆有黃金答案）` : ""}`,
    jevValue: percent(d.jevMatches, d.total),
    geminiValue: percent(d.geminiMatches, d.total),
    ratioTimes:
      d.geminiMatches === 0 ? (d.jevMatches === 0 ? 1 : Infinity) : d.jevMatches / d.geminiMatches,
    winner: d.winner,
  }));

  return (
    <div className="border-t border-[var(--border)]">
      <div className="px-3 pt-3">
        <h4 className="text-sm font-medium">各維度拆解</h4>
      </div>

      <MetricComparisonTable rows={rows} />

      {confusionMatrices.length > 0 && (
        <details className="px-3 py-3 border-t border-[var(--border)]">
          <summary className="text-xs text-[var(--text-muted)] cursor-pointer">
            混淆矩陣（誰把什麼判成什麼）
          </summary>
          <div className="mt-3 space-y-5">
            {confusionMatrices.map((matrix) => (
              <div key={matrix.dimension} className="space-y-2">
                <p className="text-xs">
                  {matrix.label}
                  <span className="text-[var(--text-muted)]">（{matrix.total} 筆已定案）</span>
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-x-auto">
                  <Matrix matrix={matrix} side="jev" />
                  <Matrix matrix={matrix} side="gemini" />
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
