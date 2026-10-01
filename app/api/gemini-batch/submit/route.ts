import { NextResponse } from "next/server";
import { GeminiBatchSubmitRequestSchema } from "@/lib/schema";
import { parseJsonBody } from "@/lib/http";
import { buildRequestBody, getGeminiClient } from "@/lib/providers/gemini";
import { getGeminiModelOption } from "@/lib/geminiModels";

export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, GeminiBatchSubmitRequestSchema);
  if (!parsed.ok) return parsed.response;

  const { items, dimensions, geminiModel } = parsed.data;
  const modelOption = getGeminiModelOption(geminiModel);

  try {
    const client = getGeminiClient();

    const inlineRequests = items.map((item) => {
      const body = buildRequestBody({ text: item.text, dimensions }, modelOption.id);
      return { ...body, metadata: { id: item.id } };
    });

    const job = await client.batches.create({
      model: modelOption.id,
      src: inlineRequests,
      config: { displayName: `jev-mvp-${Date.now()}` },
    });

    if (!job.name) {
      throw new Error("Gemini 沒有回傳批次工作名稱");
    }

    return NextResponse.json({ jobName: job.name });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "未知錯誤" },
      { status: 500 }
    );
  }
}
