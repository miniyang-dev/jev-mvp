import { choice, noul, score, TypeSafeClient, type Question } from "@typesafe-ai/sdk";
import { REGION_LABELS, regionKeyForLabel, type RegionKey } from "@/lib/labels";
import { JEV_SENTIMENT_CRITERIA, scoreToCategory } from "@/lib/sentimentScale";
import { calcCost, JEV_PRICING } from "@/lib/pricing";
import type { ProviderAnswers } from "@/lib/schema";
import type { AnalysisProvider, AnalyzeInput, ProviderAnalysis } from "@/lib/providers/types";

const NOISE_INSTRUCTIONS =
  "這篇內容是否為雜訊（例如：亂碼、廣告、與主題無關的灌水內容、機器人貼文）？";
const SENTIMENT_INSTRUCTIONS = "這篇文章整體情緒強度落在哪個等級？";
const REGION_INSTRUCTIONS = "這篇文章最可能與哪個地區有關？";

/** The slice of the Jev (TypeSafe) response this app reads. The SDK's own result
 * type is generic over the question set, so a narrow structural type keeps
 * parsing independent of which dimensions were asked for. */
interface JevResponse {
  model: string;
  usage?: { input_tokens?: number; output_tokens?: number };
  answers?: {
    sentiment?: { score: number; confidence?: number | null };
    region?: { choice: string; confidence?: number | null };
    noise?: { noul: number };
  };
}

function buildRequest(input: AnalyzeInput) {
  const questions: Record<string, Question> = {};

  if (input.dimensions.includes("sentiment")) {
    questions.sentiment = score(SENTIMENT_INSTRUCTIONS, JEV_SENTIMENT_CRITERIA);
  }
  if (input.dimensions.includes("region")) {
    const criteria = Object.fromEntries(
      Object.values(REGION_LABELS).map((label) => [label, null])
    );
    questions.region = choice(REGION_INSTRUCTIONS, criteria);
  }
  if (input.dimensions.includes("noise")) {
    questions.noise = noul(NOISE_INSTRUCTIONS);
  }

  return {
    state: { document: input.text },
    model: "jev-latest",
    questions,
  };
}

async function callApi(client: TypeSafeClient, request: ReturnType<typeof buildRequest>) {
  return client.systemOne(request);
}

function parseAnswer(response: JevResponse): ProviderAnswers {
  const answers: ProviderAnswers = {};

  if (response.answers?.sentiment) {
    const displayScore = response.answers.sentiment.score + 1;
    answers.sentiment = {
      score: displayScore,
      category: scoreToCategory(displayScore),
      confidence: response.answers.sentiment.confidence ?? null,
    };
  }

  if (response.answers?.region) {
    const label = response.answers.region.choice;
    const key = regionKeyForLabel(label);
    if (key) {
      answers.region = {
        key: key as RegionKey,
        confidence: response.answers.region.confidence ?? null,
      };
    }
  }

  if (response.answers?.noise) {
    const probability = response.answers.noise.noul;
    answers.noise = { isNoise: probability >= 0.5, probability };
  }

  return answers;
}

export const jevProvider: AnalysisProvider = {
  id: "jev",

  async analyze(input: AnalyzeInput): Promise<ProviderAnalysis> {
    if (!process.env.TYPESAFE_API_KEY) {
      throw new Error("缺少 TYPESAFE_API_KEY，請在 .env.local 設定後重新啟動伺服器");
    }
    const client = new TypeSafeClient();
    const rawRequest = buildRequest(input);

    const start = performance.now();
    const rawResponse: JevResponse = await callApi(client, rawRequest);
    const latencyMs = performance.now() - start;

    const usage = {
      inputTokens: rawResponse.usage?.input_tokens ?? 0,
      outputTokens: rawResponse.usage?.output_tokens ?? 0,
    };

    return {
      rawRequest,
      rawResponse,
      answers: parseAnswer(rawResponse),
      usage,
      costUsd: calcCost(usage, JEV_PRICING),
      latencyMs,
      model: rawResponse.model,
    };
  },
};
