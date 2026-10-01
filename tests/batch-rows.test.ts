import { describe, expect, it } from "vitest";
import { mergeGeminiResults, normalizeRestoredRows, sumProviderCost } from "@/lib/batchRows";
import type { BatchRow } from "@/lib/batchTypes";
import type { ProviderResult } from "@/lib/schema";

const geminiOk = (costUsd: number): ProviderResult => ({ provider: "gemini", ok: true, costUsd });

function row(id: string, status: BatchRow["status"], withResult = true): BatchRow {
  return {
    input: { id, text: id },
    status,
    judgment: {},
    result: withResult
      ? {
          dimensions: ["noise"],
          jev: { provider: "jev", ok: true, costUsd: 1 },
          gemini: { provider: "gemini", ok: false, deferred: true },
        }
      : undefined,
  };
}

describe("mergeGeminiResults", () => {
  it("fills Gemini's answer into waiting rows and marks them done", () => {
    const [a, b] = mergeGeminiResults(
      [row("a", "awaiting_gemini_batch"), row("b", "awaiting_gemini_batch")],
      { a: geminiOk(2) }
    );
    expect(a.status).toBe("done");
    expect(a.result?.gemini.costUsd).toBe(2);
    expect(b.status).toBe("awaiting_gemini_batch");
  });

  it("leaves rows without a Jev result untouched", () => {
    const [a] = mergeGeminiResults([row("a", "error", false)], { a: geminiOk(2) });
    expect(a.status).toBe("error");
  });

  it("tolerates a job that returned no results", () => {
    expect(mergeGeminiResults([row("a", "awaiting_gemini_batch")], undefined)[0].status).toBe(
      "awaiting_gemini_batch"
    );
  });
});

describe("sumProviderCost", () => {
  it("counts only successful results that carry a cost", () => {
    const merged = mergeGeminiResults([row("a", "awaiting_gemini_batch"), row("b", "idle", false)], {
      a: geminiOk(2),
    });
    expect(sumProviderCost(merged, "jev")).toBe(1);
    expect(sumProviderCost(merged, "gemini")).toBe(2);
  });
});

describe("normalizeRestoredRows", () => {
  it("turns in-flight rows into re-submit errors and keeps the rest", () => {
    const out = normalizeRestoredRows([row("a", "queued"), row("b", "running"), row("c", "done")]);
    expect(out.map((r) => r.status)).toEqual(["error", "error", "done"]);
    expect(out[0].error).toBeTruthy();
  });
});
