import type { Dimension } from "@/lib/schema";
import type { ComparisonRow } from "@/lib/compareResults";
import { REGION_KEYS, REGION_LABELS, SENTIMENT_CATEGORY_KEYS, SENTIMENT_CATEGORY_LABELS } from "@/lib/labels";
import type { Winner } from "@/lib/providerMetrics";

export interface DimensionCorrectness {
  dimension: Dimension;
  label: string;
  jevMatches: number;
  geminiMatches: number;
  /** Resolved rows for this dimension (the scoring denominator). */
  total: number;
  /** How many of those were settled by a golden answer rather than consensus/judgment. */
  goldenCoverage: number;
  winner: Winner;
}

const DIMENSION_ORDER: Dimension[] = ["sentiment", "region", "noise"];

/** The same correctness count as `computeCorrectness`, but kept per dimension
 * instead of flattened into one number — a 3-dimension, 10-article batch has a
 * denominator of up to 30, which hides "Jev wins on sentiment, Gemini wins on
 * region" completely. */
export function computeDimensionBreakdown(rows: ComparisonRow[]): DimensionCorrectness[] {
  const breakdown: DimensionCorrectness[] = [];

  for (const dimension of DIMENSION_ORDER) {
    const dimensionRows = rows.filter((r) => r.dimension === dimension);
    if (dimensionRows.length === 0) continue;

    const resolved = dimensionRows.filter((r) => r.jevMatch !== null && r.geminiMatch !== null);
    if (resolved.length === 0) continue;

    const jevMatches = resolved.filter((r) => r.jevMatch === true).length;
    const geminiMatches = resolved.filter((r) => r.geminiMatch === true).length;

    breakdown.push({
      dimension,
      label: dimensionRows[0].label,
      jevMatches,
      geminiMatches,
      total: resolved.length,
      goldenCoverage: resolved.filter((r) => r.truthSource === "golden").length,
      winner:
        jevMatches === geminiMatches ? "tie" : jevMatches > geminiMatches ? "jev" : "gemini",
    });
  }

  return breakdown;
}

export interface ConfusionCell {
  /** The resolved/correct answer's display label. */
  actual: string;
  /** What the provider said. */
  predicted: string;
  count: number;
}

export interface ConfusionMatrix {
  dimension: Dimension;
  label: string;
  /** Display labels, in a fixed order — the matrix axes. */
  categories: string[];
  jev: ConfusionCell[];
  gemini: ConfusionCell[];
  /** Rows that fed this matrix, i.e. the resolved ones for this dimension. */
  total: number;
}

/** Fixed axis labels per dimension, so the matrix keeps a stable shape even
 * when a category never appears in the data. */
function categoriesFor(dimension: Dimension): string[] {
  if (dimension === "sentiment") return SENTIMENT_CATEGORY_KEYS.map((k) => SENTIMENT_CATEGORY_LABELS[k]);
  if (dimension === "region") return REGION_KEYS.map((k) => REGION_LABELS[k]);
  return ["否", "是"];
}

/** "Who mistook 超級生氣 for 一般生氣" — a tally of each provider's answer
 * against the resolved correct answer. Built straight off `ComparisonRow`'s
 * already-localized label strings, which are 1:1 with the fixed label maps in
 * `lib/labels.ts`. Returns null when the dimension has no resolved rows. */
export function computeConfusionMatrix(
  dimension: Dimension,
  rows: ComparisonRow[]
): ConfusionMatrix | null {
  const resolved = rows.filter(
    (r) => r.dimension === dimension && r.resolvedLabel !== null && r.jevMatch !== null
  );
  if (resolved.length === 0) return null;

  const categories = categoriesFor(dimension);
  const tally = (pick: (row: ComparisonRow) => string): ConfusionCell[] => {
    const counts = new Map<string, number>();
    for (const row of resolved) {
      const key = `${row.resolvedLabel}\u0000${pick(row)}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return categories.flatMap((actual) =>
      categories.map((predicted) => ({
        actual,
        predicted,
        count: counts.get(`${actual}\u0000${predicted}`) ?? 0,
      }))
    );
  };

  return {
    dimension,
    label: resolved[0].label,
    categories,
    jev: tally((r) => r.jevValue),
    gemini: tally((r) => r.geminiValue),
    total: resolved.length,
  };
}

/** Every dimension that has enough resolved rows to draw a matrix. */
export function computeConfusionMatrices(rows: ComparisonRow[]): ConfusionMatrix[] {
  return DIMENSION_ORDER.map((d) => computeConfusionMatrix(d, rows)).filter(
    (m): m is ConfusionMatrix => m !== null
  );
}
