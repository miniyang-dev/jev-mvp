export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="處理中"
      className={`inline-block w-3 h-3 rounded-full border-2 border-[var(--border)] border-t-[var(--accent)] animate-spin align-[-2px] ${className}`}
    />
  );
}
