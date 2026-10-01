export type Winner = "jev" | "gemini" | "tie";

export interface MetricComparison {
  winner: Winner;
  /** How many times larger the bigger value is than the smaller one (>= 1). */
  ratioTimes: number;
}

/** Compares two "lower is better" numbers (cost, latency) and says who wins by how much. */
export function compareLowerIsBetter(jevValue: number, geminiValue: number): MetricComparison {
  if (jevValue === geminiValue) return { winner: "tie", ratioTimes: 1 };
  const winner: Winner = jevValue < geminiValue ? "jev" : "gemini";
  const [smaller, bigger] = jevValue < geminiValue ? [jevValue, geminiValue] : [geminiValue, jevValue];
  const ratioTimes = smaller === 0 ? Infinity : bigger / smaller;
  return { winner, ratioTimes };
}

export interface CorrectnessScore {
  jevMatches: number;
  geminiMatches: number;
  total: number;
  winner: Winner;
}

/** Counts how many resolved dimensions each provider got right. A dimension is
 * "resolved" once it's either an auto-agreement or has been judged — rows still
 * waiting on a judgment (both null) are excluded from the total entirely. */
export function computeCorrectness(
  rows: { jevMatch: boolean | null; geminiMatch: boolean | null }[]
): CorrectnessScore {
  const resolved = rows.filter((r) => r.jevMatch !== null && r.geminiMatch !== null);
  const jevMatches = resolved.filter((r) => r.jevMatch === true).length;
  const geminiMatches = resolved.filter((r) => r.geminiMatch === true).length;
  const total = resolved.length;
  const winner: Winner =
    jevMatches === geminiMatches ? "tie" : jevMatches > geminiMatches ? "jev" : "gemini";
  return { jevMatches, geminiMatches, total, winner };
}

/** Linear extrapolation from a single call's cost/latency to `count` calls.
 * A rough estimate only: assumes every call looks like this one and ignores
 * batching, caching, rate limits, and concurrency. */
export function projectAtScale(
  perCall: { costUsd: number; latencyMs: number },
  count: number
) {
  return {
    totalCostUsd: perCall.costUsd * count,
    sequentialLatencyMs: perCall.latencyMs * count,
  };
}
