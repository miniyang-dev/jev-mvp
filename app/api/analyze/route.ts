import { NextResponse } from "next/server";
import { AnalyzeRequestSchema, type ProviderResult } from "@/lib/schema";
import { parseJsonBody } from "@/lib/http";
import { jevProvider } from "@/lib/providers/jev";
import { geminiProvider } from "@/lib/providers/gemini";
import type { AnalysisProvider, AnalyzeInput } from "@/lib/providers/types";

async function runProvider<TOptions>(
  provider: AnalysisProvider<TOptions>,
  input: AnalyzeInput,
  options?: TOptions
): Promise<ProviderResult> {
  try {
    const result = await provider.analyze(input, options);
    return { provider: provider.id, ok: true, ...result };
  } catch (err) {
    return {
      provider: provider.id,
      ok: false,
      error: err instanceof Error ? err.message : "未知錯誤",
    };
  }
}

export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, AnalyzeRequestSchema);
  if (!parsed.ok) return parsed.response;

  const { text, dimensions, geminiModel, skipGemini, skipJev, geminiServiceTier } = parsed.data;

  const [jev, gemini] = await Promise.all([
    skipJev
      ? Promise.resolve<ProviderResult>({ provider: "jev", ok: false, deferred: true })
      : runProvider(jevProvider, { text, dimensions }),
    skipGemini
      ? Promise.resolve<ProviderResult>({ provider: "gemini", ok: false, deferred: true })
      : runProvider(geminiProvider, { text, dimensions }, { model: geminiModel, serviceTier: geminiServiceTier }),
  ]);

  return NextResponse.json({ jev, gemini, dimensions });
}
