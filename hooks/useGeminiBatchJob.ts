"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BatchRow } from "@/lib/batchTypes";
import type { Dimension, ProviderResult } from "@/lib/schema";
import { fetchGeminiBatchStatus, submitGeminiBatch } from "@/lib/apiClient";
import { isTerminalJobState } from "@/lib/geminiJobState";
import {
  clearPendingJob,
  loadPendingJob,
  savePendingJob,
  type GeminiBatchJobState,
} from "@/lib/geminiBatchStorage";

const AUTO_CHECK_INTERVAL_MS = 30_000;

export interface FinishedBatchJob {
  job: GeminiBatchJobState;
  state: string;
  checkedAt: number;
  results?: Record<string, ProviderResult>;
}

interface Callbacks {
  /** A job left over from a previous page load was found in storage. */
  onRestore: (job: GeminiBatchJobState) => void;
  /** The job reached a terminal state and its answers are in. */
  onFinished: (finished: FinishedBatchJob) => void;
}

/** Owns the one in-flight Gemini batch job: submitting it, surviving a page
 * reload (the job can take hours, far longer than a tab), and polling it every
 * 30s until it reaches a terminal state. What to do with the answers belongs to
 * the page, via the callbacks. */
export function useGeminiBatchJob(callbacks: Callbacks) {
  const [job, setJob] = useState<GeminiBatchJobState | null>(null);
  const [checking, setChecking] = useState(false);

  // Callbacks change identity every render; reading them through a ref keeps
  // `check` stable so the mount and polling effects don't re-fire.
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  const check = useCallback(async (target: GeminiBatchJobState) => {
    setChecking(true);
    try {
      const data = await fetchGeminiBatchStatus({
        jobName: target.jobName,
        itemIds: target.itemIds,
        geminiModel: target.geminiModel,
      });
      const checkedAt = Date.now();

      if (!data.done) {
        const updated: GeminiBatchJobState = { ...target, lastCheckedAt: checkedAt, lastKnownState: data.state };
        setJob(updated);
        savePendingJob(updated);
        return;
      }

      callbacksRef.current.onFinished({ job: target, state: data.state, checkedAt, results: data.results });
      setJob({ ...target, lastCheckedAt: checkedAt, lastKnownState: data.state });
      clearPendingJob();
    } catch (err) {
      setJob({
        ...target,
        lastCheckedAt: Date.now(),
        lastKnownState: `檢查失敗：${err instanceof Error ? err.message : "未知錯誤"}`,
      });
    } finally {
      setChecking(false);
    }
  }, []);

  // Only ever runs once, on mount.
  useEffect(() => {
    const pending = loadPendingJob();
    if (!pending) return;
    setJob(pending);
    callbacksRef.current.onRestore(pending);
    void check(pending);
  }, [check]);

  // While the job is still in flight, re-check it on a timer so the page
  // catches up on its own. Stops once it reaches a terminal state.
  useEffect(() => {
    if (!job || isTerminalJobState(job.lastKnownState)) return;
    const timer = setTimeout(() => {
      if (!checking) void check(job);
    }, AUTO_CHECK_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [job, checking, check]);

  /** Throws if the submit fails, so the caller can mark its rows as errored. */
  const submit = async (args: {
    rows: BatchRow[];
    itemIds: string[];
    dimensions: Dimension[];
    geminiModel: string;
  }) => {
    const { rows, itemIds, dimensions, geminiModel } = args;
    const items = itemIds.map((id) => {
      const row = rows.find((r) => r.input.id === id)!;
      return { id, text: row.input.text };
    });
    const jobName = await submitGeminiBatch({ items, dimensions, geminiModel });
    const created: GeminiBatchJobState = {
      jobName,
      itemIds,
      dimensions,
      geminiModel,
      submittedAt: Date.now(),
      rows,
    };
    setJob(created);
    savePendingJob(created);
  };

  const dismiss = () => setJob(null);

  return {
    job,
    checking,
    isTerminal: isTerminalJobState(job?.lastKnownState),
    check,
    submit,
    dismiss,
  };
}
