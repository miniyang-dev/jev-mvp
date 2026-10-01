import { GoogleGenAI, ServiceTier, type GenerateContentResponse } from "@google/genai";
import { REGION_LABELS, regionKeyForLabel, type RegionKey } from "@/lib/labels";
import { SENTIMENT_LEVELS, SENTIMENT_RUBRIC_TEXT, scoreToCategory } from "@/lib/sentimentScale";
import { calcCost } from "@/lib/pricing";
import { getGeminiModelOption, FLEX_DISCOUNT_MULTIPLIER } from "@/lib/geminiModels";
import type { GeminiServiceTier, ProviderAnswers } from "@/lib/schema";
import type { AnalysisProvider, AnalyzeInput, ProviderAnalysis } from "@/lib/providers/types";

const NOISE_DESCRIPTION =
  "是否為雜訊（亂碼、廣告、與主題無關的灌水內容、機器人貼文）";

/** Gemini-only knobs, kept off the shared `AnalyzeInput`. */
export interface GeminiOptions {
  /** Defaults to the catalog's default model. */
  model?: string;
  /** "flex" for the discounted-but-slower synchronous tier. */
  serviceTier?: GeminiServiceTier;
}

/** Shared client factory so real-time calls and Gemini batch routes fail the
 * same way when the key is missing. */
export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("缺少 GEMINI_API_KEY，請在 .env.local 設定後重新啟動伺服器");
  }
  return new GoogleGenAI({ apiKey });
}

/** Everything about a Gemini request except which model it targets. Batch jobs
 * attach the model to the job itself, so they take just this part. */
export function buildRequestBody(
  input: AnalyzeInput,
  model: string,
  serviceTier?: GeminiServiceTier
) {
  const properties: Record<string, unknown> = {};
  const rubricLines: string[] = [];

  if (input.dimensions.includes("sentiment")) {
    properties.sentiment = {
      type: "INTEGER",
      format: "enum",
      enum: SENTIMENT_LEVELS.map((l) => String(l.score)),
    };
    rubricLines.push(`情緒強度請給 1~10 的整數，對照表：\n${SENTIMENT_RUBRIC_TEXT}`);
  }
  if (input.dimensions.includes("region")) {
    properties.region = {
      type: "STRING",
      format: "enum",
      enum: Object.values(REGION_LABELS),
    };
  }
  if (input.dimensions.includes("noise")) {
    properties.is_noise = { type: "BOOLEAN", description: NOISE_DESCRIPTION };
  }

  const promptParts = [
    ...rubricLines,
    "請分析以下文章，回傳指定欄位的判斷結果：",
    input.text,
  ];

  // Disabling thinking keeps this small structured-answer task fast and cheap,
  // but gemini-3.5-flash-lite rejects thinkingBudget: 0 outright (confirmed by
  // direct testing — every other model here accepts it) — every call to it
  // fails with a 400 if this is sent unconditionally.
  const modelOption = getGeminiModelOption(model);
  const thinkingConfig =
    modelOption.supportsZeroThinkingBudget === false ? {} : { thinkingConfig: { thinkingBudget: 0 } };

  return {
    contents: promptParts.join("\n\n"),
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties,
        required: Object.keys(properties),
      },
      ...thinkingConfig,
      ...(serviceTier === "flex" ? { serviceTier: ServiceTier.FLEX } : {}),
    },
  };
}

export function buildRequest(input: AnalyzeInput, model: string, serviceTier?: GeminiServiceTier) {
  return { model, ...buildRequestBody(input, model, serviceTier) };
}

async function callApi(client: GoogleGenAI, request: ReturnType<typeof buildRequest>) {
  return client.models.generateContent(request);
}

/** `response.text` is a getter on the SDK's `GenerateContentResponse` class,
 * so it only works for real-time `generateContent()` results. A batch job's
 * `dest.inlinedResponses[].response` comes back as a plain deserialized
 * object with no prototype, so that getter is just `undefined` there even
 * though the text is present — walk the candidate parts directly instead. */
function extractText(response: GenerateContentResponse): string | undefined {
  if (typeof response.text === "string") return response.text;
  const parts = response.candidates?.[0]?.content?.parts;
  return parts?.map((p) => p.text ?? "").join("") || undefined;
}

export function parseAnswer(response: GenerateContentResponse): ProviderAnswers {
  const text = extractText(response);
  if (!text) {
    throw new Error("Gemini 沒有回傳任何內容");
  }
  const parsed: { sentiment?: unknown; region?: unknown; is_noise?: unknown } = JSON.parse(text);
  const answers: ProviderAnswers = {};

  if (typeof parsed.sentiment === "number") {
    answers.sentiment = {
      score: parsed.sentiment,
      category: scoreToCategory(parsed.sentiment),
      confidence: null,
    };
  }

  if (typeof parsed.region === "string") {
    const key = regionKeyForLabel(parsed.region);
    if (key) {
      answers.region = { key: key as RegionKey, confidence: null };
    }
  }

  if (typeof parsed.is_noise === "boolean") {
    answers.noise = { isNoise: parsed.is_noise, probability: null };
  }

  return answers;
}

export const geminiProvider: AnalysisProvider<GeminiOptions> = {
  id: "gemini",

  async analyze(input: AnalyzeInput, options: GeminiOptions = {}): Promise<ProviderAnalysis> {
    const modelOption = getGeminiModelOption(options.model);
    const client = getGeminiClient();
    const rawRequest = buildRequest(input, modelOption.id, options.serviceTier);

    const start = performance.now();
    const rawResponse = await callApi(client, rawRequest);
    const latencyMs = performance.now() - start;

    const usage = {
      inputTokens: rawResponse.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: rawResponse.usageMetadata?.candidatesTokenCount ?? 0,
    };

    const discount = options.serviceTier === "flex" ? FLEX_DISCOUNT_MULTIPLIER : 1;

    return {
      rawRequest,
      rawResponse,
      answers: parseAnswer(rawResponse),
      usage,
      costUsd: calcCost(usage, modelOption) * discount,
      latencyMs,
      model: modelOption.id,
    };
  },
};
