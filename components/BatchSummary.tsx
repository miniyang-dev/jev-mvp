import type { BatchAggregate } from "@/lib/batchMetrics";
import { formatUsd, formatDuration, formatSavingsPercent } from "@/lib/format";
import { MetricComparisonTable, type MetricRowData } from "@/components/MetricComparisonTable";
import { DimensionBreakdown } from "@/components/DimensionBreakdown";

export function BatchSummary({ aggregate }: { aggregate: BatchAggregate }) {
  const { count, correctness, costComparison, latency, scaleProjection } = aggregate;

  const metricRows: MetricRowData[] = [
    {
      label: "平均成本 / 篇",
      jevValue: `$${aggregate.jevAvgCostUsd.toFixed(6)}`,
      geminiValue: `$${aggregate.geminiAvgCostUsd.toFixed(6)}`,
      ratioTimes: costComparison.ratioTimes,
      winner: costComparison.winner,
    },
  ];
  if (latency) {
    metricRows.push({
      label: "平均延遲 / 篇",
      jevValue: `${latency.jevAvgLatencyMs.toFixed(0)}ms`,
      geminiValue: `${latency.geminiAvgLatencyMs.toFixed(0)}ms`,
      ratioTimes: latency.speedComparison.ratioTimes,
      winner: latency.speedComparison.winner,
    });
  }
  if (correctness.total > 0) {
    metricRows.push({
      label: `正確性（${count} 篇合計）`,
      jevValue: `${correctness.jevMatches}/${correctness.total}（${((correctness.jevMatches / correctness.total) * 100).toFixed(0)}%）`,
      geminiValue: `${correctness.geminiMatches}/${correctness.total}（${((correctness.geminiMatches / correctness.total) * 100).toFixed(0)}%）`,
      ratioTimes:
        correctness.geminiMatches === 0
          ? correctness.jevMatches === 0
            ? 1
            : Infinity
          : correctness.jevMatches / correctness.geminiMatches,
      winner: correctness.winner,
    });
  }

  const totalCostDiff = Math.abs(aggregate.jevTotalCostUsd - aggregate.geminiTotalCostUsd);
  const scaleCostDiff = Math.abs(scaleProjection.jev.totalCostUsd - scaleProjection.gemini.totalCostUsd);

  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      <div className="px-3 pt-3">
        <h3 className="text-sm font-medium">批次彙總（{count} 篇成功完成）</h3>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          以黃金答案為準；沒有的話，一致自動算對、不一致需裁定
          {latency ? "" : "。Batch 模式沒有延遲數據"}
        </p>
      </div>
      <MetricComparisonTable rows={metricRows} />

      <DimensionBreakdown
        breakdown={aggregate.dimensionBreakdown}
        confusionMatrices={aggregate.confusionMatrices}
      />

      <div className="px-3 py-3 border-t border-[var(--border)]">
        <p className="text-xs text-[var(--text-muted)] mb-2">這 {count} 篇的實際總成本</p>
        <table className="w-full text-sm">
          <tbody>
            <tr>
              <td className="px-3 py-2 text-[var(--text-muted)]">總成本</td>
              <td className="px-3 py-2 font-mono-data">{formatUsd(aggregate.jevTotalCostUsd)}</td>
              <td className="px-3 py-2 font-mono-data">{formatUsd(aggregate.geminiTotalCostUsd)}</td>
              <td className="px-3 py-2 font-mono-data">
                相差 {formatUsd(totalCostDiff)}（省 {formatSavingsPercent(aggregate.jevTotalCostUsd, aggregate.geminiTotalCostUsd)}）
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="px-3 py-3 border-t border-[var(--border)]">
        <p className="text-xs text-[var(--text-muted)] mb-2">
          若有 {scaleProjection.count.toLocaleString("en-US")} 筆查詢（依這批平均值線性外推）
        </p>
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-b border-[var(--border)]">
              <td className="px-3 py-2 text-[var(--text-muted)]">總成本</td>
              <td className="px-3 py-2 font-mono-data">{formatUsd(scaleProjection.jev.totalCostUsd)}</td>
              <td className="px-3 py-2 font-mono-data">{formatUsd(scaleProjection.gemini.totalCostUsd)}</td>
              <td className="px-3 py-2 font-mono-data">
                相差 {formatUsd(scaleCostDiff)}（省{" "}
                {formatSavingsPercent(scaleProjection.jev.totalCostUsd, scaleProjection.gemini.totalCostUsd)}）
              </td>
            </tr>
            {latency && scaleProjection.jev.sequentialLatencyMs !== null && scaleProjection.gemini.sequentialLatencyMs !== null && (
              <tr>
                <td className="px-3 py-2 text-[var(--text-muted)]">依序執行總耗時</td>
                <td className="px-3 py-2 font-mono-data">{formatDuration(scaleProjection.jev.sequentialLatencyMs)}</td>
                <td className="px-3 py-2 font-mono-data">{formatDuration(scaleProjection.gemini.sequentialLatencyMs)}</td>
                <td className="px-3 py-2 text-[var(--text-muted)]">上限估計（實務會平行）</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
