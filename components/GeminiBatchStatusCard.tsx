import { formatDuration } from "@/lib/format";
import { jobStateLabel, isTerminalJobState } from "@/lib/geminiJobState";
import { Spinner } from "@/components/Spinner";

function isInProgress(state: string | undefined): boolean {
  if (!state) return true; // not checked yet — still effectively "in flight"
  if (!state.startsWith("JOB_STATE_")) return false; // our own error strings, not a real job state
  return !isTerminalJobState(state);
}

export function GeminiBatchStatusCard({
  jobName,
  itemCount,
  submittedAt,
  lastCheckedAt,
  state,
  durationMs,
  onCheck,
  checking,
  onDismiss,
  autoChecking,
}: {
  jobName: string;
  itemCount: number;
  submittedAt: number;
  lastCheckedAt?: number;
  state?: string;
  durationMs?: number;
  onCheck: () => void;
  checking: boolean;
  onDismiss?: () => void;
  /** True while this job is still in flight and being polled automatically. */
  autoChecking?: boolean;
}) {
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Gemini 批次工作</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCheck}
            disabled={checking}
            className="rounded border border-[var(--border)] text-xs px-2 py-1 hover:border-[var(--accent)] transition-colors disabled:opacity-40 inline-flex items-center gap-1.5"
          >
            {checking && <Spinner />}
            {checking ? "檢查中…" : "檢查狀態"}
          </button>
          {onDismiss && durationMs !== undefined && (
            <button
              type="button"
              onClick={onDismiss}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
            >
              關閉
            </button>
          )}
        </div>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-[var(--text-muted)]">工作 ID</dt>
        <dd className="font-mono-data truncate">{jobName}</dd>
        <dt className="text-[var(--text-muted)]">篇數</dt>
        <dd className="font-mono-data">{itemCount}</dd>
        <dt className="text-[var(--text-muted)]">送出時間</dt>
        <dd className="font-mono-data">{new Date(submittedAt).toLocaleString()}</dd>
        <dt className="text-[var(--text-muted)]">目前狀態</dt>
        <dd className="inline-flex items-center gap-1.5">
          {isInProgress(state) && <Spinner />}
          {state ? jobStateLabel(state) : "尚未檢查"}
        </dd>
        {lastCheckedAt !== undefined && (
          <>
            <dt className="text-[var(--text-muted)]">最後檢查</dt>
            <dd className="font-mono-data">{new Date(lastCheckedAt).toLocaleString()}</dd>
          </>
        )}
        {durationMs !== undefined && (
          <>
            <dt className="text-[var(--text-muted)]">這次實際耗時</dt>
            <dd className="font-mono-data">{formatDuration(durationMs)}</dd>
          </>
        )}
      </dl>
      {autoChecking && (
        <p className="text-xs text-[var(--text-muted)]">每 30 秒自動檢查，完成即停止</p>
      )}
    </div>
  );
}
