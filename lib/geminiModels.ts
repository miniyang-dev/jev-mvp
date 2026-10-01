/**
 * Selectable Gemini flash-tier models, each with its own pricing.
 * Single source of truth for the model dropdown (client) and the
 * Gemini provider's request/cost calculation (server).
 * Verified callable against the Gemini API; prices per official pricing page.
 */
export interface GeminiModelOption {
  id: string;
  displayName: string;
  inputPerToken: number;
  outputPerToken: number;
  /** Whether this model accepts `thinkingConfig.thinkingBudget: 0` (fully
   * disabling extended thinking). Confirmed by direct testing that
   * `gemini-3.5-flash-lite` rejects it with a 400 INVALID_ARGUMENT while every
   * other model here accepts it — that one quirk, not a broken request shape
   * in general. Defaults to true; only list an exception when confirmed. */
  supportsZeroThinkingBudget?: boolean;
}

export const GEMINI_MODEL_OPTIONS: GeminiModelOption[] = [
  {
    id: "gemini-3.1-flash-lite",
    displayName: "Gemini 3.1 Flash-Lite",
    inputPerToken: 0.25 / 1_000_000,
    outputPerToken: 1.5 / 1_000_000,
  },
  {
    id: "gemini-3.5-flash-lite",
    displayName: "Gemini 3.5 Flash-Lite",
    inputPerToken: 0.3 / 1_000_000,
    outputPerToken: 2.5 / 1_000_000,
    supportsZeroThinkingBudget: false,
  },
  {
    id: "gemini-3-flash-preview",
    displayName: "Gemini 3 Flash Preview",
    inputPerToken: 0.5 / 1_000_000,
    outputPerToken: 3 / 1_000_000,
  },
  {
    id: "gemini-3.6-flash",
    displayName: "Gemini 3.6 Flash",
    inputPerToken: 0.75 / 1_000_000,
    outputPerToken: 3.75 / 1_000_000,
  },
  {
    id: "gemini-3.7-flash",
    displayName: "Gemini 3.7 Flash",
    inputPerToken: 0.75 / 1_000_000,
    outputPerToken: 3.75 / 1_000_000,
  },
  {
    id: "gemini-3.8-flash",
    displayName: "Gemini 3.8 Flash",
    inputPerToken: 0.75 / 1_000_000,
    outputPerToken: 3.75 / 1_000_000,
  },
  {
    id: "gemini-3.5-flash",
    displayName: "Gemini 3.5 Flash",
    inputPerToken: 1.5 / 1_000_000,
    outputPerToken: 9 / 1_000_000,
  },
];

export const GEMINI_MODEL_IDS = GEMINI_MODEL_OPTIONS.map((m) => m.id);
export const DEFAULT_GEMINI_MODEL = GEMINI_MODEL_OPTIONS[0].id;

/** Gemini's Batch API charges half the standard per-token rate. */
export const BATCH_DISCOUNT_MULTIPLIER = 0.5;

/** Gemini's Flex service tier also charges half the standard rate, in exchange
 * for variable (1~15min target, best-effort) synchronous latency instead of
 * Batch's fully async up-to-24h job. */
export const FLEX_DISCOUNT_MULTIPLIER = 0.5;

export function getGeminiModelOption(id: string | undefined): GeminiModelOption {
  return GEMINI_MODEL_OPTIONS.find((m) => m.id === id) ?? GEMINI_MODEL_OPTIONS[0];
}

/** e.g. "$0.25 / $1.50 每M tokens" for showing a model's rate next to its name. */
export function formatGeminiRate(option: GeminiModelOption): string {
  const input = option.inputPerToken * 1_000_000;
  const output = option.outputPerToken * 1_000_000;
  return `$${input.toFixed(2)} / $${output.toFixed(2)} 每M tokens`;
}
