import type {
  AnalyzeRequestInput,
  AnalyzeResponse,
  Dimension,
  GeminiBatchSubmitRequestInput,
  GeminiServiceTier,
  ProviderResult,
} from "@/lib/schema";

/** Browser-side wrappers for this app's own API routes. Every page used to
 * hand-roll the same fetch + "unwrap the server's error message" dance; this
 * is the one place that knows the URLs and the error shape. */

/** POSTs JSON and returns the parsed body. A non-2xx response is thrown as an
 * Error carrying the server's `{ error }` message when it sent one. */
async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new Error(payload?.error ?? `伺服器錯誤（${res.status}）`);
  }
  return res.json() as Promise<T>;
}

/** Both providers on one article (the single-article page). */
export function analyzeArticle(request: AnalyzeRequestInput): Promise<AnalyzeResponse> {
  return postJson<AnalyzeResponse>("/api/analyze", request);
}

/** Jev only — the route skips Gemini and hands back a deferred placeholder for it. */
export async function analyzeWithJev(text: string, dimensions: Dimension[]): Promise<ProviderResult> {
  const data = await postJson<AnalyzeResponse>("/api/analyze", { text, dimensions, skipGemini: true });
  return data.jev;
}

export interface GeminiCallOptions {
  model?: string;
  serviceTier?: GeminiServiceTier;
}

/** Gemini only — the route skips Jev and hands back a deferred placeholder for it. */
export async function analyzeWithGemini(
  text: string,
  dimensions: Dimension[],
  { model, serviceTier }: GeminiCallOptions = {}
): Promise<ProviderResult> {
  const data = await postJson<AnalyzeResponse>("/api/analyze", {
    text,
    dimensions,
    skipJev: true,
    geminiModel: model,
    geminiServiceTier: serviceTier,
  });
  return data.gemini;
}

/** Submits an async Gemini batch job; resolves to the job's name. */
export async function submitGeminiBatch(request: GeminiBatchSubmitRequestInput): Promise<string> {
  const { jobName } = await postJson<{ jobName: string }>("/api/gemini-batch/submit", request);
  return jobName;
}

export interface GeminiBatchStatus {
  state: string;
  done: boolean;
  /** Present once `done`, keyed by the item ids given at submit time. */
  results?: Record<string, ProviderResult>;
}

export function fetchGeminiBatchStatus(request: {
  jobName: string;
  itemIds: string[];
  geminiModel?: string;
}): Promise<GeminiBatchStatus> {
  return postJson<GeminiBatchStatus>("/api/gemini-batch/status", request);
}
