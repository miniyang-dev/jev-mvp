import type { Dimension } from "@/lib/schema";
import {
  REGION_KEYS,
  REGION_LABELS,
  SENTIMENT_CATEGORY_KEYS,
  SENTIMENT_CATEGORY_LABELS,
  type RegionKey,
  type SentimentCategory,
} from "@/lib/labels";

export type JudgmentValue = SentimentCategory | RegionKey | boolean;

/** Inline "you be the judge" control for a single dimension where Jev and
 * Gemini disagreed. Shown only for that dimension, only until judged.
 *
 * Styled as a plain outlined control (matching the app's other actionable
 * buttons/inputs), deliberately NOT using the accent-soft badge look — that
 * look is reserved for "this is already resolved" (一致/黃金答案). Using the
 * same style for "click to decide" made an unclicked control look identical
 * to an already-settled answer. */
export function JudgmentPicker({
  dimension,
  onPick,
}: {
  dimension: Dimension;
  onPick: (value: JudgmentValue) => void;
}) {
  if (dimension === "sentiment") {
    return (
      <select
        defaultValue=""
        onChange={(e) => onPick(e.target.value as SentimentCategory)}
        className="rounded border border-[var(--border)] bg-[var(--surface)] p-1.5 text-xs hover:border-[var(--accent)] transition-colors"
      >
        <option value="" disabled>
          你來裁定…
        </option>
        {SENTIMENT_CATEGORY_KEYS.map((key) => (
          <option key={key} value={key}>
            {SENTIMENT_CATEGORY_LABELS[key]}
          </option>
        ))}
      </select>
    );
  }

  if (dimension === "region") {
    return (
      <select
        defaultValue=""
        onChange={(e) => onPick(e.target.value as RegionKey)}
        className="rounded border border-[var(--border)] bg-[var(--surface)] p-1.5 text-xs hover:border-[var(--accent)] transition-colors"
      >
        <option value="" disabled>
          你來裁定…
        </option>
        {REGION_KEYS.map((key) => (
          <option key={key} value={key}>
            {REGION_LABELS[key]}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-[var(--text-muted)]">你來裁定：</span>
      <button
        type="button"
        onClick={() => onPick(false)}
        className="rounded border border-[var(--border)] px-2 py-1 hover:border-[var(--accent)] transition-colors"
      >
        否
      </button>
      <button
        type="button"
        onClick={() => onPick(true)}
        className="rounded border border-[var(--border)] px-2 py-1 hover:border-[var(--accent)] transition-colors"
      >
        是
      </button>
    </div>
  );
}
