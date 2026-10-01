import type { Dimension, ProviderAnswers } from "@/lib/schema";

export interface AnalyzeInput {
  text: string;
  dimensions: Dimension[];
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

export interface ProviderAnalysis {
  rawRequest: unknown;
  rawResponse: unknown;
  answers: ProviderAnswers;
  usage: Usage;
  costUsd: number;
  latencyMs: number;
  /** The exact model id that produced this result. */
  model: string;
}

/** Every judgement provider (Jev, Gemini, ...) implements this so callers never
 * need to know which one they're talking to. `TOptions` is the provider's own
 * tuning knobs (Gemini's model and service tier, say) — they live on the
 * provider that understands them instead of on the shared input, so a provider
 * with nothing to tune (Jev) isn't handed fields it must ignore. */
export interface AnalysisProvider<TOptions = undefined> {
  readonly id: "jev" | "gemini";
  analyze(input: AnalyzeInput, options?: TOptions): Promise<ProviderAnalysis>;
}
