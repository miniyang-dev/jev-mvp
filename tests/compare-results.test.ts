import { describe, expect, it } from "vitest";
import { buildComparisonRows } from "@/lib/compareResults";
import type { AnalyzeResponse } from "@/lib/schema";

const sentiment = (category: "calm" | "super_angry") => ({
  sentiment: { score: category === "calm" ? 5 : 9, category, confidence: null },
});

function response(jev: "calm" | "super_angry", gemini: "calm" | "super_angry"): AnalyzeResponse {
  return {
    dimensions: ["sentiment"],
    jev: { provider: "jev", ok: true, answers: sentiment(jev) },
    gemini: { provider: "gemini", ok: true, answers: sentiment(gemini) },
  };
}

describe("buildComparisonRows", () => {
  it("treats agreement as consensus-correct", () => {
    const [row] = buildComparisonRows(response("calm", "calm"), {});
    expect(row.truthSource).toBe("agree");
    expect(row.jevMatch).toBe(true);
    expect(row.geminiMatch).toBe(true);
  });

  it("leaves a disagreement unresolved until judged", () => {
    const [row] = buildComparisonRows(response("calm", "super_angry"), {});
    expect(row.truthSource).toBe("unresolved");
    expect(row.jevMatch).toBeNull();
  });

  it("uses the user's judgment to score a disagreement", () => {
    const [row] = buildComparisonRows(response("calm", "super_angry"), { sentiment: "super_angry" });
    expect(row.truthSource).toBe("judged");
    expect(row.jevMatch).toBe(false);
    expect(row.geminiMatch).toBe(true);
  });

  it("lets a golden answer outrank agreement on a shared wrong answer", () => {
    const [row] = buildComparisonRows(response("calm", "calm"), {}, { sentiment: "super_angry" });
    expect(row.truthSource).toBe("golden");
    expect(row.jevMatch).toBe(false);
    expect(row.geminiMatch).toBe(false);
  });

  it("omits a dimension when a provider failed", () => {
    const data = response("calm", "calm");
    data.gemini = { provider: "gemini", ok: false, error: "x" };
    expect(buildComparisonRows(data, {})).toEqual([]);
  });
});
