import { formatDuration, formatUsd } from "@/lib/format";
import type { SweepCorrectness, SweepStability, SweepSummary } from "@/lib/sweepMetrics";

function Fraction({ value, total }: { value: number; total: number }) {
  return (
    <span className="font-mono-data">
      {value}/{total}（{((value / total) * 100).toFixed(0)}%）
    </span>
  );
}

function CorrectnessCell({ correctness }: { correctness: SweepCorrectness | null }) {
  // Deliberately not 0% — "nothing to compare against" and "got everything
  // wrong" are different answers to a model-selection question.
  if (!correctness) return <span className="text-[var(--text-muted)]">無法計算</span>;
  return <Fraction value={correctness.correct} total={correctness.total} />;
}

function StabilityCell({ stability }: { stability: SweepStability | null }) {
  if (!stability) return <span className="text-[var(--text-muted)]">—</span>;
  return <Fraction value={stability.consistent} total={stability.total} />;
}

/** Jev and every Gemini model are scored the exact same way — against the
 * golden set only — so they sit in one plain, cost-sorted list. No entrant is
 * the judge of another; this tool's whole point is comparing which is best. */
export function SweepResultsTable({ summary }: { summary: SweepSummary }) {
  const rows = [...summary.entrants].sort((a, b) => a.avgCostUsd - b.avgCostUsd);
  const showStability = summary.repeats > 1;

  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      <div className="px-3 pt-3">
        <h3 className="text-sm font-medium">各模型結果（依平均成本由低到高）</h3>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          正確率只以黃金答案計分，沒有覆蓋的維度不計入。
          {showStability &&
            ` 穩定度＝同一題 ${summary.repeats} 次答案都一樣的比例。`}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-t border-[var(--border)] text-xs text-[var(--text-muted)]">
              <th className="text-left font-normal px-3 py-2">模型</th>
              <th className="text-left font-normal px-3 py-2">平均成本／次</th>
              <th className="text-left font-normal px-3 py-2">平均延遲</th>
              <th className="text-left font-normal px-3 py-2">正確率</th>
              {showStability && <th className="text-left font-normal px-3 py-2">穩定度</th>}
              <th className="text-left font-normal px-3 py-2">成功／失敗（次）</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className={`border-b border-[var(--border)] last:border-0 ${
                  row.isJev ? "bg-[var(--neutral-flag)]" : ""
                }`}
              >
                <td className="px-3 py-2">{row.displayName}</td>
                <td className="px-3 py-2 font-mono-data">{formatUsd(row.avgCostUsd)}</td>
                <td className="px-3 py-2 font-mono-data">
                  {row.avgLatencyMs === null ? "—" : formatDuration(row.avgLatencyMs)}
                </td>
                <td className="px-3 py-2">
                  <CorrectnessCell correctness={row.correctness} />
                </td>
                {showStability && (
                  <td className="px-3 py-2">
                    <StabilityCell stability={row.stability} />
                  </td>
                )}
                <td className="px-3 py-2 font-mono-data">
                  {row.okCount}／{row.failedCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="px-3 py-3 border-t border-[var(--border)] text-xs text-[var(--text-muted)]">
        黃金答案覆蓋 {summary.goldenCoveredArticles} 篇。到批次分析裁定或載入對抗測試包可提高覆蓋。
      </p>
    </div>
  );
}
