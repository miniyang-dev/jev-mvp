"use client";

import { forwardRef, useEffect, useState } from "react";
import type { BatchRace, RaceItem, RaceLane } from "@/lib/batchRace";
import { formatDuration, formatUsd } from "@/lib/format";

const TICK_MS = 100;

function itemStyle(item: RaceItem): string {
  if (item.status === "done") return "bg-[var(--accent)] border-[var(--accent)]";
  if (item.status === "failed") return "bg-[var(--neutral-flag)] border-[var(--neutral-flag-border)]";
  if (item.status === "running") return "border-[var(--accent)] animate-pulse";
  return "border-[var(--border)]";
}

function itemTitle(item: RaceItem, index: number): string {
  const prefix = `#${index + 1}`;
  if (item.status === "done") return `${prefix} 完成${item.latencyMs !== undefined ? ` · ${formatDuration(item.latencyMs)}` : ""}`;
  if (item.status === "failed") return `${prefix} 失敗`;
  if (item.status === "running") return `${prefix} 進行中`;
  return `${prefix} 排隊中`;
}

function Lane({
  lane,
  elapsedMs,
  maxElapsedMs,
  isWinner,
}: {
  lane: RaceLane;
  elapsedMs: number;
  maxElapsedMs: number;
  isWinner: boolean;
}) {
  const settled = lane.items.filter((i) => i.status === "done" || i.status === "failed").length;
  const failed = lane.items.filter((i) => i.status === "failed").length;
  const latencies = lane.items.map((i) => i.latencyMs).filter((l): l is number => l !== undefined);
  const avgLatency = latencies.length > 0 ? latencies.reduce((s, l) => s + l, 0) / latencies.length : null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{lane.label}</span>
          {isWinner && (
            <span className="inline-block rounded px-2 py-0.5 text-xs bg-[var(--accent-soft)] border border-[var(--accent-soft-border)]">
              🏁 率先完成
            </span>
          )}
          {lane.finishedAt === null && (
            <span className="text-xs text-[var(--text-muted)]">進行中…</span>
          )}
        </div>
        <span className="text-xs font-mono-data text-[var(--text-muted)]">
          {settled}/{lane.items.length}
          {failed > 0 && `（失敗 ${failed}）`} · {formatDuration(elapsedMs)} · {formatUsd(lane.costUsd)}
          {avgLatency !== null && ` · 平均 ${formatDuration(avgLatency)}/篇`}
        </span>
      </div>

      <div className="flex flex-wrap gap-1">
        {lane.items.map((item, index) => (
          <span
            key={index}
            title={itemTitle(item, index)}
            className={`inline-block w-3 h-3 rounded-sm border ${itemStyle(item)}`}
          />
        ))}
      </div>

      {/* Elapsed time on a shared scale: both bars grow together from the
          same start, and the one that finishes first freezes — the gap that
          opens up is the race result. */}
      <div className="h-1.5 rounded-full bg-[var(--neutral-flag)] overflow-hidden">
        <div
          className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-100"
          style={{ width: `${maxElapsedMs > 0 ? (elapsedMs / maxElapsedMs) * 100 : 0}%` }}
        />
      </div>
    </div>
  );
}

/** Jev and Gemini racing through the same batch, each on its own lane with
 * its own real clock. */
export const BatchRacePanel = forwardRef<HTMLDivElement, { race: BatchRace; modelLabel: string }>(
  function BatchRacePanel({ race, modelLabel }, ref) {
    const running = race.lanes.some((lane) => lane.finishedAt === null);
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
      if (!running) return;
      const timer = setInterval(() => setNow(Date.now()), TICK_MS);
      return () => clearInterval(timer);
    }, [running]);

    const elapsedFor = (lane: RaceLane) =>
      Math.max(0, (lane.finishedAt ?? now) - race.startedAt);
    const elapsed = race.lanes.map(elapsedFor);
    const maxElapsed = Math.max(...elapsed);

    // The first lane to settle every article wins outright — the other one
    // hasn't finished, so there's nothing left that could overturn it.
    const finished = race.lanes.filter((lane) => lane.finishedAt !== null);
    const winner =
      finished.length > 0
        ? finished.reduce((a, b) => (a.finishedAt! <= b.finishedAt! ? a : b))
        : null;

    return (
      <div
        ref={ref}
        className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-5 space-y-5 scroll-mt-6"
      >
        <div className="space-y-1">
          <h3 className="text-sm font-medium">擂台賽：Jev vs {modelLabel}</h3>
          <p className="text-xs text-[var(--text-muted)]">
            兩邊各自跑、各自計時，先跑完整批者勝。每格一篇，滑過看延遲；逐篇結果在上方。
          </p>
        </div>

        {race.lanes.map((lane, index) => (
          <Lane
            key={lane.id}
            lane={lane}
            elapsedMs={elapsed[index]}
            maxElapsedMs={maxElapsed}
            isWinner={winner?.id === lane.id}
          />
        ))}
      </div>
    );
  }
);
