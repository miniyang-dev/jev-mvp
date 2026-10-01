"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Dimension, AnalyzeResponse } from "@/lib/schema";
import { DEFAULT_GEMINI_MODEL } from "@/lib/geminiModels";
import type { BatchRow } from "@/lib/batchTypes";
import { parseArticlesCsv, CSV_TEMPLATE } from "@/lib/csvImport";
import { aggregateBatchResults } from "@/lib/batchMetrics";
import { mergeGeminiResults, normalizeRestoredRows, sumProviderCost } from "@/lib/batchRows";
import { sortGoldenEntries } from "@/lib/goldenSet";
import { ADVERSARIAL_SAMPLES } from "@/lib/adversarialSamples";
import { useBatchHistory } from "@/hooks/useBatchHistory";
import { useBatchRun } from "@/hooks/useBatchRun";
import { useGeminiBatchJob, type FinishedBatchJob } from "@/hooks/useGeminiBatchJob";
import { useGoldenSet } from "@/hooks/useGoldenSet";
import { DimensionPicker } from "@/components/DimensionPicker";
import { GeminiModelSelect } from "@/components/GeminiModelSelect";
import { GeminiModeToggle, type GeminiMode } from "@/components/GeminiModeToggle";
import { GeminiBatchStatusCard } from "@/components/GeminiBatchStatusCard";
import { GeminiBatchHistoryTable } from "@/components/GeminiBatchHistoryTable";
import { BatchArticleRow } from "@/components/BatchArticleRow";
import { BatchSummary } from "@/components/BatchSummary";
import { GoldenSetPanel } from "@/components/GoldenSetPanel";
import { BatchRacePanel } from "@/components/BatchRacePanel";
import type { JudgmentValue } from "@/components/JudgmentPicker";

function downloadCsvTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "articles-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function BatchPage() {
  const [dimensions, setDimensions] = useState<Dimension[]>(["sentiment", "region", "noise"]);
  const [geminiModel, setGeminiModel] = useState(DEFAULT_GEMINI_MODEL);
  const [geminiMode, setGeminiMode] = useState<GeminiMode>("live");
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [csvNote, setCsvNote] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const raceRef = useRef<HTMLDivElement>(null);

  // The batch job finishes on a timer, long after the render that scheduled
  // it — read the rows it should merge into through a ref, not a stale closure.
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const golden = useGoldenSet();
  const { history, record: recordHistory } = useBatchHistory();

  const handleBatchFinished = ({ job, state, checkedAt, results }: FinishedBatchJob) => {
    const merged = mergeGeminiResults(rowsRef.current, results);
    setRows(merged);

    const jobRows = merged.filter((r) => job.itemIds.includes(r.input.id));
    recordHistory({
      tier: "batch",
      jobName: job.jobName,
      model: job.geminiModel,
      itemCount: job.itemIds.length,
      submittedAt: job.submittedAt,
      completedAt: checkedAt,
      durationMs: checkedAt - job.submittedAt,
      state,
      jevTotalCostUsd: sumProviderCost(jobRows, "jev"),
      geminiTotalCostUsd: sumProviderCost(jobRows, "gemini"),
    });
  };

  const batchJob = useGeminiBatchJob({
    onRestore: (job) => {
      const restored = normalizeRestoredRows(job.rows);
      rowsRef.current = restored;
      setRows(restored);
      setGeminiMode("batch");
      setDimensions(job.dimensions);
      setGeminiModel(job.geminiModel);
    },
    onFinished: handleBatchFinished,
  });

  const run = useBatchRun({
    rows,
    setRows,
    dimensions,
    geminiModel,
    geminiMode,
    submitBatchJob: (args) => batchJob.submit({ ...args, dimensions, geminiModel }),
    recordHistory,
  });
  const { isRunning, race } = run;

  // Starting a run jumps straight to the race — the per-article results stay
  // where they are above it, for scrolling back up to.
  const raceStartedAt = race?.startedAt;
  useEffect(() => {
    if (raceStartedAt === undefined) return;
    raceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [raceStartedAt]);

  const removeRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.input.id !== id));
  };

  const updateText = (id: string, text: string) => {
    setRows((prev) =>
      prev.map((r) => (r.input.id === id ? { ...r, input: { ...r.input, text } } : r))
    );
  };

  /** The answer is also written to the golden set, so the same article never
   * asks for this dimension again, in this run or any future one. */
  const updateJudgment = (id: string, dimension: Dimension, value: JudgmentValue) => {
    const row = rows.find((r) => r.input.id === id);
    setRows((prev) =>
      prev.map((r) =>
        r.input.id === id ? { ...r, judgment: { ...r.judgment, [dimension]: value } } : r
      )
    );
    if (row) golden.recordJudgment(row.input.text, dimension, value);
  };

  /** Loads the hostile-sample pack and seeds its authored answers into the
   * golden set. Replaces the current list rather than adding to it — loading a
   * pack means "switch to testing this," not "pile these on top of whatever
   * was there." */
  const handleImportAdversarialPack = () => {
    if (isRunning) return;
    run.clearRace();
    setRows(
      ADVERSARIAL_SAMPLES.map((sample) => ({
        input: { id: crypto.randomUUID(), text: sample.text },
        status: "idle" as const,
        judgment: {},
      }))
    );
    golden.seedAdversarial(ADVERSARIAL_SAMPLES);
    setCsvNote(`已載入對抗測試包 ${ADVERSARIAL_SAMPLES.length} 篇（取代原清單，含已知答案）`);
  };

  /** Also replaces rather than appends, for the same reason. */
  const handleCsvChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || isRunning) return;

    const text = await file.text();
    const { articles, skippedRows } = parseArticlesCsv(text);
    run.clearRace();
    setRows(articles.map((input) => ({ input, status: "idle" as const, judgment: {} })));
    setCsvNote(
      skippedRows.length > 0
        ? `已匯入 ${articles.length} 篇（取代原清單）；第 ${skippedRows.join("、")} 列無內容，已略過`
        : `已匯入 ${articles.length} 篇（取代原清單）`
    );
  };

  const runnableCount = rows.filter((r) => r.input.text.trim().length > 0).length;
  const doneCount = rows.filter((r) => r.status === "done" || r.status === "awaiting_gemini_batch").length;
  const errorCount = rows.filter((r) => r.status === "error").length;
  const doneEntries = rows
    .filter((r): r is BatchRow & { result: AnalyzeResponse } => r.status === "done" && !!r.result)
    .map((r) => ({
      result: r.result,
      judgment: r.judgment,
      golden: golden.goldenFor(r.input.text)?.judgment,
    }));
  const aggregate = aggregateBatchResults(doneEntries);
  const geminiBatchJob = batchJob.job;

  return (
    <main className="max-w-4xl mx-auto px-4 py-10 space-y-8">
      <header className="space-y-1">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-medium">批次分析</h1>
          <div className="flex gap-3">
            <Link href="/" className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] underline">
              單篇模式
            </Link>
            <Link href="/sweep" className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] underline">
              全模型掃描
            </Link>
          </div>
        </div>
        <p className="text-sm text-[var(--text-muted)]">
          多篇文章一次跑，比較 Jev 與 Gemini 的正確率、速度與成本。
        </p>
      </header>

      <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-5 space-y-5">
        <DimensionPicker dimensions={dimensions} onChange={setDimensions} />
        <GeminiModelSelect value={geminiModel} onChange={setGeminiModel} />
        <GeminiModeToggle value={geminiMode} onChange={setGeminiMode} disabled={isRunning} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isRunning}
            title={rows.length > 0 ? "會取代目前清單" : undefined}
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
            onClick={handleImportAdversarialPack}
            disabled={isRunning}
            title={rows.length > 0 ? "會取代目前清單" : undefined}
            className="rounded border border-[var(--border)] text-sm px-3 py-1.5 hover:border-[var(--accent)] transition-colors disabled:opacity-40"
          >
            載入對抗測試包
          </button>
          <button
            type="button"
            onClick={downloadCsvTemplate}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] underline"
          >
            下載範例 CSV
          </button>
        </div>

        <button
          type="button"
          onClick={run.start}
          disabled={isRunning || runnableCount === 0}
          className="rounded bg-[var(--accent)] text-white text-sm px-4 py-2 disabled:opacity-40 transition-opacity"
        >
          {isRunning
            ? `分析中… ${doneCount + errorCount}/${runnableCount}`
            : `開始批次分析（${runnableCount} 篇）`}
        </button>
      </div>

      {csvNote && <p className="text-xs text-[var(--text-muted)]">{csvNote}</p>}

      {rows.length === 0 && (
        <p className="text-sm text-[var(--text-muted)] border border-[var(--border)] rounded-md p-4 text-center">
          尚未匯入文章，請上傳 CSV 或載入對抗測試包
        </p>
      )}

      {geminiBatchJob && (
        <GeminiBatchStatusCard
          jobName={geminiBatchJob.jobName}
          itemCount={geminiBatchJob.itemIds.length}
          submittedAt={geminiBatchJob.submittedAt}
          lastCheckedAt={geminiBatchJob.lastCheckedAt}
          state={geminiBatchJob.lastKnownState}
          durationMs={batchJob.isTerminal && geminiBatchJob.lastCheckedAt ? geminiBatchJob.lastCheckedAt - geminiBatchJob.submittedAt : undefined}
          checking={batchJob.checking}
          onCheck={() => batchJob.check(geminiBatchJob)}
          onDismiss={batchJob.dismiss}
          autoChecking={!batchJob.isTerminal}
        />
      )}

      <div className="space-y-3">
        {rows.map((row, i) => (
          <BatchArticleRow
            key={row.input.id}
            index={i}
            row={row}
            geminiModel={geminiModel}
            goldenEntry={golden.goldenFor(row.input.text)}
            onTextChange={updateText}
            onJudge={updateJudgment}
            onRemove={removeRow}
          />
        ))}
      </div>

      {race && (
        <BatchRacePanel
          ref={raceRef}
          race={race}
          modelLabel={race.lanes.find((lane) => lane.id === "gemini")?.label ?? "Gemini"}
        />
      )}

      {aggregate && <BatchSummary aggregate={aggregate} />}

      <GoldenSetPanel
        entries={sortGoldenEntries(golden.goldenSet)}
        onRemove={golden.remove}
        onClear={golden.clear}
      />

      <GeminiBatchHistoryTable entries={history} />
    </main>
  );
}
