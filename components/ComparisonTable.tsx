import type { AnalyzeResponse, Dimension, Judgment } from "@/lib/schema";
import { buildComparisonRows } from "@/lib/compareResults";
import { JudgmentPicker, type JudgmentValue } from "@/components/JudgmentPicker";

function Cell({ value, match }: { value: string; match: boolean | null }) {
  const style =
    match === true
      ? "bg-[var(--accent-soft)] border border-[var(--accent-soft-border)]"
      : match === false
      ? "bg-[var(--neutral-flag)] border border-[var(--neutral-flag-border)]"
      : "";
  return (
    <td className="px-3 py-2">
      <span className={`inline-block rounded px-2 py-0.5 ${style}`}>{value}</span>
    </td>
  );
}

export function ComparisonTable({
  data,
  judgment,
  golden,
  onJudge,
}: {
  data: AnalyzeResponse;
  judgment: Judgment;
  /** Known-correct answers for this article, when it's in the golden set. */
  golden?: Judgment;
  onJudge: (dimension: Dimension, value: JudgmentValue) => void;
}) {
  const rows = buildComparisonRows(data, judgment, golden);
  if (rows.length === 0) return null;

  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] text-xs text-[var(--text-muted)]">
            <th className="text-left font-normal px-3 py-2">維度</th>
            <th className="text-left font-normal px-3 py-2">Jev</th>
            <th className="text-left font-normal px-3 py-2">Gemini</th>
            <th className="text-left font-normal px-3 py-2">裁定</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.dimension} className="border-b border-[var(--border)] last:border-0">
              <td className="px-3 py-2 text-[var(--text-muted)]">{row.label}</td>
              <Cell value={row.jevValue} match={row.jevMatch} />
              <Cell value={row.geminiValue} match={row.geminiMatch} />
              <td className="px-3 py-2">
                {row.truthSource === "golden" ? (
                  <span className="inline-block rounded px-2 py-0.5 bg-[var(--accent-soft)] border border-[var(--accent-soft-border)]">
                    黃金答案：{row.resolvedLabel}
                  </span>
                ) : row.agree ? (
                  <span className="text-[var(--text-muted)]">一致</span>
                ) : row.resolvedLabel !== null ? (
                  <span>你的裁定：{row.resolvedLabel}</span>
                ) : (
                  <JudgmentPicker
                    dimension={row.dimension}
                    onPick={(value) => onJudge(row.dimension, value)}
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
