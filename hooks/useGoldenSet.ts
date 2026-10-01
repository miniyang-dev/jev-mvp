"use client";

import { useCallback, useEffect, useState } from "react";
import type { Dimension } from "@/lib/schema";
import type { AdversarialSample } from "@/lib/adversarialSamples";
import type { JudgmentValue } from "@/components/JudgmentPicker";
import {
  clearGoldenSet,
  hashArticleText,
  loadGoldenSet,
  removeGoldenLabel,
  upsertGoldenLabel,
  type GoldenLabelEntry,
  type GoldenSet,
} from "@/lib/goldenSet";

/** React view of the localStorage-backed golden set. Starts empty and fills on
 * mount (not a lazy initializer) because localStorage doesn't exist during
 * server rendering — reading it eagerly would make the server's and client's
 * first render disagree and trigger a hydration error. */
export function useGoldenSet() {
  const [goldenSet, setGoldenSet] = useState<GoldenSet>({});

  useEffect(() => {
    setGoldenSet(loadGoldenSet());
  }, []);

  /** Re-reads storage and returns what it found, for callers that need the
   * fresh set synchronously (state updates are async). */
  const refresh = useCallback((): GoldenSet => {
    const fresh = loadGoldenSet();
    setGoldenSet(fresh);
    return fresh;
  }, []);

  const goldenFor = (text: string): GoldenLabelEntry | null =>
    goldenSet[hashArticleText(text)] ?? null;

  /** Judging a disagreement is the expensive part of this whole tool, so the
   * answer is written down — the same article never asks for this dimension again. */
  const recordJudgment = (text: string, dimension: Dimension, value: JudgmentValue) => {
    upsertGoldenLabel(text, { [dimension]: value }, "human-judged");
    refresh();
  };

  /** Seeds the pack's authored answers so its samples are scorable the moment
   * they finish running, with no judging needed. */
  const seedAdversarial = (samples: AdversarialSample[]) => {
    samples.forEach((sample) => upsertGoldenLabel(sample.text, sample.expected, "adversarial-authored"));
    refresh();
  };

  const remove = (textHash: string) => {
    removeGoldenLabel(textHash);
    refresh();
  };

  const clear = () => {
    clearGoldenSet();
    setGoldenSet({});
  };

  return { goldenSet, goldenFor, refresh, recordJudgment, seedAdversarial, remove, clear };
}
