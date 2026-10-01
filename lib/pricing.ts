/** Centralized provider pricing. Update here only when a provider's rate changes.
 * Gemini's per-model pricing lives in `lib/geminiModels.ts` instead, since it
 * varies by which model the user selects. */

export const JEV_PRICING = {
  // $42 per 1e9 input tokens; output tokens are free.
  inputPerToken: 42 / 1_000_000_000,
  outputPerToken: 0,
};

export function calcCost(
  usage: { inputTokens: number; outputTokens: number },
  pricing: { inputPerToken: number; outputPerToken: number }
): number {
  return (
    usage.inputTokens * pricing.inputPerToken +
    usage.outputTokens * pricing.outputPerToken
  );
}
