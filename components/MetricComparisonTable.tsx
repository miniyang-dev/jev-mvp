import type { Winner } from "@/lib/providerMetrics";

export interface MetricRowData {
  label: string;
  jevValue: string;
  geminiValue: string;
  ratioTimes: number;
  winner: Winner;
}

function WinnerBadge({ winner }: { winner: Winner }) {
  if (winner === "tie") {
    return <span className="text-[var(--text-muted)]">打平</span>;
  }
  const label = winner === "jev" ? "Jev 勝" : "Gemini 勝";
  return (
    <span className="inline-block rounded px-2 py-0.5 bg-[var(--accent-soft)] border border-[var(--accent-soft-border)]">
      {label}
    </span>
  );
}

/** The "項目 / Jev / Gemini / 差距 / 誰勝" table used by both single-article
 * and batch summaries. Pure presentation — callers compute the rows. */
export function MetricComparisonTable({ rows }: { rows: MetricRowData[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-t border-[var(--border)] text-xs text-[var(--text-muted)]">
          <th className="text-left font-normal px-3 py-2">項目</th>
          <th className="text-left font-normal px-3 py-2">Jev</th>
          <th className="text-left font-normal px-3 py-2">Gemini</th>
          <th className="text-left font-normal px-3 py-2">差距</th>
          <th className="text-left font-normal px-3 py-2">誰勝</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label} className="border-b border-[var(--border)] last:border-0">
            <td className="px-3 py-2 text-[var(--text-muted)]">{row.label}</td>
            <td className="px-3 py-2 font-mono-data">{row.jevValue}</td>
            <td className="px-3 py-2 font-mono-data">{row.geminiValue}</td>
            <td className="px-3 py-2 font-mono-data">
              {Number.isFinite(row.ratioTimes) ? `${row.ratioTimes.toFixed(2)}x` : "—"}
            </td>
            <td className="px-3 py-2">
              <WinnerBadge winner={row.winner} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
