import { describe, expect, it } from "vitest";
import type { GenerateContentResponse } from "@google/genai";
import { parseAnswer } from "@/lib/providers/gemini";

// A batch job's inlined response is a plain object: no `text` getter, only candidates.
const plain = (json: string) =>
  ({ candidates: [{ content: { parts: [{ text: json }] } }] }) as unknown as GenerateContentResponse;

describe("gemini parseAnswer", () => {
  it("reads text from candidate parts when the .text getter is absent", () => {
    const answers = parseAnswer(plain('{"sentiment":9,"region":"日本","is_noise":false}'));
    expect(answers.sentiment?.category).toBe("super_angry");
    expect(answers.region?.key).toBe("japan");
    expect(answers.noise).toEqual({ isNoise: false, probability: null });
  });

  it("throws when Gemini returned nothing", () => {
    expect(() => parseAnswer({} as GenerateContentResponse)).toThrow();
  });
});

import { buildRequestBody } from "@/lib/providers/gemini";

describe("gemini request body", () => {
  const input = { text: "文章", dimensions: ["noise" as const] };

  it("only asks for flex when the caller opts in", () => {
    expect(buildRequestBody(input, "gemini-3.1-flash-lite").config).not.toHaveProperty("serviceTier");
    expect(buildRequestBody(input, "gemini-3.1-flash-lite", "standard").config).not.toHaveProperty("serviceTier");
    expect(buildRequestBody(input, "gemini-3.1-flash-lite", "flex").config).toHaveProperty("serviceTier");
  });

  it("omits thinkingBudget for the model that rejects it", () => {
    expect(buildRequestBody(input, "gemini-3.5-flash-lite").config).not.toHaveProperty("thinkingConfig");
    expect(buildRequestBody(input, "gemini-3.1-flash-lite").config).toHaveProperty("thinkingConfig");
  });
});
