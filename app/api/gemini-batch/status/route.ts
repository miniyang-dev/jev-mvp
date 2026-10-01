import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody } from "@/lib/http";
import { parseAnswer, getGeminiClient } from "@/lib/providers/gemini";
import { calcCost } from "@/lib/pricing";
import { getGeminiModelOption, BATCH_DISCOUNT_MULTIPLIER } from "@/lib/geminiModels";
import { isTerminalJobState } from "@/lib/geminiJobState";
import type { ProviderResult } from "@/lib/schema";

const RequestSchema = z.object({
  jobName: z.string().min(1),
  itemIds: z.array(z.string()).min(1),
  geminiModel: z.string().optional(),
});

export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, RequestSchema);
  if (!parsed.ok) return parsed.response;

  const { jobName, itemIds, geminiModel } = parsed.data;

  try {
    const client = getGeminiClient();
    const job = await client.batches.get({ name: jobName });
    const state = job.state ?? "JOB_STATE_UNSPECIFIED";
    const done = isTerminalJobState(state);

    if (!done) {
      return NextResponse.json({ state, done: false });
    }

    const modelOption = getGeminiModelOption(geminiModel);
    const results: Record<string, ProviderResult> = {};
    const inlinedResponses = job.dest?.inlinedResponses ?? [];

    // Order is only a safe fallback when nothing was dropped: with fewer
    // responses than submitted items, position N may no longer be item N, and
    // guessing would attach one article's answer to a different article.
    const orderIsTrusted = inlinedResponses.length === itemIds.length;

    inlinedResponses.forEach((item, index) => {
      // Prefer the metadata we attached at submit time.
      const id = item.metadata?.id ?? (orderIsTrusted ? itemIds[index] : undefined);
      if (!id) return;

      if (item.error || !item.response) {
        results[id] = {
          provider: "gemini",
          ok: false,
          error: item.error?.message ?? "Gemini batch 這筆項目沒有回傳內容",
        };
        return;
      }

      try {
        const usage = {
          inputTokens: item.response.usageMetadata?.promptTokenCount ?? 0,
          outputTokens: item.response.usageMetadata?.candidatesTokenCount ?? 0,
        };
        results[id] = {
          provider: "gemini",
          ok: true,
          rawResponse: item.response,
          answers: parseAnswer(item.response),
          usage,
          costUsd: calcCost(usage, modelOption) * BATCH_DISCOUNT_MULTIPLIER,
          model: modelOption.id,
        };
      } catch (err) {
        results[id] = {
          provider: "gemini",
          ok: false,
          error: err instanceof Error ? err.message : "解析 Gemini batch 回應失敗",
        };
      }
    });

    return NextResponse.json({ state, done: true, results });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "未知錯誤" },
      { status: 500 }
    );
  }
}
