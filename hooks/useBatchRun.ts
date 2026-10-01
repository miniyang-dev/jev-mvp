"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import type { Dimension, ProviderResult } from "@/lib/schema";
import type { BatchRow } from "@/lib/batchTypes";
import type { GeminiMode } from "@/components/GeminiModeToggle";
import type { GeminiBatchHistoryEntry } from "@/lib/geminiBatchStorage";
import { analyzeWithGemini, analyzeWithJev } from "@/lib/apiClient";
import { DEFERRED_GEMINI, sumProviderCost } from "@/lib/batchRows";
import { runWithLimit } from "@/lib/concurrency";
import { getGeminiModelOption } from "@/lib/geminiModels";
import {
  createRace,
  markItemRunning,
  settleItem,
  type BatchRace,
  type LaneId,
} from "@/lib/batchRace";

const CONCURRENCY_LIMIT = 3;

interface Args {
  rows: BatchRow[];
  setRows: Dispatch<SetStateAction<BatchRow[]>>;
  dimensions: Dimension[];
  geminiModel: string;
  geminiMode: GeminiMode;
  /** Hands the finished rows to the async Gemini batch job (batch mode only). */
  submitBatchJob: (args: { rows: BatchRow[]; itemIds: string[] }) => Promise<void>;
  recordHistory: (entry: GeminiBatchHistoryEntry) => void;
}

/** One provider's half of an article. Each article goes out as two separate
 * requests (one per provider) so the two lanes of a run never wait on each
 * other — see `lib/batchRace.ts`. */
function analyzeHalf(
  row: BatchRow,
  provider: LaneId,
  dimensions: Dimension[],
  geminiModel: string,
  serviceTier: "standard" | "flex"
): Promise<ProviderResult> {
  return provider === "jev"
    ? analyzeWithJev(row.input.text, dimensions)
    : analyzeWithGemini(row.input.text, dimensions, { model: geminiModel, serviceTier });
}

/** Runs a batch: every runnable row goes to Jev and (unless Gemini is deferred
 * to a batch job) to Gemini, as two independent racing lanes. Row state lives
 * with the caller; this owns the run itself and the race it produces. */
export function useBatchRun({
  rows,
  setRows,
  dimensions,
  geminiModel,
  geminiMode,
  submitBatchJob,
  recordHistory,
}: Args) {
  const [isRunning, setIsRunning] = useState(false);
  const [race, setRace] = useState<BatchRace | null>(null);

  const clearRace = () => setRace(null);

  const start = async () => {
    const runnable = rows.filter((r) => r.input.text.trim().length > 0);
    if (runnable.length === 0) return;
    const isBatchMode = geminiMode === "batch";
    const isFlexMode = geminiMode === "flex";
    const geminiServiceTier = isFlexMode ? "flex" : "standard";
    // Batch mode sends Gemini off as one async job afterwards, so only Jev
    // runs live — there's nothing to race against.
    const laneIds: LaneId[] = isBatchMode ? ["jev"] : ["jev", "gemini"];

    setIsRunning(true);
    const runStartedAt = Date.now();
    const runnableIds = new Set(runnable.map((r) => r.input.id));
    // Per-run judgments are cleared, but anything already judged lives on in
    // the golden set and is re-applied automatically — a re-run never asks the
    // same question twice.
    const resetRow = (r: BatchRow): BatchRow =>
      runnableIds.has(r.input.id)
        ? { ...r, status: "queued", error: undefined, result: undefined, judgment: {} }
        : r;
    setRows((prev) => prev.map(resetRow));
    setRace(
      isBatchMode
        ? null
        : createRace(
            runnable.length,
            [
              { id: "jev", label: "Jev" },
              { id: "gemini", label: getGeminiModelOption(geminiModel).displayName },
            ],
            runStartedAt
          )
    );

    // React state updates are async; mirror them into a local snapshot so we
    // can read the final results synchronously right after both lanes finish.
    let snapshot = rows.map(resetRow);
    const applyRow = (id: string, updater: (r: BatchRow) => BatchRow) => {
      snapshot = snapshot.map((r) => (r.input.id === id ? updater(r) : r));
      setRows((prev) => prev.map((r) => (r.input.id === id ? updater(r) : r)));
    };

    // Each article's two halves arrive independently; the row is finished
    // once every half it's waiting on is in.
    const halves = new Map<string, Partial<Record<LaneId, ProviderResult>>>();
    const httpErrors = new Map<string, string[]>();

    const settleHalf = (row: BatchRow, provider: LaneId, result: ProviderResult, httpError?: string) => {
      const id = row.input.id;
      const got = { ...halves.get(id), [provider]: result };
      halves.set(id, got);
      if (httpError) httpErrors.set(id, [...(httpErrors.get(id) ?? []), httpError]);
      if (!laneIds.every((lane) => got[lane])) return;

      const errors = httpErrors.get(id) ?? [];
      // Only a row where every request itself failed is an error row; a
      // provider that answered with ok:false is a result like any other.
      const finalize = (r: BatchRow): BatchRow =>
        errors.length === laneIds.length
          ? { ...r, status: "error", error: [...new Set(errors)].join("；") }
          : {
              ...r,
              status: isBatchMode ? "awaiting_gemini_batch" : "done",
              error: undefined,
              result: { jev: got.jev!, gemini: got.gemini ?? DEFERRED_GEMINI, dimensions },
            };
      applyRow(id, finalize);
    };

    const runLane = (provider: LaneId) =>
      runWithLimit(
        runnable,
        CONCURRENCY_LIMIT,
        async (row, index) => {
          applyRow(row.input.id, (r) => (r.status === "queued" ? { ...r, status: "running" } : r));
          setRace((prev) => (prev ? markItemRunning(prev, provider, index) : prev));
          return analyzeHalf(row, provider, dimensions, geminiModel, geminiServiceTier);
        },
        (index, outcome) => {
          const row = runnable[index];
          const httpError = outcome.ok
            ? undefined
            : outcome.error instanceof Error
            ? outcome.error.message
            : "未知錯誤";
          const result: ProviderResult = outcome.ok
            ? outcome.value
            : { provider, ok: false, error: httpError };
          const settledAt = Date.now();
          setRace((prev) => (prev ? settleItem(prev, provider, index, result, settledAt) : prev));
          settleHalf(row, provider, result, httpError);
        }
      );

    await Promise.all(laneIds.map(runLane));

    setIsRunning(false);

    if (isBatchMode) {
      const itemIds = runnable.map((r) => r.input.id);
      try {
        await submitBatchJob({ rows: snapshot, itemIds });
      } catch (err) {
        const message = err instanceof Error ? err.message : "未知錯誤";
        setRows((prev) =>
          prev.map((r) =>
            itemIds.includes(r.input.id) && r.status === "awaiting_gemini_batch"
              ? { ...r, status: "error", error: `Gemini batch 送出失敗：${message}` }
              : r
          )
        );
      }
      return;
    }

    // "live" and "flex" are both synchronous, so the whole run's wall-clock
    // time is already known here — log it alongside Batch's job timings so
    // all three execution modes end up directly comparable.
    const completedAt = Date.now();
    const runRows = snapshot.filter((r) => runnableIds.has(r.input.id));
    recordHistory({
      tier: isFlexMode ? "flex" : "live",
      jobName: `${geminiMode}-${runStartedAt}`,
      model: geminiModel,
      itemCount: runnable.length,
      submittedAt: runStartedAt,
      completedAt,
      durationMs: completedAt - runStartedAt,
      state: "已完成",
      jevTotalCostUsd: sumProviderCost(runRows, "jev"),
      geminiTotalCostUsd: sumProviderCost(runRows, "gemini"),
    });
  };

  return { isRunning, race, clearRace, start };
}
