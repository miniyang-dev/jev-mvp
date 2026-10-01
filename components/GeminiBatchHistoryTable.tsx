import type { GeminiBatchHistoryEntry } from "@/lib/geminiBatchStorage";
import { formatDuration, formatSavingsPercent } from "@/lib/format";
import { jobStateLabel } from "@/lib/geminiJobState";

const TIER_LABEL: Record<GeminiBatchHistoryEntry["tier"], string> = {
  live: "即時",
  batch: "Batch",
  flex: "Flex",
};

/** How much cheaper Jev was than Gemini for this specific run — "—" for
 * entries saved before real costs were tracked per entry. */
function jevSavingsLabel(entry: GeminiBatchHistoryEntry): string {
  if (entry.jevTotalCostUsd === undefined || entry.geminiTotalCostUsd === undefined) return "—";
  return formatSavingsPercent(entry.jevTotalCostUsd, entry.geminiTotalCostUsd);
}

export function GeminiBatchHistoryTable({ entries }: { entries: GeminiBatchHistoryEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      <div className="px-3 pt-3">
        <h3 className="text-sm font-medium">過去執行耗時記錄</h3>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          各模式實測耗時（官方只說 Batch 24 小時內、Flex 1~15 分鐘）
        </p>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          成本節省＝改用 Jev 比 Gemini 省多少。Flex／Batch 的 Gemini 已打五折，所以數字較低。
        </p>
      </div>
      <table className="w-full text-sm mt-2">
        <thead>
          <tr className="border-b border-t border-[var(--border)] text-xs text-[var(--text-muted)]">
            <th className="text-left font-normal px-3 py-2">類型</th>
            <th className="text-left font-normal px-3 py-2">送出時間</th>
            <th className="text-left font-normal px-3 py-2">模型</th>
            <th className="text-left font-normal px-3 py-2">篇數</th>
            <th className="text-left font-normal px-3 py-2">狀態</th>
            <th className="text-left font-normal px-3 py-2">實際耗時</th>
            <th className="text-left font-normal px-3 py-2">成本節省（改用 Jev）</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={`${entry.jobName}-${entry.completedAt}`} className="border-b border-[var(--border)] last:border-0">
              <td className="px-3 py-2">
                <span className="inline-block rounded px-2 py-0.5 text-xs border border-[var(--border)]">
                  {/* Entries saved before Flex mode existed have no `tier` — they were all Batch. */}
                  {TIER_LABEL[entry.tier ?? "batch"]}
                </span>
              </td>
              <td className="px-3 py-2 font-mono-data text-xs">
                {new Date(entry.submittedAt).toLocaleString()}
              </td>
              <td className="px-3 py-2 text-xs">{entry.model}</td>
              <td className="px-3 py-2 font-mono-data text-xs">{entry.itemCount}</td>
              <td className="px-3 py-2 text-xs">{jobStateLabel(entry.state)}</td>
              <td className="px-3 py-2 font-mono-data text-xs">{formatDuration(entry.durationMs)}</td>
              <td className="px-3 py-2 font-mono-data text-xs">{jevSavingsLabel(entry)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
