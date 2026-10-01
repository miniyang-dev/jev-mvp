import type { Dimension, ProviderResult } from "@/lib/schema";
import { REGION_LABELS, SENTIMENT_CATEGORY_LABELS } from "@/lib/labels";

function ScoreBar({ score }: { score: number }) {
  const clamped = Math.min(10, Math.max(1, score));
  const pct = ((clamped - 1) / 9) * 100;
  return (
    <div className="relative h-1.5 rounded-full bg-[var(--neutral-flag)] mt-2 mb-1">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-px h-3 bg-[var(--border)]" />
      <div
        className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[var(--accent)]"
        style={{ left: `calc(${pct}% - 4px)` }}
      />
    </div>
  );
}

function ConfidenceValue({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="text-[var(--text-muted)]">無信心分數</span>;
  }
  return <span className="font-mono-data">{value.toFixed(2)}</span>;
}

export function ProviderResultCard({
  title,
  result,
  dimensions,
}: {
  title: string;
  result: ProviderResult;
  dimensions: Dimension[];
}) {
  if (result.deferred) {
    return (
      <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-5">
        <h3 className="text-sm font-medium mb-3">{title}</h3>
        <p className="text-sm text-[var(--text-muted)]">
          Batch 處理中，完成後自動更新
        </p>
      </div>
    );
  }

  if (!result.ok) {
    return (
      <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-5">
        <h3 className="text-sm font-medium mb-3">{title}</h3>
        <p className="text-sm text-[var(--text-muted)]">{result.error}</p>
      </div>
    );
  }

  const { answers, usage, costUsd, latencyMs, rawRequest, rawResponse } = result;

  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4">
      <h3 className="text-sm font-medium">{title}</h3>

      {dimensions.includes("sentiment") && answers?.sentiment && (
        <div className="border-t border-[var(--border)] pt-3">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-[var(--text-muted)]">情緒強度</span>
            <span className="text-lg font-mono-data">
              {answers.sentiment.score.toFixed(2)}
              <span className="text-xs text-[var(--text-muted)]">/10</span>
            </span>
          </div>
          <ScoreBar score={answers.sentiment.score} />
          <div className="flex items-center justify-between text-sm mt-1">
            <span>{SENTIMENT_CATEGORY_LABELS[answers.sentiment.category]}</span>
            <ConfidenceValue value={answers.sentiment.confidence} />
          </div>
        </div>
      )}

      {dimensions.includes("region") && answers?.region && (
        <div className="border-t border-[var(--border)] pt-3 flex items-center justify-between text-sm">
          <span className="text-xs text-[var(--text-muted)]">地區</span>
          <span>{REGION_LABELS[answers.region.key]}</span>
          <ConfidenceValue value={answers.region.confidence} />
        </div>
      )}

      {dimensions.includes("noise") && answers?.noise && (
        <div className="border-t border-[var(--border)] pt-3 flex items-center justify-between text-sm">
          <span className="text-xs text-[var(--text-muted)]">是否為雜訊</span>
          <span>{answers.noise.isNoise ? "是" : "否"}</span>
          {answers.noise.probability === null ? (
            <span className="text-[var(--text-muted)]">無機率值</span>
          ) : (
            <span className="font-mono-data">{answers.noise.probability.toFixed(2)}</span>
          )}
        </div>
      )}

      <div className="border-t border-[var(--border)] pt-3 flex items-center justify-between text-sm">
        <span className="text-xs text-[var(--text-muted)]">成本 / 用量 / 延遲</span>
        <span className="font-mono-data text-xs">
          ${costUsd?.toFixed(6)} · {usage?.inputTokens}+{usage?.outputTokens} tok ·{" "}
          {latencyMs === undefined ? "N/A（batch）" : `${latencyMs.toFixed(0)}ms`}
        </span>
      </div>

      <details className="border-t border-[var(--border)] pt-3">
        <summary className="text-xs text-[var(--text-muted)] cursor-pointer">
          原始請求
        </summary>
        <pre className="font-mono-data text-xs mt-2 overflow-x-auto whitespace-pre-wrap break-all bg-[var(--bg)] rounded p-3 border border-[var(--border)]">
          {JSON.stringify(rawRequest, null, 2)}
        </pre>
      </details>

      <details>
        <summary className="text-xs text-[var(--text-muted)] cursor-pointer">
          原始回應
        </summary>
        <pre className="font-mono-data text-xs mt-2 overflow-x-auto whitespace-pre-wrap break-all bg-[var(--bg)] rounded p-3 border border-[var(--border)]">
          {JSON.stringify(rawResponse, null, 2)}
        </pre>
      </details>
    </div>
  );
}
