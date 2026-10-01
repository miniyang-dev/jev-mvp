import type { AnalyzeResponse, Dimension, Judgment } from "@/lib/schema";
import { REGION_LABELS, SENTIMENT_CATEGORY_LABELS } from "@/lib/labels";

/** How this row's "correct" answer was established. */
export type TruthSource =
  /** A known-correct answer from the golden set — outranks everything else. */
  | "golden"
  /** Jev and Gemini said the same thing; treated as correct by consensus. */
  | "agree"
  /** They disagreed and the user arbitrated. */
  | "judged"
  /** They disagreed and nobody has arbitrated yet — excluded from scoring. */
  | "unresolved";

export type ComparisonRow = {
  dimension: Dimension;
  label: string;
  jevValue: string;
  geminiValue: string;
  /** Jev and Gemini gave the same answer — treated as consensus-correct, no judgment needed. */
  agree: boolean;
  truthSource: TruthSource;
  /** null until resolved (agreement, a golden answer, or the user has judged a disagreement). */
  jevMatch: boolean | null;
  geminiMatch: boolean | null;
  /** Display label of the resolved "correct" answer, once known. */
  resolvedLabel: string | null;
};

/** Resolution order for one dimension: a golden answer wins outright, then
 * agreement, then the user's judgment. Golden outranks agreement on purpose —
 * both providers agreeing on the same wrong answer is precisely what a known
 * answer is there to catch. */
function buildRow<T>(args: {
  dimension: Dimension;
  label: string;
  jevAns: T;
  geminiAns: T;
  judged: T | undefined;
  golden: T | undefined;
  toLabel: (value: T) => string;
}): ComparisonRow {
  const { dimension, label, jevAns, geminiAns, judged, golden, toLabel } = args;
  const agree = jevAns === geminiAns;
  const resolved = golden !== undefined ? golden : agree ? jevAns : judged;
  const truthSource: TruthSource =
    golden !== undefined ? "golden" : agree ? "agree" : judged !== undefined ? "judged" : "unresolved";

  return {
    dimension,
    label,
    jevValue: toLabel(jevAns),
    geminiValue: toLabel(geminiAns),
    agree,
    truthSource,
    jevMatch: resolved === undefined ? null : jevAns === resolved,
    geminiMatch: resolved === undefined ? null : geminiAns === resolved,
    resolvedLabel: resolved === undefined ? null : toLabel(resolved),
  };
}

/** One row per selected dimension where both providers produced an answer.
 * A golden answer (a previously judged or authored known-correct label, see
 * `lib/goldenSet.ts`) settles the row outright. Otherwise, when the providers
 * agree that answer is treated as correct automatically; when they disagree
 * the row stays unresolved (`jevMatch`/`geminiMatch` null) until the caller
 * supplies a `judgment` for that dimension. Single source of truth for both
 * the per-article table and the aggregate correctness score.
 *
 * `golden` is optional so callers that have no golden set (the single-article
 * page) keep the original two-provider behaviour unchanged. */
export function buildComparisonRows(
  data: AnalyzeResponse,
  judgment: Judgment,
  golden?: Judgment
): ComparisonRow[] {
  const rows: ComparisonRow[] = [];
  const { dimensions, jev, gemini } = data;

  if (dimensions.includes("sentiment")) {
    const jevAns = jev.ok ? jev.answers?.sentiment?.category ?? null : null;
    const geminiAns = gemini.ok ? gemini.answers?.sentiment?.category ?? null : null;
    if (jevAns !== null && geminiAns !== null) {
      rows.push(
        buildRow({
          dimension: "sentiment",
          label: "情緒強度",
          jevAns,
          geminiAns,
          judged: judgment.sentiment,
          golden: golden?.sentiment,
          toLabel: (value) => SENTIMENT_CATEGORY_LABELS[value],
        })
      );
    }
  }

  if (dimensions.includes("region")) {
    const jevAns = jev.ok ? jev.answers?.region?.key ?? null : null;
    const geminiAns = gemini.ok ? gemini.answers?.region?.key ?? null : null;
    if (jevAns !== null && geminiAns !== null) {
      rows.push(
        buildRow({
          dimension: "region",
          label: "地區",
          jevAns,
          geminiAns,
          judged: judgment.region,
          golden: golden?.region,
          toLabel: (value) => REGION_LABELS[value],
        })
      );
    }
  }

  if (dimensions.includes("noise")) {
    const jevAns = jev.ok ? jev.answers?.noise?.isNoise ?? null : null;
    const geminiAns = gemini.ok ? gemini.answers?.noise?.isNoise ?? null : null;
    if (jevAns !== null && geminiAns !== null) {
      rows.push(
        buildRow({
          dimension: "noise",
          label: "是否為雜訊",
          jevAns,
          geminiAns,
          judged: judgment.noise,
          golden: golden?.noise,
          toLabel: (value) => (value ? "是" : "否"),
        })
      );
    }
  }

  return rows;
}
