import type { Dimension } from "@/lib/schema";
import { getGeminiModelOption } from "@/lib/geminiModels";
import { calcCost, JEV_PRICING } from "@/lib/pricing";

/** ~4 characters per token. A widely-cited rule of thumb that is noticeably
 * worse for CJK text than for English — this is a pre-flight warning so nobody
 * fires a multi-model run blind, not a billing figure. The UI must label it 粗估. */
const CHARS_PER_TOKEN = 4;

/** The JSON answer is a handful of short enum fields, so output is small and
 * roughly proportional to how many dimensions were asked for. */
const OUTPUT_TOKENS_PER_DIMENSION = 40;

export function estimateInputTokens(text: string): number {
  return Math.ceil(text.trim().length / CHARS_PER_TOKEN);
}

export function estimateOutputTokens(dimensions: Dimension[]): number {
  return dimensions.length * OUTPUT_TOKENS_PER_DIMENSION;
}

export interface SweepCostEstimate {
  articleCount: number;
  modelCount: number;
  repeats: number;
  geminiCallCount: number;
  jevCallCount: number;
  estimatedGeminiCostUsd: number;
  estimatedJevCostUsd: number;
  estimatedTotalCostUsd: number;
}

export interface SweepSelection {
  /** Which Gemini models to run. */
  geminiModelIds: string[];
  includeJev: boolean;
  /** Times each article is sent to each entrant (>1 measures answer stability). */
  repeats: number;
}

/** What one sweep is about to cost: every article against every selected
 * entrant, `repeats` times each. */
export function estimateSweepCost(
  articles: { text: string }[],
  dimensions: Dimension[],
  { geminiModelIds, includeJev, repeats }: SweepSelection
): SweepCostEstimate {
  const outputTokens = estimateOutputTokens(dimensions);
  const usages = articles.map((a) => ({
    inputTokens: estimateInputTokens(a.text),
    outputTokens,
  }));
  const perPass = (pricing: { inputPerToken: number; outputPerToken: number }) =>
    usages.reduce((sum, usage) => sum + calcCost(usage, pricing), 0);

  const estimatedGeminiCostUsd =
    geminiModelIds.reduce((sum, id) => sum + perPass(getGeminiModelOption(id)), 0) * repeats;
  const estimatedJevCostUsd = includeJev ? perPass(JEV_PRICING) * repeats : 0;

  return {
    articleCount: articles.length,
    modelCount: geminiModelIds.length,
    repeats,
    geminiCallCount: articles.length * geminiModelIds.length * repeats,
    jevCallCount: includeJev ? articles.length * repeats : 0,
    estimatedGeminiCostUsd,
    estimatedJevCostUsd,
    estimatedTotalCostUsd: estimatedGeminiCostUsd + estimatedJevCostUsd,
  };
}
