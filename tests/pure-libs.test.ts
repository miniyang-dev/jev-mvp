import { describe, expect, it } from "vitest";
import { scoreToCategory } from "@/lib/sentimentScale";
import { runWithLimit } from "@/lib/concurrency";
import { parseArticlesCsv } from "@/lib/csvImport";
import { estimateSweepCost } from "@/lib/sweepEstimate";
import { hashArticleText, knownDimensions, type GoldenLabelEntry } from "@/lib/goldenSet";
import { isTerminalJobState } from "@/lib/geminiJobState";
import { createRace, markItemRunning, settleItem } from "@/lib/batchRace";
import { calcCost } from "@/lib/pricing";
import { regionKeyForLabel } from "@/lib/labels";

describe("scoreToCategory", () => {
  it.each([
    [5, "calm"],
    [4.6, "calm"],
    [4, "general_happy"],
    [2, "super_happy"],
    [1, "super_happy"],
    [6, "general_angry"],
    [8, "super_angry"],
    [10, "super_angry"],
  ])("score %s -> %s", (score, expected) => {
    expect(scoreToCategory(score)).toBe(expected);
  });
});

describe("runWithLimit", () => {
  it("never exceeds the limit and keeps result order", async () => {
    let active = 0;
    let peak = 0;
    const results = await runWithLimit([1, 2, 3, 4, 5, 6], 2, async (n) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return n * 10;
    });
    expect(peak).toBeLessThanOrEqual(2);
    expect(results.map((r) => (r.ok ? r.value : null))).toEqual([10, 20, 30, 40, 50, 60]);
  });

  it("reports a throwing worker as a failed outcome without stopping others", async () => {
    const results = await runWithLimit([1, 2, 3], 3, async (n) => {
      if (n === 2) throw new Error("boom");
      return n;
    });
    expect(results.map((r) => r.ok)).toEqual([true, false, true]);
  });
});

describe("parseArticlesCsv", () => {
  it("keeps commas/newlines inside quoted text and skips empty rows", () => {
    const csv = 'text\n"a, b\nc"\n\n"   "\n"d"\n';
    const { articles, skippedRows } = parseArticlesCsv(csv);
    expect(articles.map((a) => a.text)).toEqual(["a, b\nc", "d"]);
    expect(skippedRows).toEqual([2]);
  });
});

describe("estimateSweepCost", () => {
  it("multiplies calls by articles x models x repeats", () => {
    const e = estimateSweepCost([{ text: "abcd" }, { text: "efgh" }], ["sentiment"], {
      geminiModelIds: ["gemini-3.1-flash-lite", "gemini-3.5-flash"],
      includeJev: true,
      repeats: 3,
    });
    expect(e.geminiCallCount).toBe(12);
    expect(e.jevCallCount).toBe(6);
    expect(e.estimatedTotalCostUsd).toBeCloseTo(e.estimatedGeminiCostUsd + e.estimatedJevCostUsd);
  });
});

describe("hashArticleText", () => {
  it("is stable, trims outer whitespace, and distinguishes different text", () => {
    expect(hashArticleText("  hello ")).toBe(hashArticleText("hello"));
    expect(hashArticleText("hello")).not.toBe(hashArticleText("hellp"));
    expect(hashArticleText("hello")).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe("knownDimensions", () => {
  it("lists only dimensions that have an answer (false counts as an answer)", () => {
    const entry = { judgment: { noise: false, region: "japan" } } as GoldenLabelEntry;
    expect(knownDimensions(entry).sort()).toEqual(["noise", "region"]);
  });
});

describe("isTerminalJobState", () => {
  it("separates finished from in-flight states", () => {
    expect(isTerminalJobState("JOB_STATE_SUCCEEDED")).toBe(true);
    expect(isTerminalJobState("JOB_STATE_RUNNING")).toBe(false);
    expect(isTerminalJobState(undefined)).toBe(false);
  });
});

describe("batchRace", () => {
  it("stops a lane's clock only when its last article settles", () => {
    let race = createRace(2, [{ id: "jev", label: "Jev" }], 1000);
    race = markItemRunning(race, "jev", 0);
    race = settleItem(race, "jev", 0, { provider: "jev", ok: true, costUsd: 0.5, latencyMs: 10 }, 2000);
    expect(race.lanes[0].finishedAt).toBeNull();
    race = settleItem(race, "jev", 1, { provider: "jev", ok: false, error: "x" }, 3000);
    expect(race.lanes[0].finishedAt).toBe(3000);
    expect(race.lanes[0].costUsd).toBe(0.5);
  });
});

describe("pricing / labels", () => {
  it("calcCost sums input and output", () => {
    expect(calcCost({ inputTokens: 10, outputTokens: 5 }, { inputPerToken: 2, outputPerToken: 3 })).toBe(35);
  });
  it("regionKeyForLabel maps display label back to key", () => {
    expect(regionKeyForLabel("日本")).toBe("japan");
    expect(regionKeyForLabel("火星")).toBeNull();
  });
});
