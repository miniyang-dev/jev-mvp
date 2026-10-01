import { formatUsd } from "@/lib/format";
import type { SweepCostEstimate } from "@/lib/sweepEstimate";

/** A sweep multiplies this tool's usual spend by the number of models and
 * repeats, so the cost is shown up front and the run is gated behind an
 * explicit acknowledgement rather than a single click. */
export function SweepCostWarning({
  estimate,
  acknowledged,
  onAcknowledgedChange,
  onConfirm,
  disabled,
  running,
}: {
  estimate: SweepCostEstimate;
  acknowledged: boolean;
  onAcknowledgedChange: (value: boolean) => void;
  onConfirm: () => void;
  disabled?: boolean;
  running?: boolean;
}) {
  const totalCalls = estimate.geminiCallCount + estimate.jevCallCount;
  const repeatNote = estimate.repeats > 1 ? ` × 重複 ${estimate.repeats} 次` : "";

  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4">
      <div className="space-y-1">
        <h3 className="text-sm font-medium">開跑前的費用粗估</h3>
        <p className="text-xs text-[var(--text-muted)]">
          以 4 字元 ≈ 1 token 粗估，僅供參考。
        </p>
      </div>

      <table className="w-full text-sm">
        <tbody>
          <tr className="border-b border-[var(--border)]">
            <td className="py-2 text-[var(--text-muted)]">呼叫次數</td>
            <td className="py-2 font-mono-data">
              {estimate.modelCount > 0 &&
                `Gemini ${estimate.geminiCallCount} 次（${estimate.articleCount} 篇 × ${estimate.modelCount} 個模型${repeatNote}）`}
              {estimate.modelCount > 0 && estimate.jevCallCount > 0 && " ＋ "}
              {estimate.jevCallCount > 0 &&
                `Jev ${estimate.jevCallCount} 次${estimate.repeats > 1 ? `（${estimate.articleCount} 篇${repeatNote}）` : ""}`}
            </td>
          </tr>
          {estimate.modelCount > 0 && (
            <tr className="border-b border-[var(--border)]">
              <td className="py-2 text-[var(--text-muted)]">Gemini 粗估費用</td>
              <td className="py-2 font-mono-data">{formatUsd(estimate.estimatedGeminiCostUsd)}</td>
            </tr>
          )}
          {estimate.jevCallCount > 0 && (
            <tr className="border-b border-[var(--border)]">
              <td className="py-2 text-[var(--text-muted)]">Jev 粗估費用</td>
              <td className="py-2 font-mono-data">{formatUsd(estimate.estimatedJevCostUsd)}</td>
            </tr>
          )}
          <tr>
            <td className="py-2 text-[var(--text-muted)]">合計粗估</td>
            <td className="py-2 font-mono-data">{formatUsd(estimate.estimatedTotalCostUsd)}</td>
          </tr>
        </tbody>
      </table>

      <label className="flex items-start gap-2 text-sm cursor-pointer select-none">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => onAcknowledgedChange(e.target.checked)}
          disabled={running}
          className="mt-1 accent-[var(--accent)]"
        />
        確認送出 {totalCalls} 次 API 呼叫
      </label>

      <button
        type="button"
        onClick={onConfirm}
        disabled={disabled || !acknowledged || running}
        className="rounded bg-[var(--accent)] text-white text-sm px-4 py-2 disabled:opacity-40 transition-opacity"
      >
        {running ? "掃描中…" : "確認執行掃描"}
      </button>
    </div>
  );
}
