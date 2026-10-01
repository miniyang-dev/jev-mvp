import type { BatchRow } from "@/lib/batchTypes";
import type { Dimension } from "@/lib/schema";
import { ProviderResultCard } from "@/components/ProviderResultCard";
import { ComparisonTable } from "@/components/ComparisonTable";
import type { JudgmentValue } from "@/components/JudgmentPicker";
import { getGeminiModelOption } from "@/lib/geminiModels";
import type { GoldenLabelEntry } from "@/lib/goldenSet";

const STATUS_LABEL: Record<BatchRow["status"], string> = {
  idle: "未送出",
  queued: "排隊中",
  running: "分析中…",
  done: "完成",
  error: "錯誤",
  awaiting_gemini_batch: "Jev 完成・等 Gemini batch",
};

function StatusBadge({ status }: { status: BatchRow["status"] }) {
  const style =
    status === "done"
      ? "bg-[var(--accent-soft)] border border-[var(--accent-soft-border)]"
      : status === "error"
      ? "bg-[var(--neutral-flag)] border border-[var(--neutral-flag-border)]"
      : "border border-[var(--border)] text-[var(--text-muted)]";
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs ${style}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function BatchArticleRow({
  index,
  row,
  geminiModel,
  goldenEntry,
  onTextChange,
  onJudge,
  onRemove,
}: {
  index: number;
  row: BatchRow;
  /** The model this row's Gemini side is (or will be) analyzed with — used for
   * the card title before `result.gemini.model` is populated (e.g. while deferred). */
  geminiModel: string;
  /** This article's known-correct answers, when it's in the golden set.
   * Resolved by the page, not looked up here. */
  goldenEntry?: GoldenLabelEntry | null;
  onTextChange: (id: string, text: string) => void;
  onJudge: (id: string, dimension: Dimension, value: JudgmentValue) => void;
  onRemove: (id: string) => void;
}) {
  const { input, status, result, judgment, error } = row;
  const locked = status === "queued" || status === "running";

  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--text-muted)] font-mono-data">#{index + 1}</span>
        <div className="flex items-center gap-2">
          {goldenEntry && (
            <span className="inline-block rounded px-2 py-0.5 text-xs bg-[var(--accent-soft)] border border-[var(--accent-soft-border)]">
              有黃金答案
            </span>
          )}
          <StatusBadge status={status} />
          <button
            type="button"
            onClick={() => onRemove(input.id)}
            disabled={locked}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-30"
          >
            刪除
          </button>
        </div>
      </div>

      <textarea
        value={input.text}
        onChange={(e) => onTextChange(input.id, e.target.value)}
        disabled={locked}
        rows={3}
        placeholder="貼上要分析的文章..."
        className="w-full rounded border border-[var(--border)] bg-[var(--bg)] p-3 text-sm outline-none focus:border-[var(--accent)] transition-colors resize-y disabled:opacity-60"
      />

      {status === "error" && (
        <p className="text-xs text-[var(--text-muted)] border-t border-[var(--border)] pt-3">
          {error}
        </p>
      )}

      {(status === "done" || status === "awaiting_gemini_batch") && result && (
        <div className="space-y-3 border-t border-[var(--border)] pt-3">
          <ComparisonTable
            data={result}
            judgment={judgment}
            golden={goldenEntry?.judgment}
            onJudge={(dimension, value) => onJudge(input.id, dimension, value)}
          />
          <details>
            <summary className="text-xs text-[var(--text-muted)] cursor-pointer">
              查看這篇的完整結果
            </summary>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              <ProviderResultCard title="Jev (TypeSafe)" result={result.jev} dimensions={result.dimensions} />
              <ProviderResultCard
                title={getGeminiModelOption(result.gemini.model ?? geminiModel).displayName}
                result={result.gemini}
                dimensions={result.dimensions}
              />
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
