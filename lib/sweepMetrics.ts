import type { Dimension, Judgment, ProviderAnswers, ProviderResult } from "@/lib/schema";
import { REGION_LABELS, SENTIMENT_CATEGORY_LABELS } from "@/lib/labels";

export interface SweepCorrectness {
  correct: number;
  total: number;
}

/** One article × dimension where an entrant didn't give the same answer every
 * time it was asked. */
export interface UnstableItem {
  articleId: string;
  textPreview: string;
  dimension: Dimension;
  dimensionLabel: string;
  /** Every distinct answer it gave, most frequent first. */
  distribution: { label: string; count: number }[];
}

export interface SweepStability {
  /** Article × dimension pairs where every run gave the same answer. */
  consistent: number;
  /** Pairs with at least two successful runs to compare. */
  total: number;
  unstable: UnstableItem[];
}

export interface SweepEntrantSummary {
  id: string;
  displayName: string;
  isJev: boolean;
  /** Counted per call, not per article — with repeats these differ. */
  okCount: number;
  failedCount: number;
  avgCostUsd: number;
  avgLatencyMs: number | null;
  totalCostUsd: number;
  /** null when nothing could be scored at all — rendered as 無法計算, never as 0%. */
  correctness: SweepCorrectness | null;
  /** null when no article had two successful runs to compare (i.e. repeats = 1). */
  stability: SweepStability | null;
}

export interface SweepSummary {
  entrants: SweepEntrantSummary[];
  /** Articles that had at least one golden answer available. */
  goldenCoveredArticles: number;
  repeats: number;
}

export interface SweepEntrantInput {
  id: string;
  displayName: string;
  isJev: boolean;
  /** article id -> every run's result for that article. */
  runsByArticle: Record<string, ProviderResult[]>;
}

type AnswerValue = string | boolean;

const DIMENSION_LABELS: Record<Dimension, string> = {
  sentiment: "情緒強度",
  region: "地區",
  noise: "是否為雜訊",
};

function answerFor(answers: ProviderAnswers | undefined, dimension: Dimension): AnswerValue | undefined {
  if (!answers) return undefined;
  if (dimension === "sentiment") return answers.sentiment?.category;
  if (dimension === "region") return answers.region?.key;
  return answers.noise?.isNoise;
}

function judgedValue(judgment: Judgment | undefined, dimension: Dimension): AnswerValue | undefined {
  if (!judgment) return undefined;
  if (dimension === "sentiment") return judgment.sentiment;
  if (dimension === "region") return judgment.region;
  return judgment.noise;
}

function answerLabel(dimension: Dimension, value: AnswerValue): string {
  if (dimension === "sentiment") return SENTIMENT_CATEGORY_LABELS[value as keyof typeof SENTIMENT_CATEGORY_LABELS];
  if (dimension === "region") return REGION_LABELS[value as keyof typeof REGION_LABELS];
  return value ? "是" : "否";
}

function averages(results: ProviderResult[]) {
  const ok = results.filter((r) => r.ok);
  const costs = ok.map((r) => r.costUsd).filter((c): c is number => c !== undefined);
  const latencies = ok.map((r) => r.latencyMs).filter((l): l is number => l !== undefined);
  const totalCostUsd = costs.reduce((sum, c) => sum + c, 0);
  return {
    okCount: ok.length,
    failedCount: results.length - ok.length,
    totalCostUsd,
    avgCostUsd: costs.length > 0 ? totalCostUsd / costs.length : 0,
    avgLatencyMs:
      latencies.length > 0 ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length : null,
  };
}

export interface SummarizeSweepArgs {
  articles: { id: string; text: string }[];
  dimensions: Dimension[];
  entrants: SweepEntrantInput[];
  repeats: number;
  getGolden: (text: string) => Judgment | undefined;
}

/** Scores every selected entrant — Gemini models and Jev alike — on the same
 * article set, by the same two yardsticks:
 *
 * - **Correctness**, against the golden set and nothing else. No entrant is
 *   ever scored against another's output: if Jev is one of the things being
 *   judged, it can't also be the answer key. A dimension with no golden answer
 *   is excluded from every entrant's denominator — an honest 無法計算 rather
 *   than a stand-in. With repeats, every successful run is scored.
 * - **Stability**, which needs no answer key at all: asked the same thing N
 *   times, did it say the same thing N times? An article × dimension counts as
 *   stable only if every successful run agreed; one differing run is enough to
 *   make it unstable. */
export function summarizeSweep({
  articles,
  dimensions,
  entrants,
  repeats,
  getGolden,
}: SummarizeSweepArgs): SweepSummary {
  const goldenByArticle = new Map(articles.map((a) => [a.id, getGolden(a.text)]));

  const summarize = (entrant: SweepEntrantInput): SweepEntrantSummary => {
    const allRuns = articles.flatMap((a) => entrant.runsByArticle[a.id] ?? []);

    let correct = 0;
    let scored = 0;
    let consistent = 0;
    let comparable = 0;
    const unstable: UnstableItem[] = [];

    for (const article of articles) {
      const okRuns = (entrant.runsByArticle[article.id] ?? []).filter((r) => r.ok);
      const golden = goldenByArticle.get(article.id);

      for (const dimension of dimensions) {
        const given = okRuns
          .map((run) => answerFor(run.answers, dimension))
          .filter((v): v is AnswerValue => v !== undefined);

        const truth = judgedValue(golden, dimension);
        if (truth !== undefined) {
          scored += given.length;
          correct += given.filter((v) => v === truth).length;
        }

        if (given.length >= 2) {
          comparable += 1;
          const counts = new Map<AnswerValue, number>();
          for (const v of given) counts.set(v, (counts.get(v) ?? 0) + 1);
          if (counts.size === 1) {
            consistent += 1;
          } else {
            unstable.push({
              articleId: article.id,
              textPreview: article.text.trim().slice(0, 60),
              dimension,
              dimensionLabel: DIMENSION_LABELS[dimension],
              distribution: [...counts.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([value, count]) => ({ label: answerLabel(dimension, value), count })),
            });
          }
        }
      }
    }

    return {
      id: entrant.id,
      displayName: entrant.displayName,
      isJev: entrant.isJev,
      ...averages(allRuns),
      correctness: scored === 0 ? null : { correct, total: scored },
      stability: comparable === 0 ? null : { consistent, total: comparable, unstable },
    };
  };

  return {
    entrants: entrants.map(summarize),
    goldenCoveredArticles: articles.filter((a) =>
      dimensions.some((d) => judgedValue(goldenByArticle.get(a.id), d) !== undefined)
    ).length,
    repeats,
  };
}
