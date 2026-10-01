import type { Dimension, ProviderResult } from "@/lib/schema";
import type { BatchRow } from "@/lib/batchTypes";
import { safeGet, safeSet, safeRemove } from "@/lib/storage";

/** Persists the in-flight Gemini batch job so it survives a page reload —
 * the job itself can take hours, far longer than a browser tab's lifetime.
 * Carries a full snapshot of the article rows (Jev's results already in,
 * Gemini's still pending) so the page can rebuild its whole view on reload,
 * since the rows themselves live only in React state otherwise. */
export interface GeminiBatchJobState {
  jobName: string;
  /** Article ids in submission order; used to line results back up with rows. */
  itemIds: string[];
  dimensions: Dimension[];
  geminiModel: string;
  submittedAt: number;
  lastCheckedAt?: number;
  lastKnownState?: string;
  rows: BatchRow[];
}

/** One completed run's timing, kept forever (until the user clears it) so
 * "how long does this actually take" can be answered from real data instead
 * of Google's vague "target 24h" / "target 1~15min, best-effort". Covers all
 * three Gemini execution modes — `live` (standard, full price) alongside the
 * discounted `batch` (one async job) and `flex` (N synchronous calls run as
 * one batch) — so timing is directly comparable across all of them. */
export interface GeminiBatchHistoryEntry {
  tier: "live" | "batch" | "flex";
  jobName: string;
  model: string;
  itemCount: number;
  submittedAt: number;
  completedAt: number;
  durationMs: number;
  state: string;
  /** Real totals for this run's articles, so "cost savings" compares against
   * what Jev actually cost — not just Gemini's own fixed tier discount.
   * Optional because entries saved before this field existed won't have it. */
  jevTotalCostUsd?: number;
  geminiTotalCostUsd?: number;
}

const JOB_KEY = "jev-mvp:gemini-batch-job";
const HISTORY_KEY = "jev-mvp:gemini-batch-history";

export function loadPendingJob(): GeminiBatchJobState | null {
  return safeGet<GeminiBatchJobState>(JOB_KEY);
}

/** Raw request/response payloads are debugging aids that can be large and
 * duplicate the article text; the restored page never needs them, and keeping
 * them would burn through localStorage's ~5MB quota on a big batch. */
function stripRawPayloads(job: GeminiBatchJobState): GeminiBatchJobState {
  const strip = (result: ProviderResult): ProviderResult => {
    const slim = { ...result };
    delete slim.rawRequest;
    delete slim.rawResponse;
    return slim;
  };
  return {
    ...job,
    rows: job.rows.map((row) =>
      row.result ? { ...row, result: { ...row.result, jev: strip(row.result.jev), gemini: strip(row.result.gemini) } } : row
    ),
  };
}

export function savePendingJob(job: GeminiBatchJobState): void {
  safeSet(JOB_KEY, stripRawPayloads(job));
}

export function clearPendingJob(): void {
  safeRemove(JOB_KEY);
}

export function loadBatchHistory(): GeminiBatchHistoryEntry[] {
  return safeGet<GeminiBatchHistoryEntry[]>(HISTORY_KEY) ?? [];
}

export function appendBatchHistory(entry: GeminiBatchHistoryEntry): GeminiBatchHistoryEntry[] {
  const history = [entry, ...loadBatchHistory()];
  safeSet(HISTORY_KEY, history);
  return history;
}
