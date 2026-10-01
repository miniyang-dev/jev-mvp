import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeWithGemini, analyzeWithJev, fetchGeminiBatchStatus } from "@/lib/apiClient";

function stubFetch(response: { ok: boolean; status?: number; json: () => Promise<unknown> }) {
  const fn = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("apiClient", () => {
  it("asks the route to skip Gemini for a Jev call and returns the jev half", async () => {
    const fetchFn = stubFetch({
      ok: true,
      json: async () => ({ jev: { provider: "jev", ok: true }, gemini: { provider: "gemini", ok: false } }),
    });
    const result = await analyzeWithJev("hi", ["noise"]);
    expect(result.provider).toBe("jev");
    expect(JSON.parse(fetchFn.mock.calls[0][1].body)).toMatchObject({ text: "hi", skipGemini: true });
  });

  it("asks the route to skip Jev for a Gemini call and forwards model and tier", async () => {
    const fetchFn = stubFetch({
      ok: true,
      json: async () => ({ jev: { provider: "jev", ok: false }, gemini: { provider: "gemini", ok: true } }),
    });
    const result = await analyzeWithGemini("hi", ["noise"], { model: "m", serviceTier: "flex" });
    expect(result.provider).toBe("gemini");
    expect(JSON.parse(fetchFn.mock.calls[0][1].body)).toMatchObject({
      skipJev: true,
      geminiModel: "m",
      geminiServiceTier: "flex",
    });
  });

  it("surfaces the server's error message", async () => {
    stubFetch({ ok: false, status: 400, json: async () => ({ error: "文章內容不可為空" }) });
    await expect(analyzeWithJev("", ["noise"])).rejects.toThrow("文章內容不可為空");
  });

  it("falls back to the status code when the error body isn't JSON", async () => {
    stubFetch({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error("not json");
      },
    });
    await expect(fetchGeminiBatchStatus({ jobName: "j", itemIds: ["a"] })).rejects.toThrow("502");
  });
});
