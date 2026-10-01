import { GEMINI_MODEL_OPTIONS, formatGeminiRate } from "@/lib/geminiModels";

export function GeminiModelSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm text-[var(--text-muted)] mb-2">Gemini 模型</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full sm:w-auto rounded border border-[var(--border)] bg-[var(--bg)] p-2 text-sm"
      >
        {GEMINI_MODEL_OPTIONS.map((option) => (
          <option key={option.id} value={option.id}>
            {option.displayName}（{formatGeminiRate(option)}）
          </option>
        ))}
      </select>
    </div>
  );
}
