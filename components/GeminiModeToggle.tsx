export type GeminiMode = "live" | "flex" | "batch";

const OPTIONS: { value: GeminiMode; label: string }[] = [
  { value: "live", label: "即時" },
  { value: "flex", label: "Flex（五折，同步但較慢）" },
  { value: "batch", label: "Batch（五折，非同步，可能數小時）" },
];

export function GeminiModeToggle({
  value,
  onChange,
  disabled,
}: {
  value: GeminiMode;
  onChange: (mode: GeminiMode) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm text-[var(--text-muted)] mb-2">Gemini 執行方式</label>
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 text-sm">
        {OPTIONS.map((opt) => (
          <label key={opt.value} className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="radio"
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              disabled={disabled}
              className="accent-[var(--accent)]"
            />
            {opt.label}
          </label>
        ))}
      </div>
    </div>
  );
}
