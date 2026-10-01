import type { ProviderResult } from "@/lib/schema";

/** A batch run split into two independent lanes — every article is sent to
 * Jev and to Gemini as separate requests, each lane with its own concurrency,
 * so neither provider ever waits on the other. That's what makes the timing
 * real: a lane's clock stops when *its* last article comes back, not when the
 * slower provider does. Same number of API calls as a combined run. */
export type LaneId = "jev" | "gemini";

export type RaceItemStatus = "pending" | "running" | "done" | "failed";

export interface RaceItem {
  status: RaceItemStatus;
  /** Server-measured provider latency, when the call succeeded. */
  latencyMs?: number;
}

export interface RaceLane {
  id: LaneId;
  label: string;
  /** One per article, in the batch's row order. */
  items: RaceItem[];
  costUsd: number;
  /** When the lane's last article settled; null while still running. */
  finishedAt: number | null;
}

export interface BatchRace {
  startedAt: number;
  lanes: RaceLane[];
}

export function createRace(
  articleCount: number,
  lanes: { id: LaneId; label: string }[],
  startedAt: number
): BatchRace {
  return {
    startedAt,
    lanes: lanes.map((lane) => ({
      ...lane,
      items: Array.from({ length: articleCount }, () => ({ status: "pending" as const })),
      costUsd: 0,
      finishedAt: null,
    })),
  };
}

function updateLane(race: BatchRace, laneId: LaneId, update: (lane: RaceLane) => RaceLane): BatchRace {
  return { ...race, lanes: race.lanes.map((lane) => (lane.id === laneId ? update(lane) : lane)) };
}

export function markItemRunning(race: BatchRace, laneId: LaneId, index: number): BatchRace {
  return updateLane(race, laneId, (lane) => ({
    ...lane,
    items: lane.items.map((item, i) => (i === index ? { status: "running" } : item)),
  }));
}

/** Records one article's result on a lane, and stops the lane's clock once
 * every article on it has settled (succeeded or failed). */
export function settleItem(
  race: BatchRace,
  laneId: LaneId,
  index: number,
  result: ProviderResult,
  settledAt: number
): BatchRace {
  return updateLane(race, laneId, (lane) => {
    const items = lane.items.map((item, i): RaceItem =>
      i === index
        ? { status: result.ok ? "done" : "failed", latencyMs: result.ok ? result.latencyMs : undefined }
        : item
    );
    const allSettled = items.every((item) => item.status === "done" || item.status === "failed");
    return {
      ...lane,
      items,
      costUsd: lane.costUsd + (result.ok ? result.costUsd ?? 0 : 0),
      finishedAt: allSettled ? lane.finishedAt ?? settledAt : null,
    };
  });
}
