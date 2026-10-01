import { NextResponse } from "next/server";
import type { z } from "zod";

type ParsedBody<S extends z.ZodTypeAny> =
  | { ok: true; data: z.infer<S> }
  | { ok: false; response: NextResponse };

/** Reads a request's JSON body and validates it against `schema`. A body that
 * isn't valid JSON is the caller's mistake, so it gets a 400 like a schema
 * violation does — not the unhandled-exception 500 a bare `request.json()`
 * would turn into. */
export async function parseJsonBody<S extends z.ZodTypeAny>(
  request: Request,
  schema: S
): Promise<ParsedBody<S>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { ok: false, response: NextResponse.json({ error: "請求內容不是有效的 JSON" }, { status: 400 }) };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join("; ") },
        { status: 400 }
      ),
    };
  }
  return { ok: true, data: parsed.data };
}
