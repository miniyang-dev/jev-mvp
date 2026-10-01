"use client";

import { useEffect, useState } from "react";
import {
  appendBatchHistory,
  loadBatchHistory,
  type GeminiBatchHistoryEntry,
} from "@/lib/geminiBatchStorage";

/** Timing/cost log of every completed run, persisted in localStorage. Filled on
 * mount rather than eagerly for the same SSR/hydration reason as the golden set. */
export function useBatchHistory() {
  const [history, setHistory] = useState<GeminiBatchHistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadBatchHistory());
  }, []);

  const record = (entry: GeminiBatchHistoryEntry) => setHistory(appendBatchHistory(entry));

  return { history, record };
}
