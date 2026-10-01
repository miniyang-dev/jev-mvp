import {
  knownDimensions,
  type GoldenLabelEntry,
  type GoldenLabelSource,
} from "@/lib/goldenSet";
import { REGION_LABELS, SENTIMENT_CATEGORY_LABELS } from "@/lib/labels";

const SOURCE_LABEL: Record<GoldenLabelSource, string> = {
  "human-judged": "你裁定",
  "adversarial-authored": "測試包",
};

const DIMENSION_LABEL = {
  sentiment: "情緒強度",
  region: "地區",
  noise: "是否為雜訊",
} as const;

function answerLabel(entry: GoldenLabelEntry, dimension: keyof typeof DIMENSION_LABEL): string {
  if (dimension === "sentiment") return SENTIMENT_CATEGORY_LABELS[entry.judgment.sentiment!];
  if (dimension === "region") return REGION_LABELS[entry.judgment.region!];
  return entry.judgment.noise ? "是" : "否";
}

/** The golden set's management view. Without it the set is an invisible store
 * that silently decides correctness and can't be inspected or corrected. */
export function GoldenSetPanel({
  entries,
  onRemove,
  onClear,
}: {
  entries: GoldenLabelEntry[];
  onRemove: (textHash: string) => void;
  onClear: () => void;
}) {
  return (
    <details className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-4">
      <summary className="text-sm cursor-pointer">
        黃金答案集
        <span className="text-[var(--text-muted)]">（{entries.length} 篇）</span>
      </summary>

      <p className="text-xs text-[var(--text-muted)] mt-2">
        你的裁定會自動存在這裡，同一篇之後不再詢問。兩邊一致不會存入（共識不等於正確）。
      </p>

      {entries.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)] mt-3">
          尚無黃金答案。裁定分歧或載入對抗測試包即可累積。
        </p>
      ) : (
        <>
          <div className="mt-3 space-y-2">
            {entries.map((entry) => (
              <div
                key={entry.textHash}
                className="flex items-start justify-between gap-3 border-t border-[var(--border)] pt-2"
              >
                <div className="min-w-0 space-y-1">
                  <p className="text-xs truncate">{entry.textPreview}</p>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--text-muted)]">
                    {knownDimensions(entry).map((dimension) => (
                      <span
                        key={dimension}
                        className="inline-block rounded px-1.5 py-0.5 bg-[var(--accent-soft)] border border-[var(--accent-soft-border)]"
                      >
                        {DIMENSION_LABEL[dimension]}：{answerLabel(entry, dimension)}
                        {entry.sources[dimension] && `（${SOURCE_LABEL[entry.sources[dimension]!]}）`}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(entry.textHash)}
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] shrink-0"
                >
                  刪除
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={onClear}
            className="mt-3 text-xs text-[var(--text-muted)] hover:text-[var(--text)] underline"
          >
            清空全部黃金答案
          </button>
        </>
      )}
    </details>
  );
}
