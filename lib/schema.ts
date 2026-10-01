import { z } from "zod";
import {
  REGION_KEYS,
  SENTIMENT_CATEGORY_KEYS,
  type RegionKey,
  type SentimentCategory,
} from "@/lib/labels";
import { GEMINI_MODEL_IDS, DEFAULT_GEMINI_MODEL } from "@/lib/geminiModels";

/** Upper bounds on what one request may spend. The endpoints bill the owner's
 * API quota per token, so an unbounded body is an unbounded invoice. */
export const MAX_ARTICLE_CHARS = 50_000;
export const MAX_BATCH_ITEMS = 1_000;

export const DimensionSchema = z.enum(["sentiment", "region", "noise"]);
export type Dimension = z.infer<typeof DimensionSchema>;

export const RegionKeySchema = z.enum(
  REGION_KEYS as [RegionKey, ...RegionKey[]]
);
export const SentimentCategorySchema = z.enum(
  SENTIMENT_CATEGORY_KEYS as [SentimentCategory, ...SentimentCategory[]]
);
export const GeminiModelSchema = z.enum(
  GEMINI_MODEL_IDS as [string, ...string[]]
);

export const GeminiServiceTierSchema = z.enum(["standard", "flex"]);
export type GeminiServiceTier = z.infer<typeof GeminiServiceTierSchema>;

export const AnalyzeRequestSchema = z.object({
  text: z.string().min(1, "文章內容不可為空").max(MAX_ARTICLE_CHARS, `文章不可超過 ${MAX_ARTICLE_CHARS} 字`),
  dimensions: z.array(DimensionSchema).min(1, "至少要選一個判斷維度"),
  geminiModel: GeminiModelSchema.default(DEFAULT_GEMINI_MODEL),
  /** Batch 省錢模式下，Gemini 改走非同步 batch job，這次呼叫不用再問 Gemini。 */
  skipGemini: z.boolean().optional(),
  /** 對稱 skipGemini：模型掃描時同一篇文章要跑 7 個 Gemini 模型，
   * Jev 只需要跑一次當基準，其餘 6 次不用再問 Jev。 */
  skipJev: z.boolean().optional(),
  /** Flex 省錢模式：同步呼叫但走五折、較慢的 Flex 服務層級。 */
  geminiServiceTier: GeminiServiceTierSchema.default("standard"),
});
export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;
/** What a caller sends: fields with schema defaults may be omitted. */
export type AnalyzeRequestInput = z.input<typeof AnalyzeRequestSchema>;

/** The "who's actually right" call for a dimension where Jev and Gemini disagreed.
 * Filled in after the fact, only when needed — see `lib/compareResults.ts`. */
export const JudgmentSchema = z.object({
  sentiment: SentimentCategorySchema.optional(),
  region: RegionKeySchema.optional(),
  noise: z.boolean().optional(),
});
export type Judgment = z.infer<typeof JudgmentSchema>;

export const ProviderAnswersSchema = z.object({
  sentiment: z
    .object({
      score: z.number(),
      category: SentimentCategorySchema,
      confidence: z.number().nullable(),
    })
    .optional(),
  region: z
    .object({
      key: RegionKeySchema,
      confidence: z.number().nullable(),
    })
    .optional(),
  noise: z
    .object({
      isNoise: z.boolean(),
      probability: z.number().nullable(),
    })
    .optional(),
});
export type ProviderAnswers = z.infer<typeof ProviderAnswersSchema>;

export const ProviderResultSchema = z.object({
  provider: z.enum(["jev", "gemini"]),
  ok: z.boolean(),
  error: z.string().optional(),
  /** Not an error — this provider's answer is intentionally deferred (Gemini batch mode). */
  deferred: z.boolean().optional(),
  rawRequest: z.unknown().optional(),
  rawResponse: z.unknown().optional(),
  answers: ProviderAnswersSchema.optional(),
  usage: z
    .object({ inputTokens: z.number(), outputTokens: z.number() })
    .optional(),
  costUsd: z.number().optional(),
  latencyMs: z.number().optional(),
  model: z.string().optional(),
});
export type ProviderResult = z.infer<typeof ProviderResultSchema>;

export const GeminiBatchSubmitRequestSchema = z.object({
  items: z
    .array(z.object({ id: z.string(), text: z.string().min(1).max(MAX_ARTICLE_CHARS) }))
    .min(1)
    .max(MAX_BATCH_ITEMS),
  dimensions: z.array(DimensionSchema).min(1),
  geminiModel: GeminiModelSchema.default(DEFAULT_GEMINI_MODEL),
});
export type GeminiBatchSubmitRequest = z.infer<typeof GeminiBatchSubmitRequestSchema>;
export type GeminiBatchSubmitRequestInput = z.input<typeof GeminiBatchSubmitRequestSchema>;

export const AnalyzeResponseSchema = z.object({
  jev: ProviderResultSchema,
  gemini: ProviderResultSchema,
  dimensions: z.array(DimensionSchema),
});
export type AnalyzeResponse = z.infer<typeof AnalyzeResponseSchema>;
