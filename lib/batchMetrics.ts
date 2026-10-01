import type { AnalyzeResponse, Judgment } from "@/lib/schema";
import { buildComparisonRows } from "@/lib/compareResults";
import {
  compareLowerIsBetter,
  computeCorrectness,
  type MetricComparison,
  type CorrectnessScore,
} from "@/lib/providerMetrics";
import {
  computeConfusionMatrices,
  computeDimensionBreakdown,
  type ConfusionMatrix,
  type DimensionCorrectness,
} from "@/lib/dimensionMetrics";

const SCALE_COUNT = 1_000_000;

export interface BatchAggregate {
  count: number;
  jevTotalCostUsd: number;
  geminiTotalCostUsd: number;
  jevAvgCostUsd: number;
  geminiAvgCostUsd: number;
  costComparison: MetricComparison;
  /** null when no article has a latency figure on both sides — e.g. every
   * completed article went through Gemini's async batch API, which has no
   * meaningful per-call latency to compare. */
  latency: {
    jevAvgLatencyMs: number;
    geminiAvgLatencyMs: number;
    speedComparison: MetricComparison;
  } | null;
  correctness: CorrectnessScore;
  /** The same correctness, split per dimension so one strong dimension can't
   * mask a weak one. */
  dimensionBreakdown: DimensionCorrectness[];
  confusionMatrices: ConfusionMatrix[];
  scaleProjection: {
    count: number;
    jev: { totalCostUsd: number; sequentialLatencyMs: number | null };
    gemini: { totalCostUsd: number; sequentialLatencyMs: number | null };
  };
}

export interface BatchResultWithJudgment {
  result: AnalyzeResponse;
  judgment: Judgment;
  /** Known-correct answers for this article, if it's in the golden set. Looked
   * up by the caller — this module stays pure and free of localStorage. */
  golden?: Judgment;
}

/** Aggregates a batch of single-article results into totals/averages and an
 * overall correctness score, then projects the *empirical* average cost/latency
 * to scale (a far better estimate than extrapolating from one sample). Returns
 * null when no article completed successfully on both providers. Cost and
 * correctness only need both providers to have answered; latency is tracked
 * separately since it's not always available (Gemini's batch API has none). */
export function aggregateBatchResults(entries: BatchResultWithJudgment[]): BatchAggregate | null {
  const succeeded = entries.filter(
    (e): e is BatchResultWithJudgment & {
      result: AnalyzeResponse & {
        jev: Required<Pick<AnalyzeResponse["jev"], "costUsd">>;
        gemini: Required<Pick<AnalyzeResponse["gemini"], "costUsd">>;
      };
    } =>
      e.result.jev.ok &&
      e.result.gemini.ok &&
      e.result.jev.costUsd !== undefined &&
      e.result.gemini.costUsd !== undefined
  );
  if (succeeded.length === 0) return null;

  const count = succeeded.length;
  const jevTotalCostUsd = succeeded.reduce((sum, e) => sum + e.result.jev.costUsd, 0);
  const geminiTotalCostUsd = succeeded.reduce((sum, e) => sum + e.result.gemini.costUsd, 0);
  const jevAvgCostUsd = jevTotalCostUsd / count;
  const geminiAvgCostUsd = geminiTotalCostUsd / count;

  const latencyPairs = succeeded.filter(
    (e): e is typeof e & { result: { jev: { latencyMs: number }; gemini: { latencyMs: number } } } =>
      e.result.jev.latencyMs !== undefined && e.result.gemini.latencyMs !== undefined
  );
  const latencyAverages =
    latencyPairs.length > 0
      ? {
          jevAvgLatencyMs: latencyPairs.reduce((sum, e) => sum + e.result.jev.latencyMs, 0) / latencyPairs.length,
          geminiAvgLatencyMs:
            latencyPairs.reduce((sum, e) => sum + e.result.gemini.latencyMs, 0) / latencyPairs.length,
        }
      : null;

  const comparisonRows = succeeded.flatMap((e) =>
    buildComparisonRows(e.result, e.judgment, e.golden)
  );
  const correctness = computeCorrectness(comparisonRows);

  return {
    count,
    jevTotalCostUsd,
    geminiTotalCostUsd,
    jevAvgCostUsd,
    geminiAvgCostUsd,
    costComparison: compareLowerIsBetter(jevAvgCostUsd, geminiAvgCostUsd),
    latency: latencyAverages
      ? {
          ...latencyAverages,
          speedComparison: compareLowerIsBetter(
            latencyAverages.jevAvgLatencyMs,
            latencyAverages.geminiAvgLatencyMs
          ),
        }
      : null,
    correctness,
    dimensionBreakdown: computeDimensionBreakdown(comparisonRows),
    confusionMatrices: computeConfusionMatrices(comparisonRows),
    scaleProjection: {
      count: SCALE_COUNT,
      jev: {
        totalCostUsd: jevAvgCostUsd * SCALE_COUNT,
        sequentialLatencyMs: latencyAverages ? latencyAverages.jevAvgLatencyMs * SCALE_COUNT : null,
      },
      gemini: {
        totalCostUsd: geminiAvgCostUsd * SCALE_COUNT,
        sequentialLatencyMs: latencyAverages ? latencyAverages.geminiAvgLatencyMs * SCALE_COUNT : null,
      },
    },
  };
}
