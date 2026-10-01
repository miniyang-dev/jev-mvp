"use client";

import { useState } from "react";
import type { Dimension } from "@/lib/schema";
import { DEFAULT_GEMINI_MODEL } from "@/lib/geminiModels";
import { DimensionPicker } from "@/components/DimensionPicker";
import { GeminiModelSelect } from "@/components/GeminiModelSelect";

export interface ArticleFormPayload {
  text: string;
  dimensions: Dimension[];
  geminiModel: string;
}

export function ArticleForm({
  onSubmit,
  loading,
}: {
  onSubmit: (payload: ArticleFormPayload) => void;
  loading: boolean;
}) {
  const [text, setText] = useState("");
  const [dimensions, setDimensions] = useState<Dimension[]>(["sentiment", "region", "noise"]);
  const [geminiModel, setGeminiModel] = useState(DEFAULT_GEMINI_MODEL);

  const canSubmit = text.trim().length > 0 && dimensions.length > 0 && !loading;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({ text, dimensions, geminiModel });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-5 space-y-5"
    >
      <div>
        <label className="block text-sm text-[var(--text-muted)] mb-2">
          文章內容
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder="貼上要分析的文章..."
          className="w-full rounded border border-[var(--border)] bg-[var(--bg)] p-3 text-sm outline-none focus:border-[var(--accent)] transition-colors resize-y"
        />
      </div>

      <DimensionPicker dimensions={dimensions} onChange={setDimensions} />

      <GeminiModelSelect value={geminiModel} onChange={setGeminiModel} />

      <button
        type="submit"
        disabled={!canSubmit}
        className="rounded bg-[var(--accent)] text-white text-sm px-4 py-2 disabled:opacity-40 transition-opacity"
      >
        {loading ? "分析中…" : "送出分析"}
      </button>
    </form>
  );
}
