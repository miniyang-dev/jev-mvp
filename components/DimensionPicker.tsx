import type { Dimension } from "@/lib/schema";

const DIMENSION_OPTIONS: { key: Dimension; label: string }[] = [
  { key: "sentiment", label: "情緒強度" },
  { key: "region", label: "地區" },
  { key: "noise", label: "雜訊" },
];

export function DimensionPicker({
  dimensions,
  onChange,
}: {
  dimensions: Dimension[];
  onChange: (dimensions: Dimension[]) => void;
}) {
  const toggle = (key: Dimension) => {
    onChange(
      dimensions.includes(key) ? dimensions.filter((d) => d !== key) : [...dimensions, key]
    );
  };

  return (
    <div>
      <label className="block text-sm text-[var(--text-muted)] mb-2">
        判斷維度
      </label>
      <div className="flex flex-wrap gap-4">
        {DIMENSION_OPTIONS.map((opt) => (
          <label
            key={opt.key}
            className="flex items-center gap-2 text-sm cursor-pointer select-none"
          >
            <input
              type="checkbox"
              checked={dimensions.includes(opt.key)}
              onChange={() => toggle(opt.key)}
              className="accent-[var(--accent)]"
            />
            {opt.label}
          </label>
        ))}
      </div>
    </div>
  );
}
