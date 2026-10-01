"use client";

import { useState } from "react";
import Link from "next/link";
import { ArticleForm, type ArticleFormPayload } from "@/components/ArticleForm";
import { ProviderResultCard } from "@/components/ProviderResultCard";
import { ComparisonTable } from "@/components/ComparisonTable";
import { SummaryAnalysis } from "@/components/SummaryAnalysis";
import type { AnalyzeResponse, Dimension, Judgment } from "@/lib/schema";
import { analyzeArticle } from "@/lib/apiClient";
import { getGeminiModelOption } from "@/lib/geminiModels";
import type { JudgmentValue } from "@/components/JudgmentPicker";

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AnalyzeResponse | null>(null);
  const [judgment, setJudgment] = useState<Judgment>({});
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (payload: ArticleFormPayload) => {
    setLoading(true);
    setError(null);
    try {
      const result = await analyzeArticle(payload);
      setJudgment({});
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知錯誤");
    } finally {
      setLoading(false);
    }
  };

  const handleJudge = (dimension: Dimension, value: JudgmentValue) => {
    setJudgment((prev) => ({ ...prev, [dimension]: value }));
  };

  return (
    <main className="max-w-4xl mx-auto px-4 py-10 space-y-8">
      <header className="space-y-1">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-medium">Jev vs Gemini 判斷比較</h1>
          <div className="flex gap-3">
            <Link href="/batch" className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] underline">
              批次分析
            </Link>
            <Link href="/sweep" className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] underline">
              全模型掃描
            </Link>
          </div>
        </div>
        <p className="text-sm text-[var(--text-muted)]">
          同一篇文章，比較 Jev 與 Gemini 的判斷結果與成本。
        </p>
      </header>

      <ArticleForm onSubmit={handleSubmit} loading={loading} />

      {error && (
        <p className="text-sm text-[var(--text-muted)] border border-[var(--border)] rounded-md p-3">
          {error}
        </p>
      )}

      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ProviderResultCard title="Jev (TypeSafe)" result={data.jev} dimensions={data.dimensions} />
            <ProviderResultCard
              title={getGeminiModelOption(data.gemini.model).displayName}
              result={data.gemini}
              dimensions={data.dimensions}
            />
          </div>
          <ComparisonTable data={data} judgment={judgment} onJudge={handleJudge} />
          <SummaryAnalysis data={data} judgment={judgment} />
        </div>
      )}
    </main>
  );
}
