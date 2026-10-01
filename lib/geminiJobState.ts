/** Single source of truth for Gemini Batch job state labels/terminality,
 * shared between the status API route and the batch page's UI. */
export const JOB_STATE_LABELS: Record<string, string> = {
  JOB_STATE_UNSPECIFIED: "未知",
  JOB_STATE_QUEUED: "排隊中",
  JOB_STATE_PENDING: "準備中",
  JOB_STATE_RUNNING: "執行中",
  JOB_STATE_SUCCEEDED: "已完成",
  JOB_STATE_FAILED: "失敗",
  JOB_STATE_CANCELLING: "取消中",
  JOB_STATE_CANCELLED: "已取消",
  JOB_STATE_PAUSED: "已暫停",
  JOB_STATE_EXPIRED: "已過期",
  JOB_STATE_UPDATING: "更新中",
  JOB_STATE_PARTIALLY_SUCCEEDED: "部分完成",
};

export const TERMINAL_JOB_STATES = new Set([
  "JOB_STATE_SUCCEEDED",
  "JOB_STATE_PARTIALLY_SUCCEEDED",
  "JOB_STATE_FAILED",
  "JOB_STATE_CANCELLED",
  "JOB_STATE_EXPIRED",
]);

export function isTerminalJobState(state: string | undefined): boolean {
  return state !== undefined && TERMINAL_JOB_STATES.has(state);
}

export function jobStateLabel(state: string): string {
  return JOB_STATE_LABELS[state] ?? state;
}
