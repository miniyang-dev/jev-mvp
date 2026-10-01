"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Dimension, ProviderResult } from "@/lib/schema";
import { analyzeWithGemini, analyzeWithJev } from "@/lib/apiClient";
import type { BatchArticleInput } from "@/lib/batchTypes";
import { GEMINI_MODEL_OPTIONS, formatGeminiRate, getGeminiModelOption } from "@/lib/geminiModels";
import { parseArticlesCsv } from "@/lib/csvImport";
import { runWithLimit } from "@/lib/concurrency";
import { estimateSweepCost } from "@/lib/sweepEstimate";
import { summarizeSweep, type SweepEntrantInput, type SweepSummary } from "@/lib/sweepMetrics";
import { hashArticleText } from "@/lib/goldenSet";
import { ADVERSARIAL_SAMPLES } from "@/lib/adversarialSamples";
import { useGoldenSet } from "@/hooks/useGoldenSet";
import { DimensionPicker } from "@/components/DimensionPicker";
import { SweepCostWarning } from "@/components/SweepCostWarning";
import { SweepResultsTable } from "@/components/SweepResultsTable";
import { SweepStabilityPanel } from "@/components/SweepStabilityPanel";
import { SweepParetoChart, type ParetoPoint } from "@/components/SweepParetoChart";

const CONCURRENCY_LIMIT = 3;
const JEV_ID = "jev";
const ALL_ENTRANT_IDS = [JEV_ID, ...GEMINI_MODEL_OPTIONS.map((m) => m.id)];
const REPEAT_OPTIONS = [
  { value: 1, label: "1 次（不測穩定度）" },
  { value: 3, label: "3 次" },
  { value: 5, label: "5 次" },
  { value: 10, label: "10 次" },
];

/** One call: one article, one entrant (Jev or a Gemini model), one repeat. A
 * sweep is the cross product of the article set, the selected entrants and
 * the repeat count. */
interface SweepTask {
  article: BatchArticleInput;
  entrantId: string;
}

function runTask(task: SweepTask, dimensions: Dimension[]): Promise<ProviderResult> {
  return task.entrantId === JEV_ID
    ? analyzeWithJev(task.article.text, dimensions)
    : analyzeWithGemini(task.article.text, dimensions, { model: task.entrantId });
}

function entrantName(id: string): string {
  return id === JEV_ID ? "Jev" : getGeminiModelOption(id).displayName;
}

export default function SweepPage() {
  const [dimensions, setDimensions] = useState<Dimension[]>(["sentiment", "region", "noise"]);
  const [articles, setArticles] = useState<BatchArticleInput[]>([]);
  const [selected, setSelected] = useState<string[]>(ALL_ENTRANT_IDS);
  const [repeats, setRepeats] = useState(1);
  const [pasted, setPasted] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [summary, setSummary] = useState<SweepSummary | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const { goldenSet, refresh: refreshGolden, seedAdversarial } = useGoldenSet();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Keep the list in catalog order no matter what order boxes were ticked in.
  const selectedIds = ALL_ENTRANT_IDS.filter((id) => selected.includes(id));
  const geminiModelIds = selectedIds.filter((id) => id !== JEV_ID);
  const includeJev = selectedIds.includes(JEV_ID);

  const estimate = estimateSweepCost(articles, dimensions, { geminiModelIds, includeJev, repeats });

  // Any change to what's about to be spent invalidates the earlier
  // acknowledgement — ticking the box for 16 calls shouldn't carry over to 400.
  const totalCalls = estimate.geminiCallCount + estimate.jevCallCount;
  useEffect(() => {
    setAcknowledged(false);
  }, [totalCalls, estimate.estimatedTotalCostUsd]);

  const toggleEntrant = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const addArticles = (incoming: BatchArticleInput[], message: string) => {
    setArticles((prev) => [...prev, ...incoming]);
    setSummary(null);
    setNote(message);
  };

  /** Replaces the list rather than adding to it — uploading a CSV means
   * "switch to testing this set," not "pile these on top of whatever was
   * already loaded" (matches /batch's CSV upload). */
  const handleCsvChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || running) return;
    const { articles: parsed, skippedRows } = parseArticlesCsv(await file.text());
    setArticles(parsed);
    setSummary(null);
    setNote(
      skippedRows.length > 0
        ? `已匯入 ${parsed.length} 篇（取代原清單）；第 ${skippedRows.join("、")} 列無內容，已略過`
        : `已匯入 ${parsed.length} 篇（取代原清單）`
    );
  };

  const handleAddPasted = () => {
    const text = pasted.trim();
    if (!text) return;
    addArticles([{ id: crypto.randomUUID(), text }], "已加入 1 篇");
    setPasted("");
  };

  /** Seeds the pack's authored answers here too, so a sweep started from this
   * page scores against real known answers. Replaces the list rather than
   * adding to it, matching /batch and this page's own CSV upload. */
  const handleLoadAdversarial = () => {
    if (running) return;
    seedAdversarial(ADVERSARIAL_SAMPLES);
    setArticles(ADVERSARIAL_SAMPLES.map((s) => ({ id: crypto.randomUUID(), text: s.text })));
    setSummary(null);
    setNote(`已載入對抗測試包 ${ADVERSARIAL_SAMPLES.length} 篇（取代原清單，含已知答案）`);
  };

  const startSweep = async () => {
    if (articles.length === 0 || selectedIds.length === 0) return;
    const runDimensions = dimensions;
    const runRepeats = repeats;
    const runEntrants = selectedIds;

    // Round-major order, so every entrant's first pass comes back before
    // anyone's repeats — progress fills in evenly instead of one model at a time.
    const tasks: SweepTask[] = Array.from({ length: runRepeats }, () =>
      articles.flatMap((article) => runEntrants.map((entrantId) => ({ article, entrantId })))
    ).flat();

    setRunning(true);
    setSummary(null);
    setErrors([]);
    setProgress({ done: 0, total: tasks.length });

    const runs: Record<string, Record<string, ProviderResult[]>> = Object.fromEntries(
      runEntrants.map((id) => [id, Object.fromEntries(articles.map((a) => [a.id, []]))])
    );
    const failures: string[] = [];
    let done = 0;

    await runWithLimit(
      tasks,
      CONCURRENCY_LIMIT,
      (task) => runTask(task, runDimensions),
      (index, outcome) => {
        const task = tasks[index];
        const label = entrantName(task.entrantId);
        const provider = task.entrantId === JEV_ID ? "jev" : "gemini";
        const result: ProviderResult = outcome.ok
          ? outcome.value
          : {
              provider,
              ok: false,
              error: outcome.error instanceof Error ? outcome.error.message : "未知錯誤",
            };
        runs[task.entrantId][task.article.id].push(result);
        // A provider that errors still comes back in a 200 response, so its
        // reason has to be picked up here too — otherwise a model that failed
        // every article just shows "0 succeeded" with no explanation.
        if (!result.ok && result.error) failures.push(`${label}：${result.error}`);
        done += 1;
        setProgress({ done, total: tasks.length });
      }
    );

    const entrants: SweepEntrantInput[] = runEntrants.map((id) => ({
      id,
      displayName: entrantName(id),
      isJev: id === JEV_ID,
      runsByArticle: runs[id],
    }));

    const currentGolden = refreshGolden();
    setSummary(
      summarizeSweep({
        articles,
        dimensions: runDimensions,
        entrants,
        repeats: runRepeats,
        getGolden: (text) => currentGolden[hashArticleText(text)]?.judgment,
      })
    );
    // Same message repeated across many articles is noise; show each kind once.
    setErrors([...new Set(failures)]);
    setRunning(false);
  };

  const goldenCovered = articles.filter((a) => goldenSet[hashArticleText(a.text)]).length;
  const paretoPoints: ParetoPoint[] =
    summary?.entrants.map((entrant) => ({
      modelId: entrant.id,
      displayName: entrant.displayName,
      avgCostUsd: entrant.avgCostUsd,
      correctnessPct: entrant.correctness
        ? (entrant.correctness.correct / entrant.correctness.total) * 100
        : null,
      isJev: entrant.isJev,
    })) ?? [];

  return (
    <main className="max-w-4xl mx-auto px-4 py-10 space-y-8">
      <header className="space-y-1">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-medium">全模型掃描</h1>
          <div className="flex gap-3">
            <Link href="/" className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] underline">
              單篇模式
            </Link>
            <Link href="/batch" className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] underline">
              批次分析
            </Link>
          </div>
        </div>
        <p className="text-sm text-[var(--text-muted)]">
          挑選模型跑同一批文章，比較成本、正確率與回應穩定度。
        </p>
      </header>

      <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-5 space-y-5">
        <DimensionPicker dimensions={dimensions} onChange={setDimensions} />

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="block text-sm text-[var(--text-muted)]">
              參賽模型（已選 {selectedIds.length}／{ALL_ENTRANT_IDS.length}）
            </label>
            <div className="flex gap-3 text-xs">
              <button
                type="button"
                onClick={() => setSelected(ALL_ENTRANT_IDS)}
                disabled={running}
                className="text-[var(--text-muted)] hover:text-[var(--text)] underline disabled:opacity-40"
              >
                全選
              </button>
              <button
                type="button"
                onClick={() => setSelected([])}
                disabled={running}
                className="text-[var(--text-muted)] hover:text-[var(--text)] underline disabled:opacity-40"
              >
                清除
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            {ALL_ENTRANT_IDS.map((id) => (
              <label key={id} className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={selected.includes(id)}
                  onChange={() => toggleEntrant(id)}
                  disabled={running}
                  className="accent-[var(--accent)]"
                />
                <span className={id === JEV_ID ? "font-medium" : ""}>{entrantName(id)}</span>
                {id !== JEV_ID && (
                  <span className="text-xs text-[var(--text-muted)]">
                    {formatGeminiRate(getGeminiModelOption(id))}
                  </span>
                )}
              </label>
            ))}
          </div>
          {selectedIds.length === 0 && (
            <p className="text-xs text-[var(--text-muted)]">至少要選一個模型</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="repeats" className="block text-sm text-[var(--text-muted)]">
            每篇重複次數（測回應穩定度）
          </label>
          <select
            id="repeats"
            value={repeats}
            onChange={(e) => setRepeats(Number(e.target.value))}
            disabled={running}
            className="rounded border border-[var(--border)] bg-[var(--bg)] p-2 text-sm"
          >
            {REPEAT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {repeats > 1 && (
            <p className="text-xs text-[var(--text-muted)]">
              每篇對每個模型送 {repeats} 次，費用 ×{repeats}。
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label className="block text-sm text-[var(--text-muted)]">文章來源</label>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={running}
              title={articles.length > 0 ? "會取代目前清單" : undefined}
              className="rounded border border-[var(--border)] text-sm px-3 py-1.5 hover:border-[var(--accent)] transition-colors disabled:opacity-40"
            >
              上傳 CSV
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleCsvChange}
            />
            <button
              type="button"
              onClick={handleLoadAdversarial}
              disabled={running}
              title={articles.length > 0 ? "會取代目前清單" : undefined}
              className="rounded border border-[var(--border)] text-sm px-3 py-1.5 hover:border-[var(--accent)] transition-colors disabled:opacity-40"
            >
              載入對抗測試包
            </button>
            {articles.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setArticles([]);
                  setSummary(null);
                  setNote(null);
                }}
                disabled={running}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] underline disabled:opacity-40"
              >
                清空文章
              </button>
            )}
          </div>

          <textarea
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            disabled={running}
            rows={3}
            placeholder="或直接貼上一篇文章…"
            className="w-full rounded border border-[var(--border)] bg-[var(--bg)] p-3 text-sm outline-none focus:border-[var(--accent)] transition-colors resize-y disabled:opacity-60"
          />
          <button
            type="button"
            onClick={handleAddPasted}
            disabled={running || pasted.trim().length === 0}
            className="rounded border border-[var(--border)] text-sm px-3 py-1.5 hover:border-[var(--accent)] transition-colors disabled:opacity-40"
          >
            加入這篇
          </button>
        </div>

        {note && <p className="text-xs text-[var(--text-muted)]">{note}</p>}
        {articles.length > 0 && (
          <p className="text-xs text-[var(--text-muted)]">
            已載入 {articles.length} 篇，其中 {goldenCovered} 篇有黃金答案
            {goldenCovered === 0 &&
              "——無法計算正確率（穩定度不受影響）"}
          </p>
        )}
      </div>

      {articles.length > 0 && (
        <SweepCostWarning
          estimate={estimate}
          acknowledged={acknowledged}
          onAcknowledgedChange={setAcknowledged}
          onConfirm={startSweep}
          disabled={dimensions.length === 0 || selectedIds.length === 0}
          running={running}
        />
      )}

      {running && (
        <p className="text-sm text-[var(--text-muted)]">
          掃描中… {progress.done}/{progress.total} 次呼叫完成
        </p>
      )}

      {errors.length > 0 && (
        <div className="rounded-md border border-[var(--border)] p-3 space-y-1">
          <p className="text-xs text-[var(--text-muted)]">部分呼叫失敗：</p>
          {errors.map((error) => (
            <p key={error} className="text-xs text-[var(--text-muted)]">
              {error}
            </p>
          ))}
        </div>
      )}

      {summary && (
        <div className="space-y-6">
          <SweepResultsTable summary={summary} />
          <SweepStabilityPanel summary={summary} />
          <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
            <h3 className="text-sm font-medium">成本 × 正確率</h3>
            <SweepParetoChart points={paretoPoints} />
          </div>
        </div>
      )}
    </main>
  );
}
