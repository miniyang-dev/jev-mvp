import type { AnalyzeResponse, Judgment } from "@/lib/schema";
import { buildComparisonRows } from "@/lib/compareResults";
import { compareLowerIsBetter, computeCorrectness, projectAtScale } from "@/lib/providerMetrics";
import { formatUsd, formatDuration, formatSavingsPercent } from "@/lib/format";
import { MetricComparisonTable, type MetricRowData } from "@/components/MetricComparisonTable";

const SCALE_COUNT = 1_000_000;

export function SummaryAnalysis({ data, judgment }: { data: AnalyzeResponse; judgment: Judgment }) {
  const { jev, gemini } = data;
  if (!jev.ok || !gemini.ok) return null;
  if (jev.costUsd === undefined || gemini.costUsd === undefined) return null;
  if (jev.latencyMs === undefined || gemini.latencyMs === undefined) return null;

  const rows = buildComparisonRows(data, judgment);
  const correctness = computeCorrectness(rows);
  const cost = compareLowerIsBetter(jev.costUsd, gemini.costUsd);
  const speed = compareLowerIsBetter(jev.latencyMs, gemini.latencyMs);

  const jevScale = projectAtScale(
    { costUsd: jev.costUsd, latencyMs: jev.latencyMs },
    SCALE_COUNT
  );
  const geminiScale = projectAtScale(
    { costUsd: gemini.costUsd, latencyMs: gemini.latencyMs },
    SCALE_COUNT
  );
  const costDiffAtScale = Math.abs(jevScale.totalCostUsd - geminiScale.totalCostUsd);

  const metricRows: MetricRowData[] = [
    {
      label: "成本 / 次",
      jevValue: `$${jev.costUsd.toFixed(6)}`,
      geminiValue: `$${gemini.costUsd.toFixed(6)}`,
      ratioTimes: cost.ratioTimes,
      winner: cost.winner,
    },
    {
      label: "延遲",
      jevValue: `${jev.latencyMs.toFixed(0)}ms`,
      geminiValue: `${gemini.latencyMs.toFixed(0)}ms`,
      ratioTimes: speed.ratioTimes,
      winner: speed.winner,
    },
  ];
  if (correctness.total > 0) {
    metricRows.push({
      label: "正確性",
      jevValue: `${correctness.jevMatches}/${correctness.total}`,
      geminiValue: `${correctness.geminiMatches}/${correctness.total}`,
      ratioTimes:
        correctness.geminiMatches === 0
          ? correctness.jevMatches === 0
            ? 1
            : Infinity
          : correctness.jevMatches / correctness.geminiMatches,
      winner: correctness.winner,
    });
  }

  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      <div className="px-3 pt-3">
        <h3 className="text-sm font-medium">整體比較</h3>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          一致自動算對，不一致需裁定
        </p>
      </div>
      <MetricComparisonTable rows={metricRows} />

      <div className="px-3 py-3 border-t border-[var(--border)]">
        <p className="text-xs text-[var(--text-muted)] mb-2">
          若有 {SCALE_COUNT.toLocaleString("en-US")} 筆查詢（線性外推粗估）
        </p>
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-b border-[var(--border)]">
              <td className="px-3 py-2 text-[var(--text-muted)]">總成本</td>
              <td className="px-3 py-2 font-mono-data">{formatUsd(jevScale.totalCostUsd)}</td>
              <td className="px-3 py-2 font-mono-data">{formatUsd(geminiScale.totalCostUsd)}</td>
              <td className="px-3 py-2 font-mono-data">
                相差 {formatUsd(costDiffAtScale)}（省 {formatSavingsPercent(jevScale.totalCostUsd, geminiScale.totalCostUsd)}）
              </td>
            </tr>
            <tr>
              <td className="px-3 py-2 text-[var(--text-muted)]">依序執行總耗時</td>
              <td className="px-3 py-2 font-mono-data">{formatDuration(jevScale.sequentialLatencyMs)}</td>
              <td className="px-3 py-2 font-mono-data">{formatDuration(geminiScale.sequentialLatencyMs)}</td>
              <td className="px-3 py-2 text-[var(--text-muted)]">上限估計（實務會平行）</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
