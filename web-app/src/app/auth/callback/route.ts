import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { serverClient, PRIVATE_HEADERS } from "@/lib/backend/server";
import { safeReturnPath } from "@/lib/backend/guards.mjs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL || "https://meetohmi.vercel.app";
  const code = url.searchParams.get("code");
  const jar = await cookies();
  const next = safeReturnPath(jar.get("ohmi-web-return")?.value || url.searchParams.get("next"));
  const finish = (path: string) => {
    const response = NextResponse.redirect(new URL(path, origin), { headers: PRIVATE_HEADERS });
    response.cookies.set("ohmi-web-return", "", { path: "/app/", maxAge: 0, expires: new Date(0), sameSite: "lax" });
    return response;
  };
  if (code && !url.searchParams.has("error")) {
    try {
      const client = await serverClient();
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (!error)
        return finish(next);
    } catch {
      /* Return a safe recovery route without disclosing provider details. */
    }
  }
  const query = new URLSearchParams({ auth: url.searchParams.get("error") === "access_denied" ? "cancelled" : "failed" });
  if (next !== "/app/") query.set("next", next);
  return finish("/app/login/?" + query);
}
