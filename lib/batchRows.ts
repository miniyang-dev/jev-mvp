import type { BatchRow } from "@/lib/batchTypes";
import type { ProviderResult } from "@/lib/schema";

/** Pure row transforms for the batch page, kept out of the React code so they
 * can be tested without a DOM. */

export const DEFERRED_GEMINI: ProviderResult = { provider: "gemini", ok: false, deferred: true };

/** Total cost one provider actually incurred across a set of rows — used to
 * log each run's real Jev-vs-Gemini cost gap into the timing history, rather
 * than the fixed tier discount. */
export function sumProviderCost(rows: BatchRow[], provider: "jev" | "gemini"): number {
  return rows.reduce((sum, r) => {
    const result = r.result?.[provider];
    return result?.ok && result.costUsd !== undefined ? sum + result.costUsd : sum;
  }, 0);
}

/** A row reloaded mid-flight (queued/running) can never resume on its own —
 * mark it as needing a re-submit instead of looking stuck forever. */
export function normalizeRestoredRows(rows: BatchRow[]): BatchRow[] {
  return rows.map((r) =>
    r.status === "queued" || r.status === "running"
      ? { ...r, status: "error", error: "頁面重新整理，請重新送出" }
      : r
  );
}

/** Folds a finished Gemini batch job's answers into the rows that were waiting
 * on it. Rows the job didn't answer (or that never had a Jev result) are left alone. */
export function mergeGeminiResults(
  rows: BatchRow[],
  results: Record<string, ProviderResult> | undefined
): BatchRow[] {
  return rows.map((r) => {
    const geminiResult = results?.[r.input.id];
    if (!geminiResult || !r.result) return r;
    return { ...r, status: "done" as const, result: { ...r.result, gemini: geminiResult } };
  });
}
