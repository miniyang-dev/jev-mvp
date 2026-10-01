import { NextResponse, type NextRequest } from "next/server";

/** Every API route here spends the owner's Jev / Gemini quota, so a deployed
 * copy must not be open to whoever finds the URL. Set `APP_BASIC_AUTH_PASSWORD`
 * (and optionally `APP_BASIC_AUTH_USER`, default "admin") to require HTTP Basic
 * auth on every page and route. Local `next dev` stays open when it is unset;
 * a production build without it refuses to serve rather than fail open. */

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function challenge(): NextResponse {
  return new NextResponse("需要登入", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="jev-mvp", charset="UTF-8"' },
  });
}

export function middleware(request: NextRequest) {
  const password = process.env.APP_BASIC_AUTH_PASSWORD;

  if (!password) {
    if (process.env.NODE_ENV === "production") {
      return new NextResponse("伺服器未設定 APP_BASIC_AUTH_PASSWORD，已拒絕所有請求", { status: 503 });
    }
    return NextResponse.next();
  }

  const header = request.headers.get("authorization");
  if (!header?.startsWith("Basic ")) return challenge();

  let decoded: string;
  try {
    decoded = new TextDecoder().decode(Uint8Array.from(atob(header.slice(6)), (c) => c.charCodeAt(0)));
  } catch {
    return challenge();
  }

  const separator = decoded.indexOf(":");
  const user = decoded.slice(0, separator);
  const pass = decoded.slice(separator + 1);
  const expectedUser = process.env.APP_BASIC_AUTH_USER ?? "admin";

  if (separator < 0 || !constantTimeEqual(user, expectedUser) || !constantTimeEqual(pass, password)) {
    return challenge();
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
