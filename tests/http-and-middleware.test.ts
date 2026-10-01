import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { z } from "zod";
import { parseJsonBody } from "@/lib/http";
import { middleware } from "@/middleware";

describe("parseJsonBody", () => {
  const schema = z.object({ n: z.number() });
  const post = (body: string) => new Request("http://x/api", { method: "POST", body });

  it("returns 400 (not a thrown error) for malformed JSON", async () => {
    const result = await parseJsonBody(post("{not json"), schema);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(400);
  });

  it("returns 400 for a schema violation", async () => {
    const result = await parseJsonBody(post('{"n":"x"}'), schema);
    expect(result.ok).toBe(false);
  });

  it("returns typed data when valid", async () => {
    const result = await parseJsonBody(post('{"n":3}'), schema);
    expect(result).toEqual({ ok: true, data: { n: 3 } });
  });
});

describe("middleware basic auth", () => {
  afterEach(() => vi.unstubAllEnvs());
  const req = (auth?: string) =>
    new NextRequest("http://localhost/api/analyze", { headers: auth ? { authorization: auth } : {} });
  const basic = (user: string, pass: string) => `Basic ${btoa(`${user}:${pass}`)}`;

  it("is open in dev when no password is configured", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APP_BASIC_AUTH_PASSWORD", "");
    expect(middleware(req()).status).toBe(200);
  });

  it("fails closed in production when no password is configured", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_BASIC_AUTH_PASSWORD", "");
    expect(middleware(req()).status).toBe(503);
  });

  it("challenges missing or wrong credentials and accepts the right ones", () => {
    vi.stubEnv("APP_BASIC_AUTH_PASSWORD", "s3cret");
    expect(middleware(req()).status).toBe(401);
    expect(middleware(req(basic("admin", "wrong"))).status).toBe(401);
    expect(middleware(req(basic("nobody", "s3cret"))).status).toBe(401);
    expect(middleware(req(basic("admin", "s3cret"))).status).toBe(200);
  });
});
